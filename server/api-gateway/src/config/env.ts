/**
 * Environment variable validation and typed access.
 *
 * Import this module early (before other config modules) to fail fast
 * if required variables are missing.
 *
 *   import { env } from './config/env.js';
 */

import dotenv from 'dotenv';
dotenv.config();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        'See .env.example for the full list of required variables.',
    );
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value !== undefined && value !== '' ? value : fallback;
}

function optionalInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a valid integer, got "${raw}"`);
  }
  return parsed;
}

function optionalBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return raw === 'true' || raw === '1';
}

// ---------------------------------------------------------------------------
// Validation & typed config
// ---------------------------------------------------------------------------

function validateEnv() {
  const isProduction = process.env.NODE_ENV === 'production';

  // -- Database (always required) --
  const DB_HOST = optional('DB_HOST', 'localhost');
  const DB_PORT = optionalInt('DB_PORT', 5432);
  const DB_NAME = optional('DB_NAME', 'quantis');
  const DB_USER = optional('DB_USER', 'quantis');
  // In production, DB_PASSWORD must be explicitly set
  const DB_PASSWORD = isProduction
    ? required('DB_PASSWORD')
    : optional('DB_PASSWORD', 'quantis');
  const DB_SSL = optionalBool('DB_SSL', false);
  const DB_POOL_MIN = optionalInt('DB_POOL_MIN', 2);
  const DB_POOL_MAX = optionalInt('DB_POOL_MAX', 10);

  // -- Redis --
  const REDIS_HOST = optional('REDIS_HOST', 'localhost');
  const REDIS_PORT = optionalInt('REDIS_PORT', 6379);
  const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
  const REDIS_DB = optionalInt('REDIS_DB', 0);

  // -- JWT (always required — no safe default) --
  const JWT_ACCESS_SECRET = required('JWT_ACCESS_SECRET');
  const JWT_REFRESH_SECRET = required('JWT_REFRESH_SECRET');
  const JWT_ACCESS_EXPIRY = optional('JWT_ACCESS_EXPIRY', '15m');
  const JWT_REFRESH_EXPIRY = optional('JWT_REFRESH_EXPIRY', '7d');

  // Warn if JWT secrets look like placeholder values in production
  if (isProduction) {
    const placeholders = ['your-access-secret', 'your-refresh-secret', 'change-in-production'];
    for (const ph of placeholders) {
      if (JWT_ACCESS_SECRET.includes(ph) || JWT_REFRESH_SECRET.includes(ph)) {
        throw new Error(
          'JWT secrets contain placeholder values. ' +
            'Generate strong random secrets for production (e.g. openssl rand -base64 64).',
        );
      }
    }

    // Minimum length check for production JWT secrets
    if (JWT_ACCESS_SECRET.length < 32 || JWT_REFRESH_SECRET.length < 32) {
      throw new Error(
        'JWT secrets must be at least 32 characters in production. ' +
          'Generate strong random secrets (e.g. openssl rand -base64 64).',
      );
    }
  }

  // -- Bcrypt --
  const BCRYPT_ROUNDS = optionalInt('BCRYPT_ROUNDS', 12);

  // -- Application --
  const NODE_ENV = optional('NODE_ENV', 'development');
  const APP_PORT = optionalInt('APP_PORT', 3001);
  const APP_URL = optional('APP_URL', 'http://localhost:5173');
  const LOG_LEVEL = optional('LOG_LEVEL', 'info');

  const CORS_ORIGINS = optional('CORS_ORIGINS', 'http://localhost:5173,http://localhost:3001')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  // -- SMTP (optional — only needed for email features) --
  const SMTP_HOST = process.env.SMTP_HOST || undefined;
  const SMTP_PORT = optionalInt('SMTP_PORT', 587);
  const SMTP_SECURE = optionalBool('SMTP_SECURE', false);
  const SMTP_USER = process.env.SMTP_USER || undefined;
  const SMTP_PASS = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || undefined;
  const SMTP_FROM = optional('SMTP_FROM', 'noreply@quantis.io');

  // -- AI Copilot (optional) --
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || undefined;
  const ANTHROPIC_MODEL = optional('ANTHROPIC_MODEL', 'claude-sonnet-4-20250514');
  const COPILOT_MAX_TOKENS = optionalInt('COPILOT_MAX_TOKENS', 2000);
  const COPILOT_TEMPERATURE = parseFloat(optional('COPILOT_TEMPERATURE', '0.3'));

  // -- Payment (NOWPayments) --
  const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY || undefined;
  const NOWPAYMENTS_IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET || undefined;
  const NOWPAYMENTS_SANDBOX = optionalBool('NOWPAYMENTS_SANDBOX', true);

  // -- Telegram --
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || undefined;

  // -- Admin --
  const ADMIN_EMAILS = optional('ADMIN_EMAILS', '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  // -- Monitoring --
  const SENTRY_DSN = process.env.SENTRY_DSN || undefined;

  // -- Exchange API URLs --
  const BINANCE_API_URL = optional('BINANCE_API_URL', 'https://api.binance.com');
  const BINANCE_WS_URL = optional('BINANCE_WS_URL', 'wss://stream.binance.com:9443');
  const BYBIT_API_URL = optional('BYBIT_API_URL', 'https://api.bybit.com');
  const BYBIT_WS_URL = optional('BYBIT_WS_URL', 'wss://stream.bybit.com');
  const OKX_API_URL = optional('OKX_API_URL', 'https://www.okx.com');
  const OKX_WS_URL = optional('OKX_WS_URL', 'wss://ws.okx.com:8443');

  // -- Encryption --
  const API_KEY_ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_KEY || undefined;

  return Object.freeze({
    // Node / app
    NODE_ENV,
    isProduction,
    isDevelopment: NODE_ENV === 'development',
    APP_PORT,
    APP_URL,
    LOG_LEVEL,
    CORS_ORIGINS,

    // Database
    DB_HOST,
    DB_PORT,
    DB_NAME,
    DB_USER,
    DB_PASSWORD,
    DB_SSL,
    DB_POOL_MIN,
    DB_POOL_MAX,

    // Redis
    REDIS_HOST,
    REDIS_PORT,
    REDIS_PASSWORD,
    REDIS_DB,

    // Auth / JWT
    JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET,
    JWT_ACCESS_EXPIRY,
    JWT_REFRESH_EXPIRY,
    BCRYPT_ROUNDS,

    // SMTP
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASS,
    SMTP_FROM,

    // AI
    ANTHROPIC_API_KEY,
    ANTHROPIC_MODEL,
    COPILOT_MAX_TOKENS,
    COPILOT_TEMPERATURE,

    // Payments
    NOWPAYMENTS_API_KEY,
    NOWPAYMENTS_IPN_SECRET,
    NOWPAYMENTS_SANDBOX,

    // Telegram
    TELEGRAM_BOT_TOKEN,

    // Admin
    ADMIN_EMAILS,

    // Monitoring
    SENTRY_DSN,

    // Exchanges
    BINANCE_API_URL,
    BINANCE_WS_URL,
    BYBIT_API_URL,
    BYBIT_WS_URL,
    OKX_API_URL,
    OKX_WS_URL,

    // Encryption
    API_KEY_ENCRYPTION_KEY,
  });
}

// Run validation immediately on import
export const env = validateEnv();

// Re-export type for external use
export type Env = typeof env;
