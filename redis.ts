import { createClient } from 'redis';

// High-reliability connection that fails-over to in-memory caching if Redis server isn't reachable
class RedisCacheService {
  private client: any = null;
  private memoryCache: Record<string, { value: string; expires: number }> = {};
  private isConnected = false;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    // Lazy initialize to avoid blocking start process
    if (process.env.NODE_ENV !== 'test') {
      try {
        this.client = createClient({ url: redisUrl });
        this.client.on('error', (err: any) => {
          console.warn('Redis connection failed, fallback to in-memory cache activated.', err.message);
          this.isConnected = false;
        });
        this.client.connect().then(() => {
          console.log('Connected to Redis Cache Engine.');
          this.isConnected = true;
        }).catch(() => {
          this.isConnected = false;
        });
      } catch (err) {
        this.isConnected = false;
      }
    }
  }

  public async get(key: string): Promise<string | null> {
    if (this.isConnected && this.client) {
      try {
        return await this.client.get(key);
      } catch {
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

  public async set(key: string, value: string, ttlSeconds = 300): Promise<void> {
    if (this.isConnected && this.client) {
      try {
        await this.client.set(key, value, { EX: ttlSeconds });
        return;
      } catch {
        // Fallback to memory
      }
    }

    this.memoryCache[key] = {
      value,
      expires: Date.now() + ttlSeconds * 1000
    };
  }

  public async del(key: string): Promise<void> {
    if (this.isConnected && this.client) {
      try {
        await this.client.del(key);
        return;
      } catch {
        // Fallback to memory
      }
    }
    delete this.memoryCache[key];
  }
}

const cache = new RedisCacheService();
export default cache;
