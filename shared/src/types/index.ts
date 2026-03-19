// ── User & Profile ──────────────────────────────────────────────────

export enum UserTier {
  STARTER = 'STARTER',
  TRADER = 'TRADER',
  PRO = 'PRO',
  INSTITUTIONAL = 'INSTITUTIONAL',
}

export enum Language {
  EN = 'EN',
  UA = 'UA',
  RU = 'RU',
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  tier: UserTier;
  language: Language;
  is2faEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum ExperienceLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
}

export interface UserProfile {
  userId: string;
  displayName: string;
  timezone: string;
  balanceUsdt: number;
  referralCode: string;
  experienceLevel: ExperienceLevel;
  uiMode: string;
}

// ── Subscription & Payment ──────────────────────────────────────────

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
  GRACE_PERIOD = 'GRACE_PERIOD',
}

export interface Subscription {
  id: string;
  userId: string;
  tier: UserTier;
  startsAt: Date;
  expiresAt: Date;
  status: SubscriptionStatus;
  autoRenew: boolean;
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export interface Payment {
  id: string;
  userId: string;
  amountUsd: number;
  cryptoCurrency: string;
  cryptoAmount: number;
  txHash: string;
  gatewayPaymentId: string;
  status: PaymentStatus;
  createdAt: Date;
}

// ── Exchange & Trading ──────────────────────────────────────────────

export interface Exchange {
  id: string;
  name: string;
  apiBaseUrl: string;
  wsUrl: string;
  status: string;
}

export interface TradingPair {
  id: string;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  exchangeId: string;
  isActive: boolean;
}

export interface OHLCV {
  time: Date;
  pairId: string;
  exchangeId: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  trades: number;
}

export type Timeframe =
  | '1m'
  | '3m'
  | '5m'
  | '15m'
  | '30m'
  | '1H'
  | '2H'
  | '4H'
  | '6H'
  | '8H'
  | '12H'
  | '1D'
  | '3D'
  | '1W'
  | '1M';

// ── Signals ─────────────────────────────────────────────────────────

export enum SignalType {
  BUY = 'BUY',
  SELL = 'SELL',
  CLOSE = 'CLOSE',
}

export enum SignalStrength {
  WEAK = 'WEAK',
  MEDIUM = 'MEDIUM',
  STRONG = 'STRONG',
}

export enum SignalStatus {
  ACTIVE = 'ACTIVE',
  TRIGGERED = 'TRIGGERED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export interface Signal {
  id: string;
  pairId: string;
  exchangeId: string;
  strategy: string;
  type: SignalType;
  strength: SignalStrength;
  entryPrice: number;
  stopLoss: number;
  tp1: number;
  tp2: number;
  tp3: number;
  confidence: number;
  sourcesJson: string;
  reasoning: string;
  timeframe: Timeframe;
  status: SignalStatus;
  resultPnl: number;
  createdAt: Date;
  expiresAt: Date;
}

// ── Alerts ──────────────────────────────────────────────────────────

export interface Alert {
  id: string;
  userId: string;
  name: string;
  conditionsJson: string;
  channelsJson: string;
  isActive: boolean;
  cooldownSeconds: number;
  lastTriggeredAt: Date;
}

export interface AlertHistory {
  id: string;
  alertId: string;
  triggeredAt: Date;
  snapshotJson: string;
  deliveryStatus: string;
}

// ── Watchlist ───────────────────────────────────────────────────────

export interface Watchlist {
  userId: string;
  pairId: string;
  addedAt: Date;
}

// ── API Response ────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
