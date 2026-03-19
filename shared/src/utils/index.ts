import { ALL_TIMEFRAMES } from '../constants/index.js';
import type { Timeframe } from '../types/index.js';

/**
 * Format a price value to a fixed number of decimal places.
 */
export function formatPrice(price: number, decimals: number = 2): string {
  return price.toFixed(decimals);
}

/**
 * Format a number as a percentage string with two decimal places and a % suffix.
 */
export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

/**
 * Format a large volume number with K / M / B suffixes.
 */
export function formatVolume(volume: number): string {
  if (volume >= 1_000_000_000) {
    return `${(volume / 1_000_000_000).toFixed(2)}B`;
  }
  if (volume >= 1_000_000) {
    return `${(volume / 1_000_000).toFixed(2)}M`;
  }
  if (volume >= 1_000) {
    return `${(volume / 1_000).toFixed(2)}K`;
  }
  return volume.toFixed(2);
}

/**
 * Type-guard that checks whether a string is a valid Timeframe.
 */
export function isValidTimeframe(tf: string): tf is Timeframe {
  return (ALL_TIMEFRAMES as readonly string[]).includes(tf);
}

/**
 * Returns a promise that resolves after the given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a unique identifier string.
 * Uses crypto.randomUUID when available, falls back to a timestamp-based id.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}
