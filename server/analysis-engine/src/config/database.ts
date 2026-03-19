import dotenv from 'dotenv';
dotenv.config();

import { Pool, QueryResult } from 'pg';
import logger from './logger.js';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'quantis',
  user: process.env.DB_USER || 'quantis',
  password: process.env.DB_PASSWORD || 'quantis',
  min: parseInt(process.env.DB_POOL_MIN || '2', 10),
  max: parseInt(process.env.DB_POOL_MAX || '10', 10),
});

pool.on('error', (err) => {
  logger.error('Unexpected database pool error', { error: err.message });
});

export async function query(text: string, params?: unknown[]): Promise<QueryResult> {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  logger.debug('Executed query', { text, duration, rows: result.rowCount });
  return result;
}

export default pool;
