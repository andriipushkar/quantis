export interface NormalizedKline {
  time: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  trades: number;
}

export interface BinanceRawKline {
  t: number;   // Open time (ms timestamp)
  T: number;   // Close time
  s: string;   // Symbol
  i: string;   // Interval
  f: number;   // First trade ID
  L: number;   // Last trade ID
  o: string;   // Open price
  c: string;   // Close price
  h: string;   // High price
  l: string;   // Low price
  v: string;   // Base asset volume
  n: number;   // Number of trades
  x: boolean;  // Is this kline closed?
  q: string;   // Quote asset volume
  V: string;   // Taker buy base asset volume
  Q: string;   // Taker buy quote asset volume
}

export function normalizeBinanceKline(raw: BinanceRawKline): NormalizedKline {
  return {
    time: new Date(raw.t),
    open: parseFloat(raw.o),
    high: parseFloat(raw.h),
    low: parseFloat(raw.l),
    close: parseFloat(raw.c),
    volume: parseFloat(raw.v),
    trades: raw.n,
  };
}

/**
 * Normalize Bybit kline data to standard format.
 * Stub implementation - to be completed when Bybit integration is added.
 */
export function normalizeBybitKline(raw: Record<string, unknown>): NormalizedKline {
  return {
    time: new Date(raw.start as number),
    open: parseFloat(String(raw.open ?? '0')),
    high: parseFloat(String(raw.high ?? '0')),
    low: parseFloat(String(raw.low ?? '0')),
    close: parseFloat(String(raw.close ?? '0')),
    volume: parseFloat(String(raw.volume ?? '0')),
    trades: Number(raw.turnover ?? 0),
  };
}

/**
 * Normalize OKX kline data to standard format.
 * Stub implementation - to be completed when OKX integration is added.
 */
export function normalizeOkxKline(raw: Record<string, unknown>): NormalizedKline {
  // OKX returns arrays: [ts, o, h, l, c, vol, volCcy, volCcyQuote, confirm]
  const arr = Array.isArray(raw) ? raw : (raw.data as unknown[]) ?? [];
  return {
    time: new Date(Number(arr[0] ?? 0)),
    open: parseFloat(String(arr[1] ?? '0')),
    high: parseFloat(String(arr[2] ?? '0')),
    low: parseFloat(String(arr[3] ?? '0')),
    close: parseFloat(String(arr[4] ?? '0')),
    volume: parseFloat(String(arr[5] ?? '0')),
    trades: 0, // OKX does not provide trade count in kline data
  };
}
