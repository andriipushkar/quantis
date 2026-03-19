import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import logger from './config/logger.js';
import pool from './config/database.js';
import redis from './config/redis.js';
import { BinanceCollector } from './collectors/binance.js';
import { BybitCollector } from './collectors/bybit.js';
import { OkxCollector } from './collectors/okx.js';

const PORT = parseInt(process.env.PORT || '3002', 10);

const app = express();
const binanceCollector = new BinanceCollector(pool, redis);
const bybitCollector = new BybitCollector(pool, redis);
const okxCollector = new OkxCollector(pool, redis);

// Health check endpoint
app.get('/health', async (_req, res) => {
  try {
    const dbResult = await pool.query('SELECT 1');
    const redisStatus = redis.status;

    const healthy = dbResult.rowCount === 1 && redisStatus === 'ready';

    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'healthy' : 'degraded',
      service: 'data-collector',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      connections: {
        database: dbResult.rowCount === 1 ? 'connected' : 'disconnected',
        redis: redisStatus,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(503).json({
      status: 'unhealthy',
      service: 'data-collector',
      timestamp: new Date().toISOString(),
      error: message,
    });
  }
});

async function start(): Promise<void> {
  try {
    // Verify database connectivity
    await pool.query('SELECT 1');
    logger.info('Database connection established');

    // Start the HTTP server
    app.listen(PORT, () => {
      logger.info(`Data collector health server listening on port ${PORT}`);
    });

    // Start collectors in parallel
    await Promise.all([
      binanceCollector.start(),
      bybitCollector.start(),
      okxCollector.start(),
    ]);
    logger.info('Data collector service started successfully (Binance + Bybit + OKX)');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to start data collector service', { error: message });
    process.exit(1);
  }
}

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully`);

  try {
    await Promise.all([
      binanceCollector.stop(),
      bybitCollector.stop(),
      okxCollector.stop(),
    ]);
    logger.info('All collectors stopped');

    await redis.quit();
    logger.info('Redis connection closed');

    await pool.end();
    logger.info('Database pool closed');

    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Error during shutdown', { error: message });
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', {
    error: reason instanceof Error ? reason.message : String(reason),
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message });
  process.exit(1);
});

start();
