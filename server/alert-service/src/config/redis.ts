import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

import Redis from 'ioredis';
import logger from './logger.js';

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    const delay = Math.min(times * 200, 5000);
    return delay;
  },
};

// Subscriber client - dedicated to pub/sub subscriptions
const subscriber = new Redis(redisConfig);

subscriber.on('connect', () => {
  logger.info('Redis subscriber connected');
});

subscriber.on('error', (err) => {
  logger.error('Redis subscriber error', { error: err.message });
});

// Publisher client - for publishing messages and general commands
const publisher = new Redis(redisConfig);

publisher.on('connect', () => {
  logger.info('Redis publisher connected');
});

publisher.on('error', (err) => {
  logger.error('Redis publisher error', { error: err.message });
});

export { subscriber, publisher };
export default publisher;
