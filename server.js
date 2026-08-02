"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendLiveNotification = sendLiveNotification;
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const ws_1 = require("ws");
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
// Import Routers
const auth_1 = __importDefault(require("./routes/auth"));
const notes_1 = __importDefault(require("./routes/notes"));
const quiz_1 = __importDefault(require("./routes/quiz"));
const mentor_1 = __importDefault(require("./routes/mentor"));
const critique_1 = __importDefault(require("./routes/critique"));
const planner_1 = __importDefault(require("./routes/planner"));
const community_1 = __importDefault(require("./routes/community"));
const podcast_1 = __importDefault(require("./routes/podcast"));
const video_1 = __importDefault(require("./routes/video"));
const games_1 = __importDefault(require("./routes/games"));
const dashboard_1 = __importDefault(require("./routes/dashboard"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const PORT = process.env.PORT || 5000;
// Security and Parsers
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({ origin: '*' })); // Custom origin matching frontend during production
app.use(express_1.default.json());
// Main Endpoint Router Mapping
app.use('/api/auth', auth_1.default);
app.use('/api/notes', notes_1.default);
app.use('/api/quiz', quiz_1.default);
app.use('/api/mentor', mentor_1.default);
app.use('/api/critique', critique_1.default);
app.use('/api/planner', planner_1.default);
app.use('/api/community', community_1.default);
app.use('/api/podcast', podcast_1.default);
app.use('/api/video', video_1.default);
app.use('/api/games', games_1.default);
app.use('/api/dashboard', dashboard_1.default);
// Base status check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', platform: 'StudyWithKia API', timestamp: new Date() });
});
// 404 Route Not Found
app.use((req, res, next) => {
    res.status(404).json({ error: 'Endpoint resource not found' });
});
// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
    console.error('Server execution error:', err.stack || err.message);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'production' ? 'Something went wrong.' : err.message
    });
});
// WebSocket Server Initialization
const wss = new ws_1.WebSocketServer({ server });
const connectedClients = new Map();
wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const userId = url.searchParams.get('userId');
    if (userId) {
        connectedClients.set(userId, ws);
    }
    ws.on('close', () => {
        if (userId) {
            connectedClients.delete(userId);
        }
    });
    // Welcome message
    ws.send(JSON.stringify({ type: 'WELCOME', message: 'WebSocket tunnel activated.' }));
});
// Helper function to broadcast notifications
function sendLiveNotification(userId, payload) {
    const client = connectedClients.get(userId);
    if (client && client.readyState === ws_1.WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'NOTIFICATION', ...payload }));
    }
}
// Start Server Listen
server.listen(PORT, () => {
    console.log(`[StudyWithKia Backend] Running on http://localhost:${PORT}`);
});
