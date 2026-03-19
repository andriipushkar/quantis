import { query } from '../config/database.js';
import { publisherClient } from '../config/redis.js';
import logger from '../config/logger.js';
import calculator from './calculator.js';

export interface IndicatorResults {
  pairId: number;
  timeframe: string;
  timestamp: string;
  sma20: number[];
  sma50: number[];
  ema9: number[];
  ema21: number[];
  rsi14: number[];
  macd: { macd: number[]; signal: number[]; histogram: number[] };
  bollingerBands: { upper: number[]; middle: number[]; lower: number[] };
  atr14: number[];
  stochastic: { k: number[]; d: number[] };
  obv: number[];
  vwap: number[];
}

const CACHE_TTL_SECONDS = 60;
const OHLCV_LOOKBACK = 200; // Number of candles to fetch for indicator calculation

function cacheKey(pairId: number, timeframe: string): string {
  return `indicators:${pairId}:${timeframe}`;
}

/**
 * Fetches recent OHLCV data from the database for a given pair and timeframe.
 */
async function fetchOHLCV(pairId: number, timeframe: string) {
  const result = await query(
    `SELECT time, open, high, low, close, volume
     FROM ohlcv
     WHERE pair_id = $1 AND timeframe = $2
     ORDER BY time DESC
     LIMIT $3`,
    [pairId, timeframe, OHLCV_LOOKBACK],
  );

  // Reverse so oldest is first (ascending time order)
  const rows = result.rows.reverse();

  return {
    times: rows.map((r: any) => r.time),
    opens: rows.map((r: any) => parseFloat(r.open)),
    highs: rows.map((r: any) => parseFloat(r.high)),
    lows: rows.map((r: any) => parseFloat(r.low)),
    closes: rows.map((r: any) => parseFloat(r.close)),
    volumes: rows.map((r: any) => parseFloat(r.volume)),
  };
}

/**
 * Calculates all technical indicators for a trading pair and timeframe.
 * Results are cached in Redis and stored in the database.
 */
export async function calculateAllIndicators(
  pairId: number,
  timeframe: string,
): Promise<IndicatorResults | null> {
  try {
    const ohlcv = await fetchOHLCV(pairId, timeframe);

    if (ohlcv.closes.length < 2) {
      logger.warn('Insufficient OHLCV data for indicator calculation', {
        pairId,
        timeframe,
        dataPoints: ohlcv.closes.length,
      });
      return null;
    }

    const results: IndicatorResults = {
      pairId,
      timeframe,
      timestamp: new Date().toISOString(),
      sma20: calculator.calculateSMA(ohlcv.closes, 20),
      sma50: calculator.calculateSMA(ohlcv.closes, 50),
      ema9: calculator.calculateEMA(ohlcv.closes, 9),
      ema21: calculator.calculateEMA(ohlcv.closes, 21),
      rsi14: calculator.calculateRSI(ohlcv.closes, 14),
      macd: calculator.calculateMACD(ohlcv.closes),
      bollingerBands: calculator.calculateBollingerBands(ohlcv.closes),
      atr14: calculator.calculateATR(ohlcv.highs, ohlcv.lows, ohlcv.closes, 14),
      stochastic: calculator.calculateStochastic(ohlcv.highs, ohlcv.lows, ohlcv.closes),
      obv: calculator.calculateOBV(ohlcv.closes, ohlcv.volumes),
      vwap: calculator.calculateVWAP(ohlcv.highs, ohlcv.lows, ohlcv.closes, ohlcv.volumes),
    };

    // Cache in Redis
    const key = cacheKey(pairId, timeframe);
    await publisherClient.set(key, JSON.stringify(results), 'EX', CACHE_TTL_SECONDS);

    // Store latest indicator snapshot in the database
    await query(
      `INSERT INTO indicators (pair_id, timeframe, indicator_data, calculated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (pair_id, timeframe)
       DO UPDATE SET indicator_data = $3, calculated_at = NOW()`,
      [pairId, timeframe, JSON.stringify(results)],
    );

    logger.debug('Indicators calculated and cached', { pairId, timeframe });

    return results;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to calculate indicators', { pairId, timeframe, error: message });
    return null;
  }
}

/**
 * Returns calculated indicator values for a pair.
 * Reads from Redis cache first; recalculates on cache miss.
 */
export async function getIndicatorsForPair(
  pairId: number,
  timeframe: string,
  indicators: string[],
): Promise<Partial<IndicatorResults> | null> {
  try {
    const key = cacheKey(pairId, timeframe);
    const cached = await publisherClient.get(key);

    let allResults: IndicatorResults;

    if (cached) {
      allResults = JSON.parse(cached);
    } else {
      const calculated = await calculateAllIndicators(pairId, timeframe);
      if (!calculated) return null;
      allResults = calculated;
    }

    // Filter to requested indicators only
    if (indicators.length === 0) return allResults;

    const filtered: Partial<IndicatorResults> = {
      pairId: allResults.pairId,
      timeframe: allResults.timeframe,
      timestamp: allResults.timestamp,
    };

    for (const ind of indicators) {
      const normalised = ind.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalised === 'sma20') filtered.sma20 = allResults.sma20;
      else if (normalised === 'sma50') filtered.sma50 = allResults.sma50;
      else if (normalised === 'ema9') filtered.ema9 = allResults.ema9;
      else if (normalised === 'ema21') filtered.ema21 = allResults.ema21;
      else if (normalised === 'rsi14' || normalised === 'rsi') filtered.rsi14 = allResults.rsi14;
      else if (normalised === 'macd') filtered.macd = allResults.macd;
      else if (normalised === 'bollingerbands' || normalised === 'bb') filtered.bollingerBands = allResults.bollingerBands;
      else if (normalised === 'atr14' || normalised === 'atr') filtered.atr14 = allResults.atr14;
      else if (normalised === 'stochastic' || normalised === 'stoch') filtered.stochastic = allResults.stochastic;
      else if (normalised === 'obv') filtered.obv = allResults.obv;
      else if (normalised === 'vwap') filtered.vwap = allResults.vwap;
    }

    return filtered;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to get indicators for pair', { pairId, timeframe, error: message });
    return null;
  }
}
