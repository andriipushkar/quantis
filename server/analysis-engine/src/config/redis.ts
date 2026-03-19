import dotenv from 'dotenv';
dotenv.config();

import Redis from 'ioredis';
import logger from './logger.js';

function createRedisClient(name: string): Redis {
  const client = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    maxRetriesPerRequest: name === 'subscriber' ? null : 3,
    retryStrategy(times: number) {
      const delay = Math.min(times * 200, 5000);
      return delay;
    },
  });

  client.on('connect', () => {
    logger.info(`Redis ${name} client connected`);
  });

  client.on('error', (err) => {
    logger.error(`Redis ${name} client error`, { error: err.message });
  });

  return client;
}

// Subscriber client: used exclusively for pub/sub subscriptions.
// Redis requires a dedicated connection for subscribe mode.
export const subscriberClient = createRedisClient('subscriber');

// Publisher/cache client: used for publishing messages and general key-value operations.
export const publisherClient = createRedisClient('publisher');

export default publisherClient;
