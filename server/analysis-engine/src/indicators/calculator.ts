import {
  SMA,
  EMA,
  RSI,
  MACD,
  BollingerBands,
  ATR,
  Stochastic,
  OBV,
  VWAP,
} from 'technicalindicators';

export class IndicatorCalculator {
  /**
   * Simple Moving Average
   */
  calculateSMA(closes: number[], period: number): number[] {
    if (closes.length < period) return [];
    return SMA.calculate({ period, values: closes });
  }

  /**
   * Exponential Moving Average
   */
  calculateEMA(closes: number[], period: number): number[] {
    if (closes.length < period) return [];
    return EMA.calculate({ period, values: closes });
  }

  /**
   * Relative Strength Index
   */
  calculateRSI(closes: number[], period: number = 14): number[] {
    if (closes.length < period + 1) return [];
    return RSI.calculate({ period, values: closes });
  }

  /**
   * Moving Average Convergence Divergence
   */
  calculateMACD(
    closes: number[],
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9,
  ): { macd: number[]; signal: number[]; histogram: number[] } {
    if (closes.length < slowPeriod + signalPeriod) {
      return { macd: [], signal: [], histogram: [] };
    }

    const result = MACD.calculate({
      values: closes,
      fastPeriod,
      slowPeriod,
      signalPeriod,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });

    const macd: number[] = [];
    const signal: number[] = [];
    const histogram: number[] = [];

    for (const r of result) {
      // MACD library can return undefined for early values
      if (r.MACD !== undefined && r.signal !== undefined && r.histogram !== undefined) {
        macd.push(r.MACD);
        signal.push(r.signal);
        histogram.push(r.histogram);
      }
    }

    return { macd, signal, histogram };
  }

  /**
   * Bollinger Bands
   */
  calculateBollingerBands(
    closes: number[],
    period: number = 20,
    stdDev: number = 2,
  ): { upper: number[]; middle: number[]; lower: number[] } {
    if (closes.length < period) {
      return { upper: [], middle: [], lower: [] };
    }

    const result = BollingerBands.calculate({
      period,
      values: closes,
      stdDev,
    });

    const upper: number[] = [];
    const middle: number[] = [];
    const lower: number[] = [];

    for (const r of result) {
      upper.push(r.upper);
      middle.push(r.middle);
      lower.push(r.lower);
    }

    return { upper, middle, lower };
  }

  /**
   * Average True Range
   */
  calculateATR(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number = 14,
  ): number[] {
    const len = Math.min(highs.length, lows.length, closes.length);
    if (len < period + 1) return [];

    return ATR.calculate({
      high: highs.slice(0, len),
      low: lows.slice(0, len),
      close: closes.slice(0, len),
      period,
    });
  }

  /**
   * Stochastic Oscillator
   */
  calculateStochastic(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number = 14,
    signalPeriod: number = 3,
    smoothPeriod: number = 3,
  ): { k: number[]; d: number[] } {
    const len = Math.min(highs.length, lows.length, closes.length);
    if (len < period + signalPeriod + smoothPeriod - 2) {
      return { k: [], d: [] };
    }

    const result = Stochastic.calculate({
      high: highs.slice(0, len),
      low: lows.slice(0, len),
      close: closes.slice(0, len),
      period,
      signalPeriod,
    });

    const k: number[] = [];
    const d: number[] = [];

    for (const r of result) {
      if (r.k !== undefined && r.d !== undefined) {
        k.push(r.k);
        d.push(r.d);
      }
    }

    return { k, d };
  }

  /**
   * On-Balance Volume
   */
  calculateOBV(closes: number[], volumes: number[]): number[] {
    const len = Math.min(closes.length, volumes.length);
    if (len < 2) return [];

    return OBV.calculate({
      close: closes.slice(0, len),
      volume: volumes.slice(0, len),
    });
  }

  /**
   * Volume Weighted Average Price
   * VWAP is calculated as cumulative(typical_price * volume) / cumulative(volume)
   * where typical_price = (high + low + close) / 3
   */
  calculateVWAP(
    highs: number[],
    lows: number[],
    closes: number[],
    volumes: number[],
  ): number[] {
    const len = Math.min(highs.length, lows.length, closes.length, volumes.length);
    if (len < 1) return [];

    // The technicalindicators VWAP expects a specific input format.
    // We compute it manually for reliability and clarity.
    const vwapValues: number[] = [];
    let cumulativeTPV = 0;
    let cumulativeVolume = 0;

    for (let i = 0; i < len; i++) {
      const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
      cumulativeTPV += typicalPrice * volumes[i];
      cumulativeVolume += volumes[i];

      if (cumulativeVolume === 0) {
        vwapValues.push(typicalPrice);
      } else {
        vwapValues.push(cumulativeTPV / cumulativeVolume);
      }
    }

    return vwapValues;
  }
}

export default new IndicatorCalculator();
