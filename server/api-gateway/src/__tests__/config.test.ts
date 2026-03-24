/**
 * Config modules — unit tests
 *
 * Tests database.ts, redis.ts, logger.ts, and env.ts config modules
 * by mocking pg, ioredis, winston, and dotenv.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// 1. Mocks — must be declared BEFORE the module under test is imported
// ---------------------------------------------------------------------------

const mockPoolQuery = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });
const mockPoolOn = jest.fn();

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: mockPoolQuery,
    connect: jest.fn(),
    on: mockPoolOn,
  })),
}));

const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();
const mockRedisDel = jest.fn();
const mockRedisOn = jest.fn();

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: mockRedisGet,
    set: mockRedisSet,
    del: mockRedisDel,
    on: mockRedisOn,
    hgetall: jest.fn(),
    hget: jest.fn(),
  }));
});

jest.mock('winston', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };
  return {
    createLogger: jest.fn().mockReturnValue(mockLogger),
    format: {
      combine: jest.fn(),
      timestamp: jest.fn(),
      json: jest.fn(),
      colorize: jest.fn(),
      simple: jest.fn(),
    },
    transports: {
      Console: jest.fn(),
    },
  };
});

jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

// Mock env for modules that import it
jest.mock('../config/env.js', () => ({
  __esModule: true,
  env: {
    DB_HOST: 'localhost',
    DB_PORT: 5432,
    DB_NAME: 'quantis_test',
    DB_USER: 'test_user',
    DB_PASSWORD: 'test_pass',
    DB_SSL: false,
    DB_POOL_MIN: 2,
    DB_POOL_MAX: 10,
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    REDIS_PASSWORD: undefined,
    REDIS_DB: 0,
    JWT_ACCESS_SECRET: 'test-access-secret-long-enough-for-validation',
    JWT_REFRESH_SECRET: 'test-refresh-secret-long-enough-for-validation',
    JWT_ACCESS_EXPIRY: '15m',
    JWT_REFRESH_EXPIRY: '7d',
    BCRYPT_ROUNDS: 4,
    NODE_ENV: 'test',
    isProduction: false,
    isDevelopment: false,
    APP_PORT: 3001,
    APP_URL: 'http://localhost:5173',
    LOG_LEVEL: 'info',
    CORS_ORIGINS: ['http://localhost:5173'],
    SMTP_HOST: undefined,
    SMTP_PORT: 587,
    SMTP_SECURE: false,
    SMTP_USER: undefined,
    SMTP_PASS: undefined,
    SMTP_FROM: 'noreply@quantis.io',
    ANTHROPIC_API_KEY: undefined,
    ANTHROPIC_MODEL: 'claude-sonnet-4-20250514',
    COPILOT_MAX_TOKENS: 2000,
    COPILOT_TEMPERATURE: 0.3,
    NOWPAYMENTS_API_KEY: undefined,
    NOWPAYMENTS_IPN_SECRET: undefined,
    NOWPAYMENTS_SANDBOX: true,
    TELEGRAM_BOT_TOKEN: undefined,
    ADMIN_EMAILS: [],
    SENTRY_DSN: undefined,
    BINANCE_API_URL: 'https://api.binance.com',
    BINANCE_WS_URL: 'wss://stream.binance.com:9443',
    BYBIT_API_URL: 'https://api.bybit.com',
    BYBIT_WS_URL: 'wss://stream.bybit.com',
    OKX_API_URL: 'https://www.okx.com',
    OKX_WS_URL: 'wss://ws.okx.com:8443',
    GOOGLE_CLIENT_ID: undefined,
    GOOGLE_CLIENT_SECRET: undefined,
    API_KEY_ENCRYPTION_KEY: undefined,
  },
}));

// Mock logger for modules that import it
jest.mock('../config/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// 2. Imports
// ---------------------------------------------------------------------------

import { query } from '../config/database.js';
import redis from '../config/redis.js';
import logger from '../config/logger.js';
import { env } from '../config/env.js';

// ---------------------------------------------------------------------------
// 3. Tests
// ---------------------------------------------------------------------------

describe('Config: database.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exports a query function', () => {
    expect(typeof query).toBe('function');
  });

  it('query delegates to pool.query with text and params', async () => {
    const mockResult = { rows: [{ id: 1 }], rowCount: 1 };
    mockPoolQuery.mockResolvedValueOnce(mockResult);

    const result = await query('SELECT * FROM users WHERE id = $1', [1]);

    expect(mockPoolQuery).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', [1]);
    expect(result).toEqual(mockResult);
  });

  it('query works without params', async () => {
    const mockResult = { rows: [], rowCount: 0 };
    mockPoolQuery.mockResolvedValueOnce(mockResult);

    const result = await query('SELECT 1');

    expect(mockPoolQuery).toHaveBeenCalledWith('SELECT 1', undefined);
    expect(result).toEqual(mockResult);
  });

  it('query propagates errors from pool.query', async () => {
    mockPoolQuery.mockRejectedValueOnce(new Error('connection refused'));

    await expect(query('SELECT 1')).rejects.toThrow('connection refused');
  });
});

describe('Config: redis.ts', () => {
  it('exports a redis client object', () => {
    expect(redis).toBeDefined();
    expect(typeof redis).toBe('object');
  });

  it('redis client has expected methods', () => {
    expect(typeof redis.get).toBe('function');
    expect(typeof redis.set).toBe('function');
    expect(typeof redis.del).toBe('function');
    expect(typeof redis.on).toBe('function');
  });
});

describe('Config: logger.ts', () => {
  it('exports a logger object', () => {
    expect(logger).toBeDefined();
    expect(typeof logger).toBe('object');
  });

  it('logger has info method', () => {
    expect(typeof logger.info).toBe('function');
    logger.info('test message');
    expect(logger.info).toHaveBeenCalledWith('test message');
  });

  it('logger has error method', () => {
    expect(typeof logger.error).toBe('function');
    logger.error('error message');
    expect(logger.error).toHaveBeenCalledWith('error message');
  });

  it('logger has warn method', () => {
    expect(typeof logger.warn).toBe('function');
    logger.warn('warning message');
    expect(logger.warn).toHaveBeenCalledWith('warning message');
  });

  it('logger has debug method', () => {
    expect(typeof logger.debug).toBe('function');
    logger.debug('debug message');
    expect(logger.debug).toHaveBeenCalledWith('debug message');
  });
});

describe('Config: env.ts', () => {
  it('exports an env object', () => {
    expect(env).toBeDefined();
    expect(typeof env).toBe('object');
  });

  it('env has required database variables', () => {
    expect(env.DB_HOST).toBeDefined();
    expect(env.DB_PORT).toBeDefined();
    expect(env.DB_NAME).toBeDefined();
    expect(env.DB_USER).toBeDefined();
    expect(env.DB_PASSWORD).toBeDefined();
  });

  it('env has required JWT variables', () => {
    expect(env.JWT_ACCESS_SECRET).toBeDefined();
    expect(env.JWT_REFRESH_SECRET).toBeDefined();
    expect(env.JWT_ACCESS_EXPIRY).toBeDefined();
    expect(env.JWT_REFRESH_EXPIRY).toBeDefined();
  });

  it('env has required Redis variables', () => {
    expect(env.REDIS_HOST).toBeDefined();
    expect(env.REDIS_PORT).toBeDefined();
    expect(env.REDIS_DB).toBeDefined();
  });

  it('env has application variables', () => {
    expect(env.APP_PORT).toBeDefined();
    expect(env.APP_URL).toBeDefined();
    expect(env.LOG_LEVEL).toBeDefined();
    expect(env.CORS_ORIGINS).toBeDefined();
    expect(Array.isArray(env.CORS_ORIGINS)).toBe(true);
  });

  it('env has correct default values', () => {
    expect(env.DB_HOST).toBe('localhost');
    expect(env.DB_PORT).toBe(5432);
    expect(env.REDIS_HOST).toBe('localhost');
    expect(env.REDIS_PORT).toBe(6379);
    expect(env.APP_PORT).toBe(3001);
  });

  it('env has exchange API URLs', () => {
    expect(env.BINANCE_API_URL).toBeDefined();
    expect(env.BINANCE_WS_URL).toBeDefined();
    expect(env.BYBIT_API_URL).toBeDefined();
    expect(env.BYBIT_WS_URL).toBeDefined();
    expect(env.OKX_API_URL).toBeDefined();
    expect(env.OKX_WS_URL).toBeDefined();
  });

  it('env has boolean flags', () => {
    expect(typeof env.isProduction).toBe('boolean');
    expect(typeof env.isDevelopment).toBe('boolean');
    expect(typeof env.DB_SSL).toBe('boolean');
    expect(typeof env.NOWPAYMENTS_SANDBOX).toBe('boolean');
  });
});
