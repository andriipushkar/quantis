import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { Server as SocketIOServer } from 'socket.io';
import logger from './config/logger.js';
import authRoutes from './routes/auth.js';
import marketRoutes from './routes/market.js';
import analysisRoutes from './routes/analysis.js';
import alertRoutes from './routes/alerts.js';
import watchlistRoutes from './routes/watchlist.js';
import subscriptionRoutes from './routes/subscription.js';
import copilotRoutes from './routes/copilot.js';
import paperTradingRoutes from './routes/paper-trading.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import Redis from 'ioredis';

const app = express();
const server = http.createServer(app);

// CORS configuration
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:3000'];

const corsOptions: cors.CorsOptions = {
  origin: corsOrigins,
  credentials: true,
};

// Middleware
app.use(helmet());
app.use(cors(corsOptions));
app.use(compression());
app.use(express.json());
app.use(cookieParser());
app.use(rateLimiter);

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/market', marketRoutes);
app.use('/api/v1/analysis', analysisRoutes);
app.use('/api/v1/alerts', alertRoutes);
app.use('/api/v1/watchlist', watchlistRoutes);
app.use('/api/v1/subscription', subscriptionRoutes);
app.use('/api/v1/copilot', copilotRoutes);
app.use('/api/v1/paper', paperTradingRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Socket.IO
const io = new SocketIOServer(server, {
  cors: corsOptions,
});

io.on('connection', (socket) => {
  logger.info('Socket.IO client connected', { id: socket.id });

  // Join rooms for specific pairs
  socket.on('subscribe:ticker', (symbols: string[]) => {
    symbols.forEach((s) => socket.join(`ticker:${s}`));
  });

  socket.on('subscribe:ohlcv', ({ symbol, timeframe }: { symbol: string; timeframe: string }) => {
    socket.join(`ohlcv:${symbol}:${timeframe}`);
  });

  socket.on('unsubscribe:ticker', (symbols: string[]) => {
    symbols.forEach((s) => socket.leave(`ticker:${s}`));
  });

  socket.on('disconnect', (reason) => {
    logger.info('Socket.IO client disconnected', { id: socket.id, reason });
  });
});

// Redis subscriber to relay real-time data to Socket.IO clients
const redisSub = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
});

redisSub.subscribe('ticker:update', 'signal:new', 'alert:push', (err) => {
  if (err) logger.error('Redis subscribe error', { error: err.message });
  else logger.info('Subscribed to Redis channels: ticker:update, signal:new, alert:push');
});

redisSub.on('message', (channel, message) => {
  try {
    const data = JSON.parse(message);

    if (channel === 'ticker:update') {
      // Broadcast to all clients + specific room
      io.emit('ticker:update', data);
      if (data.symbol) {
        io.to(`ticker:${data.symbol}`).emit('ticker:update', data);
      }
    } else if (channel === 'signal:new') {
      io.emit('signal:new', data);
    } else if (channel === 'alert:push') {
      // Send to specific user
      if (data.userId) {
        io.to(`user:${data.userId}`).emit('alert:triggered', data);
      }
    }
  } catch {
    // skip malformed messages
  }
});

// Start server
const PORT = parseInt(process.env.APP_PORT || '3001', 10);

server.listen(PORT, () => {
  logger.info(`API Gateway listening on port ${PORT}`);
});

// Graceful shutdown
function shutdown(signal: string) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);

  server.close(() => {
    logger.info('HTTP server closed');

    io.close(() => {
      logger.info('Socket.IO server closed');
      process.exit(0);
    });
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export { app, server, io };
