import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Import Routers
import authRouter from './routes/auth';
import notesRouter from './routes/notes';
import quizRouter from './routes/quiz';
import mentorRouter from './routes/mentor';
import critiqueRouter from './routes/critique';
import plannerRouter from './routes/planner';
import communityRouter from './routes/community';
import podcastRouter from './routes/podcast';
import videoRouter from './routes/video';
import gamesRouter from './routes/games';
import dashboardRouter from './routes/dashboard';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Security and Parsers
app.use(helmet());
app.use(cors({ origin: '*' })); // Custom origin matching frontend during production
app.use(express.json());

// Main Endpoint Router Mapping
app.use('/api/auth', authRouter);
app.use('/api/notes', notesRouter);
app.use('/api/quiz', quizRouter);
app.use('/api/mentor', mentorRouter);
app.use('/api/critique', critiqueRouter);
app.use('/api/planner', plannerRouter);
app.use('/api/community', communityRouter);
app.use('/api/podcast', podcastRouter);
app.use('/api/video', videoRouter);
app.use('/api/games', gamesRouter);
app.use('/api/dashboard', dashboardRouter);

// Base status check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', platform: 'StudyWithKia API', timestamp: new Date() });
});

// 404 Route Not Found
app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(404).json({ error: 'Endpoint resource not found' });
});

// Centralized Error Handling Middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Server execution error:', err.stack || err.message);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong.' : err.message
  });
});

// WebSocket Server Initialization
const wss = new WebSocketServer({ server });
const connectedClients = new Map<string, WebSocket>();

wss.on('connection', (ws: WebSocket, req) => {
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
export function sendLiveNotification(userId: string, payload: { title: string; message: string }) {
  const client = connectedClients.get(userId);
  if (client && client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify({ type: 'NOTIFICATION', ...payload }));
  }
}

// Start Server Listen
server.listen(PORT, () => {
  console.log(`[StudyWithKia Backend] Running on http://localhost:${PORT}`);
});
