import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

import express from 'express';
import Bull from 'bull';
import logger from './config/logger.js';
import pool from './config/database.js';
import { subscriber, publisher } from './config/redis.js';
import priceEvaluator from './evaluators/price.js';
import signalEvaluator from './evaluators/signal.js';
import { deliverAlert } from './delivery/index.js';

const PORT = parseInt(process.env.PORT || '3004', 10);

const app = express();

// Bull queue for alert delivery jobs
export const alertDeliveryQueue = new Bull('alert-delivery', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

// Process delivery jobs
alertDeliveryQueue.process('deliver', async (job) => {
  const { alertId, userId, snapshot } = job.data;
  logger.info('Processing delivery job', { alertId, userId, jobId: job.id });
  await deliverAlert(alertId, userId, snapshot);
});

alertDeliveryQueue.on('failed', (job, err) => {
  logger.error('Delivery job failed', {
    jobId: job.id,
    alertId: job.data.alertId,
    error: err.message,
    attempts: job.attemptsMade,
  });
});

alertDeliveryQueue.on('completed', (job) => {
  logger.debug('Delivery job completed', { jobId: job.id, alertId: job.data.alertId });
});

// Health check endpoint
app.get('/health', async (_req, res) => {
  try {
    const dbResult = await pool.query('SELECT 1');
    const redisStatus = publisher.status;

    const healthy = dbResult.rowCount === 1 && redisStatus === 'ready';

    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'healthy' : 'degraded',
      service: 'alert-service',
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
      service: 'alert-service',
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

    // Subscribe to Redis channels
    await subscriber.subscribe('ticker:update', 'signal:new');
    logger.info('Subscribed to Redis channels: ticker:update, signal:new');

    // Handle incoming messages
    subscriber.on('message', async (channel: string, message: string) => {
      try {
        const data = JSON.parse(message);

        switch (channel) {
          case 'ticker:update': {
            const { symbol, price } = data;
            if (symbol && price) {
              await priceEvaluator.evaluate(symbol, parseFloat(price));
            }
            break;
          }

          case 'signal:new': {
            await signalEvaluator.evaluate(data);
            break;
          }

          default:
            logger.warn('Received message on unknown channel', { channel });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('Error processing Redis message', { channel, error: message });
      }
    });

    // Start the HTTP server
    app.listen(PORT, () => {
      logger.info(`Alert service health server listening on port ${PORT}`);
    });

    logger.info('Alert service started successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to start alert service', { error: message });
    process.exit(1);
  }
}

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully`);

  try {
    // Close the delivery queue
    await alertDeliveryQueue.close();
    logger.info('Alert delivery queue closed');

    // Unsubscribe and close Redis connections
    await subscriber.unsubscribe();
    await subscriber.quit();
    logger.info('Redis subscriber closed');

    await publisher.quit();
    logger.info('Redis publisher closed');

    // Close database pool
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
