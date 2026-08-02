"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const redis_1 = require("redis");
// High-reliability connection that fails-over to in-memory caching if Redis server isn't reachable
class RedisCacheService {
    client = null;
    memoryCache = {};
    isConnected = false;
    constructor() {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        // Lazy initialize to avoid blocking start process
        if (process.env.NODE_ENV !== 'test') {
            try {
                this.client = (0, redis_1.createClient)({ url: redisUrl });
                this.client.on('error', (err) => {
                    console.warn('Redis connection failed, fallback to in-memory cache activated.', err.message);
                    this.isConnected = false;
                });
                this.client.connect().then(() => {
                    console.log('Connected to Redis Cache Engine.');
                    this.isConnected = true;
                }).catch(() => {
                    this.isConnected = false;
                });
            }
            catch (err) {
                this.isConnected = false;
            }
        }
    }
    async get(key) {
        if (this.isConnected && this.client) {
            try {
                return await this.client.get(key);
            }
            catch {
                // Fallback to memory
            }
        }
        const cached = this.memoryCache[key];
        if (cached) {
            if (Date.now() < cached.expires) {
                return cached.value;
            }
            delete this.memoryCache[key];
        }
        return null;
    }
    async set(key, value, ttlSeconds = 300) {
        if (this.isConnected && this.client) {
            try {
                await this.client.set(key, value, { EX: ttlSeconds });
                return;
            }
            catch {
                // Fallback to memory
            }
        }
        this.memoryCache[key] = {
            value,
            expires: Date.now() + ttlSeconds * 1000
        };
    }
    async del(key) {
        if (this.isConnected && this.client) {
            try {
                await this.client.del(key);
                return;
            }
            catch {
                // Fallback to memory
            }
        }
        delete this.memoryCache[key];
    }
}
const cache = new RedisCacheService();
exports.default = cache;
