import type { Timeframe } from '../types/index.js';
import { UserTier } from '../types/index.js';

// ── Timeframes ──────────────────────────────────────────────────────

export const ALL_TIMEFRAMES: Timeframe[] = [
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1H',
  '2H',
  '4H',
  '6H',
  '8H',
  '12H',
  '1D',
  '3D',
  '1W',
  '1M',
];

// ── Tier Limits ─────────────────────────────────────────────────────

export interface TierLimit {
  maxWatchlist: number;
  maxAlerts: number;
  maxSignalsPerWeek: number;
  maxChartPanes: number;
  maxTimeframes: Timeframe[];
  apiRateLimit: number;
}

export const TIER_LIMITS: Record<UserTier, TierLimit> = {
  [UserTier.STARTER]: {
    maxWatchlist: 3,
    maxAlerts: 3,
    maxSignalsPerWeek: 3,
    maxChartPanes: 1,
    maxTimeframes: ['1D'],
    apiRateLimit: 60,
  },
  [UserTier.TRADER]: {
    maxWatchlist: 20,
    maxAlerts: 20,
    maxSignalsPerWeek: -1,
    maxChartPanes: 2,
    maxTimeframes: ALL_TIMEFRAMES,
    apiRateLimit: 300,
  },
  [UserTier.PRO]: {
    maxWatchlist: -1,
    maxAlerts: -1,
    maxSignalsPerWeek: -1,
    maxChartPanes: 4,
    maxTimeframes: ALL_TIMEFRAMES,
    apiRateLimit: 1000,
  },
  [UserTier.INSTITUTIONAL]: {
    maxWatchlist: -1,
    maxAlerts: -1,
    maxSignalsPerWeek: -1,
    maxChartPanes: 4,
    maxTimeframes: ALL_TIMEFRAMES,
    apiRateLimit: -1,
  },
};

// ── Supported Exchanges ─────────────────────────────────────────────

export const SUPPORTED_EXCHANGES = ['binance', 'bybit', 'okx'] as const;

// ── WebSocket Events ────────────────────────────────────────────────

export const WS_EVENTS = {
  SUBSCRIBE_TICKER: 'subscribe:ticker',
  SUBSCRIBE_OHLCV: 'subscribe:ohlcv',
  SUBSCRIBE_SIGNALS: 'subscribe:signals',
  SUBSCRIBE_ALERTS: 'subscribe:alerts',
  SUBSCRIBE_WHALES: 'subscribe:whales',
  TICKER_UPDATE: 'ticker:update',
  OHLCV_UPDATE: 'ohlcv:update',
  SIGNAL_NEW: 'signal:new',
  SIGNAL_UPDATE: 'signal:update',
  ALERT_TRIGGERED: 'alert:triggered',
  WHALE_TRANSACTION: 'whale:transaction',
  LIQUIDATION_EVENT: 'liquidation:event',
} as const;
