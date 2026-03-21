import { env } from './config/env.js';

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
import newsRoutes from './routes/news.js';
import whaleRoutes from './routes/whales.js';
import referralRoutes from './routes/referral.js';
import leaderboardRoutes from './routes/leaderboard.js';
import journalRoutes from './routes/journal.js';
import tokenScannerRoutes from './routes/token-scanner.js';
import dcaRoutes from './routes/dca.js';
import exchangeHealthRoutes from './routes/exchange-health.js';
import gamificationRoutes from './routes/gamification.js';
import copyTradingRoutes from './routes/copy-trading.js';
import socialRoutes from './routes/social.js';
import adminRoutes from './routes/admin.js';
import telegramRoutes from './routes/telegram.js';
import marketplaceRoutes from './routes/marketplace.js';
import walletTrackerRoutes from './routes/wallet-tracker.js';
import taxRoutes from './routes/tax.js';
import emailRoutes from './routes/emails.js';
import influencerRoutes from './routes/influencers.js';
import tokenomicsRoutes from './routes/tokenomics.js';
import docsRoutes from './routes/docs.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { applySocketRateLimiting, canSubscribe, releaseSubscriptions } from './middleware/socketRateLimiter.js';
import { sanitizeResponse, validateContentType, preventParamPollution } from './middleware/security.js';
import Redis from 'ioredis';

const app = express();
const server = http.createServer(app);

// CORS configuration
const corsOptions: cors.CorsOptions = {
  origin: env.CORS_ORIGINS,
  credentials: true,
};

// Middleware
app.use(helmet());
app.use(sanitizeResponse);
app.use(validateContentType);
app.use(preventParamPollution);

// Additional security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

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
app.use('/api/v1/news', newsRoutes);
app.use('/api/v1/whales', whaleRoutes);
app.use('/api/v1/referral', referralRoutes);
app.use('/api/v1/leaderboard', leaderboardRoutes);
app.use('/api/v1/journal', journalRoutes);
app.use('/api/v1/scanner', tokenScannerRoutes);
app.use('/api/v1/dca', dcaRoutes);
app.use('/api/v1/exchanges', exchangeHealthRoutes);
app.use('/api/v1/gamification', gamificationRoutes);
app.use('/api/v1/copy', copyTradingRoutes);
app.use('/api/v1/social', socialRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/telegram', telegramRoutes);
app.use('/api/v1/marketplace', marketplaceRoutes);
app.use('/api/v1/wallets', walletTrackerRoutes);
app.use('/api/v1/tax', taxRoutes);
app.use('/api/v1/emails', emailRoutes);
app.use('/api/v1/influencers', influencerRoutes);
app.use('/api/v1/tokenomics', tokenomicsRoutes);
app.use('/api/v1/docs', docsRoutes);

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

// Apply WebSocket rate limiting (per-IP connection limits, event throttling)
applySocketRateLimiting(io);

io.on('connection', (socket) => {
  logger.info('Socket.IO client connected', { id: socket.id });

  // Join rooms for specific pairs (with subscription quota check)
  socket.on('subscribe:ticker', (symbols: string[]) => {
    if (!Array.isArray(symbols)) return;
    const safeSymbols = symbols.slice(0, 50); // cap per-event batch
    if (!canSubscribe(socket, safeSymbols.length)) {
      socket.emit('error', { message: 'Subscription limit reached for your tier' });
      return;
    }
    safeSymbols.forEach((s) => socket.join(`ticker:${s}`));
  });

  socket.on('subscribe:ohlcv', ({ symbol, timeframe }: { symbol: string; timeframe: string }) => {
    if (!symbol || !timeframe) return;
    if (!canSubscribe(socket, 1)) {
      socket.emit('error', { message: 'Subscription limit reached for your tier' });
      return;
    }
    socket.join(`ohlcv:${symbol}:${timeframe}`);
  });

  socket.on('unsubscribe:ticker', (symbols: string[]) => {
    if (!Array.isArray(symbols)) return;
    const safeSymbols = symbols.slice(0, 50);
    safeSymbols.forEach((s) => socket.leave(`ticker:${s}`));
    releaseSubscriptions(socket, safeSymbols.length);
  });

  socket.on('disconnect', (reason) => {
    logger.info('Socket.IO client disconnected', { id: socket.id, reason });
  });
});

// Redis subscriber to relay real-time data to Socket.IO clients
const redisSub = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
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
server.listen(env.APP_PORT, () => {
  logger.info(`API Gateway listening on port ${env.APP_PORT}`);
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
