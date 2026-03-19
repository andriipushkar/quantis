import {
  bullishengulfingpattern,
  bearishengulfingpattern,
  doji,
  hammer,
  hangingman,
  shootingstar,
  morningstar,
  eveningstar,
  invertedhammer,
} from 'technicalindicators';

export interface CandleInput {
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface PatternResult {
  name: string;
  type: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  index: number;
}

interface PatternDefinition {
  name: string;
  type: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  // Number of candles the pattern needs
  lookback: number;
  detect: (input: { open: number[]; high: number[]; low: number[]; close: number[] }) => boolean;
}

const PATTERNS: PatternDefinition[] = [
  {
    name: 'Hammer',
    type: 'bullish',
    confidence: 0.7,
    lookback: 1,
    detect: (input) => hammer(input),
  },
  {
    name: 'InvertedHammer',
    type: 'bullish',
    confidence: 0.65,
    lookback: 1,
    detect: (input) => invertedhammer(input),
  },
  {
    name: 'BullishEngulfing',
    type: 'bullish',
    confidence: 0.75,
    lookback: 2,
    detect: (input) => bullishengulfingpattern(input),
  },
  {
    name: 'BearishEngulfing',
    type: 'bearish',
    confidence: 0.75,
    lookback: 2,
    detect: (input) => bearishengulfingpattern(input),
  },
  {
    name: 'Doji',
    type: 'neutral',
    confidence: 0.6,
    lookback: 1,
    detect: (input) => doji(input),
  },
  {
    name: 'MorningStar',
    type: 'bullish',
    confidence: 0.8,
    lookback: 3,
    detect: (input) => morningstar(input),
  },
  {
    name: 'EveningStar',
    type: 'bearish',
    confidence: 0.8,
    lookback: 3,
    detect: (input) => eveningstar(input),
  },
  {
    name: 'ShootingStar',
    type: 'bearish',
    confidence: 0.7,
    lookback: 1,
    detect: (input) => shootingstar(input),
  },
  {
    name: 'HangingMan',
    type: 'bearish',
    confidence: 0.65,
    lookback: 1,
    detect: (input) => hangingman(input),
  },
];

/**
 * Detects candlestick patterns in the provided OHLCV candle data.
 * Scans from oldest to newest, checking each window for every known pattern.
 */
export function detectCandlestickPatterns(candles: CandleInput[]): PatternResult[] {
  if (candles.length < 1) return [];

  const results: PatternResult[] = [];

  for (const pattern of PATTERNS) {
    // Slide a window of `lookback` candles across the data
    for (let i = pattern.lookback - 1; i < candles.length; i++) {
      const window = candles.slice(i - pattern.lookback + 1, i + 1);

      const input = {
        open: window.map((c) => c.open),
        high: window.map((c) => c.high),
        low: window.map((c) => c.low),
        close: window.map((c) => c.close),
      };

      try {
        const detected = pattern.detect(input);
        if (detected) {
          results.push({
            name: pattern.name,
            type: pattern.type,
            confidence: pattern.confidence,
            index: i,
          });
        }
      } catch {
        // Some patterns may throw on edge cases; skip silently
      }
    }
  }

  return results;
}
