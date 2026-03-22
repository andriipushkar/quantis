/**
 * Lightweight indicator calculation helpers for the API gateway.
 * These use simple array math (no external libraries) and are shared
 * across route files that need basic RSI / EMA / SMA / Bollinger Bands.
 */

/** Wilder-smoothed RSI returning the full series. */
export function calculateRSI(closes: number[], period: number): number[] {
  if (closes.length < period + 1) return [];
  const rsi: number[] = [];
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;

  rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? Math.abs(diff) : 0)) / period;
    rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }

  return rsi;
}

/** Exponential Moving Average returning the full series. */
export function calculateEMA(data: number[], period: number): number[] {
  if (data.length < period) return [];
  const k = 2 / (period + 1);
  const ema: number[] = [];
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i];
  ema.push(sum / period);
  for (let i = period; i < data.length; i++) {
    ema.push(data[i] * k + ema[ema.length - 1] * (1 - k));
  }
  return ema;
}

/** Simple Moving Average returning the full series. */
export function calculateSMA(data: number[], period: number): number[] {
  if (data.length < period) return [];
  const sma: number[] = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += data[j];
    sma.push(sum / period);
  }
  return sma;
}

/** Bollinger Bands (upper, middle SMA, lower). */
export function calculateBB(data: number[], period: number, mult: number) {
  const middle = calculateSMA(data, period);
  const upper: number[] = [];
  const lower: number[] = [];
  for (let i = 0; i < middle.length; i++) {
    const slice = data.slice(i, i + period);
    const mean = middle[i];
    const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period;
    const std = Math.sqrt(variance);
    upper.push(mean + mult * std);
    lower.push(mean - mult * std);
  }
  return { upper, middle, lower };
}

/**
 * Compute RSI returning only the latest value (or null if not enough data).
 * Used by routes that need a single current RSI reading.
 */
export function computeRSI(closes: number[], period: number = 14): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[closes.length - period - 1 + i] - closes[closes.length - period - 1 + i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round((100 - 100 / (1 + rs)) * 100) / 100;
}

/**
 * Compute EMA returning only the latest value (or null if not enough data).
 * Used by routes that need a single current EMA reading.
 */
export function computeEMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const k = 2 / (period + 1);
  let ema = closes[0];
  for (let i = 1; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return Math.round(ema * 100) / 100;
}
