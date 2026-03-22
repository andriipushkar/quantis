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
  ADX,
  PSAR,
  IchimokuCloud,
  WMA,
  WEMA,
  KST,
  TRIX,
  WilliamsR,
  CCI,
  ROC,
  MFI,
  StochasticRSI,
  AwesomeOscillator,
  KeltnerChannels,
  SD,
  ADL,
  ForceIndex,
  VolumeProfile,
  HeikinAshi,
  renko,
} from 'technicalindicators';

// ─── Return Types ────────────────────────────────────────────────────────────

export interface MACDResult {
  macd: number[];
  signal: number[];
  histogram: number[];
}

export interface BollingerBandsResult {
  upper: number[];
  middle: number[];
  lower: number[];
}

export interface StochasticResult {
  k: number[];
  d: number[];
}

export interface ADXResult {
  adx: number[];
  pdi: number[];
  mdi: number[];
}

export interface IchimokuResult {
  tenkanSen: number[];
  kijunSen: number[];
  senkouSpanA: number[];
  senkouSpanB: number[];
  chikouSpan: number[];
}

export interface KSTResult {
  kst: number[];
  signal: number[];
}

export interface StochasticRSIResult {
  stochRSI: number[];
  k: number[];
  d: number[];
}

export interface KeltnerChannelsResult {
  upper: number[];
  middle: number[];
  lower: number[];
}

export interface ChandelierExitResult {
  exitLong: number[];
  exitShort: number[];
}

export interface DonchianChannelResult {
  upper: number[];
  middle: number[];
  lower: number[];
}

export interface VolumeProfileResult {
  rangeStart: number;
  rangeEnd: number;
  bullishVolume: number;
  bearishVolume: number;
}

export interface PivotPointsResult {
  pivot: number;
  s1: number;
  s2: number;
  s3: number;
  r1: number;
  r2: number;
  r3: number;
}

export interface FibonacciRetracementResult {
  level0: number;
  level236: number;
  level382: number;
  level500: number;
  level618: number;
  level786: number;
  level1000: number;
}

export interface HeikinAshiResult {
  open: number[];
  high: number[];
  low: number[];
  close: number[];
}

export interface RenkoBrick {
  open: number;
  close: number;
  high: number;
  low: number;
  uptrend: boolean;
}

export interface SupertrendResult {
  supertrend: number[];
  direction: number[]; // 1 = up (bullish), -1 = down (bearish)
}

export interface SqueezeMomentumResult {
  squeezOn: boolean[];
  momentum: number[];
}

export interface ElderRayResult {
  bullPower: number[];
  bearPower: number[];
}

// ─── Calculator Class ────────────────────────────────────────────────────────

export class IndicatorCalculator {
  // ═══════════════════════════════════════════════════════════════════════════
  //  EXISTING 9 INDICATORS (unchanged)
  // ═══════════════════════════════════════════════════════════════════════════

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
  ): MACDResult {
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
  ): BollingerBandsResult {
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
  ): StochasticResult {
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

  // ═══════════════════════════════════════════════════════════════════════════
  //  TREND INDICATORS (10 new)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Average Directional Index — measures trend strength (0-100)
   */
  calculateADX(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number = 14,
  ): ADXResult {
    const len = Math.min(highs.length, lows.length, closes.length);
    if (len < period * 2) return { adx: [], pdi: [], mdi: [] };

    const result = ADX.calculate({
      high: highs.slice(0, len),
      low: lows.slice(0, len),
      close: closes.slice(0, len),
      period,
    });

    const adx: number[] = [];
    const pdi: number[] = [];
    const mdi: number[] = [];

    for (const r of result) {
      adx.push(r.adx);
      pdi.push(r.pdi);
      mdi.push(r.mdi);
    }

    return { adx, pdi, mdi };
  }

  /**
   * Parabolic SAR — trailing stop-and-reverse system
   */
  calculatePSAR(
    highs: number[],
    lows: number[],
    closes: number[],
    step: number = 0.02,
    max: number = 0.2,
  ): number[] {
    const len = Math.min(highs.length, lows.length, closes.length);
    if (len < 2) return [];

    return PSAR.calculate({
      high: highs.slice(0, len),
      low: lows.slice(0, len),
      step,
      max,
    });
  }

  /**
   * Ichimoku Cloud — comprehensive trend, momentum, support/resistance system
   */
  calculateIchimokuCloud(
    highs: number[],
    lows: number[],
    closes: number[],
    conversionPeriod: number = 9,
    basePeriod: number = 26,
    spanPeriod: number = 52,
    displacement: number = 26,
  ): IchimokuResult {
    const len = Math.min(highs.length, lows.length, closes.length);
    if (len < spanPeriod) {
      return { tenkanSen: [], kijunSen: [], senkouSpanA: [], senkouSpanB: [], chikouSpan: [] };
    }

    const result = IchimokuCloud.calculate({
      high: highs.slice(0, len),
      low: lows.slice(0, len),
      conversionPeriod,
      basePeriod,
      spanPeriod,
      displacement,
    });

    const tenkanSen: number[] = [];
    const kijunSen: number[] = [];
    const senkouSpanA: number[] = [];
    const senkouSpanB: number[] = [];
    const chikouSpan: number[] = [];

    for (const r of result) {
      if (r.conversion !== undefined) tenkanSen.push(r.conversion);
      if (r.base !== undefined) kijunSen.push(r.base);
      if (r.spanA !== undefined) senkouSpanA.push(r.spanA);
      if (r.spanB !== undefined) senkouSpanB.push(r.spanB);
    }

    // Chikou Span is simply the close shifted back by displacement
    for (let i = displacement; i < len; i++) {
      chikouSpan.push(closes[i]);
    }

    return { tenkanSen, kijunSen, senkouSpanA, senkouSpanB, chikouSpan };
  }

  /**
   * Double Exponential Moving Average — reduces lag of standard EMA
   * DEMA = 2 * EMA(period) - EMA(EMA(period))
   */
  calculateDEMA(closes: number[], period: number = 21): number[] {
    if (closes.length < period * 2) return [];

    const ema1 = EMA.calculate({ period, values: closes });
    const ema2 = EMA.calculate({ period, values: ema1 });

    // Align: ema2 starts (period-1) values into ema1
    const offset = ema1.length - ema2.length;
    const result: number[] = [];

    for (let i = 0; i < ema2.length; i++) {
      result.push(2 * ema1[i + offset] - ema2[i]);
    }

    return result;
  }

  /**
   * Triple Exponential Moving Average — further reduces lag
   * TEMA = 3*EMA - 3*EMA(EMA) + EMA(EMA(EMA))
   */
  calculateTEMA(closes: number[], period: number = 21): number[] {
    if (closes.length < period * 3) return [];

    const ema1 = EMA.calculate({ period, values: closes });
    const ema2 = EMA.calculate({ period, values: ema1 });
    const ema3 = EMA.calculate({ period, values: ema2 });

    const offset12 = ema1.length - ema2.length;
    const offset23 = ema2.length - ema3.length;
    const totalOffset1 = offset12 + offset23;
    const result: number[] = [];

    for (let i = 0; i < ema3.length; i++) {
      result.push(
        3 * ema1[i + totalOffset1] - 3 * ema2[i + offset23] + ema3[i],
      );
    }

    return result;
  }

  /**
   * Weighted Moving Average — weights recent prices more heavily (linearly)
   */
  calculateWMA(closes: number[], period: number = 20): number[] {
    if (closes.length < period) return [];
    return WMA.calculate({ period, values: closes });
  }

  /**
   * Wilder's Exponential Moving Average — smoother EMA variant used in ATR/RSI
   */
  calculateWEMA(closes: number[], period: number = 14): number[] {
    if (closes.length < period) return [];
    return WEMA.calculate({ period, values: closes });
  }

  /**
   * Hull Moving Average — fast, smooth moving average that reduces lag
   * HMA = WMA(2*WMA(n/2) - WMA(n), sqrt(n))
   */
  calculateHMA(closes: number[], period: number = 20): number[] {
    const halfPeriod = Math.floor(period / 2);
    const sqrtPeriod = Math.round(Math.sqrt(period));
    if (closes.length < period + sqrtPeriod) return [];

    const wmaHalf = WMA.calculate({ period: halfPeriod, values: closes });
    const wmaFull = WMA.calculate({ period, values: closes });

    // Align arrays — wmaHalf is longer than wmaFull
    const offset = wmaHalf.length - wmaFull.length;
    const diff: number[] = [];

    for (let i = 0; i < wmaFull.length; i++) {
      diff.push(2 * wmaHalf[i + offset] - wmaFull[i]);
    }

    return WMA.calculate({ period: sqrtPeriod, values: diff });
  }

  /**
   * Know Sure Thing — momentum oscillator based on ROC of multiple timeframes
   */
  calculateKST(
    closes: number[],
    rocPer1: number = 10,
    rocPer2: number = 15,
    rocPer3: number = 20,
    rocPer4: number = 30,
    smaPer1: number = 10,
    smaPer2: number = 10,
    smaPer3: number = 10,
    smaPer4: number = 15,
    signalPeriod: number = 9,
  ): KSTResult {
    const minLen = rocPer4 + smaPer4 + signalPeriod;
    if (closes.length < minLen) return { kst: [], signal: [] };

    const result = KST.calculate({
      values: closes,
      ROCPer1: rocPer1,
      ROCPer2: rocPer2,
      ROCPer3: rocPer3,
      ROCPer4: rocPer4,
      SMAROCPer1: smaPer1,
      SMAROCPer2: smaPer2,
      SMAROCPer3: smaPer3,
      SMAROCPer4: smaPer4,
      signalPeriod,
    });

    const kst: number[] = [];
    const signal: number[] = [];

    for (const r of result) {
      if (r.kst !== undefined) kst.push(r.kst);
      if (r.signal !== undefined) signal.push(r.signal);
    }

    return { kst, signal };
  }

  /**
   * TRIX — triple-smoothed EMA rate of change; filters noise, shows trend
   */
  calculateTRIX(closes: number[], period: number = 15): number[] {
    if (closes.length < period * 3 + 1) return [];
    return TRIX.calculate({ period, values: closes });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  MOMENTUM INDICATORS (10 new)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Williams %R — overbought/oversold oscillator (range: -100 to 0)
   */
  calculateWilliamsR(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number = 14,
  ): number[] {
    const len = Math.min(highs.length, lows.length, closes.length);
    if (len < period) return [];

    return WilliamsR.calculate({
      high: highs.slice(0, len),
      low: lows.slice(0, len),
      close: closes.slice(0, len),
      period,
    });
  }

  /**
   * Commodity Channel Index — measures deviation from statistical mean
   */
  calculateCCI(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number = 20,
  ): number[] {
    const len = Math.min(highs.length, lows.length, closes.length);
    if (len < period) return [];

    return CCI.calculate({
      high: highs.slice(0, len),
      low: lows.slice(0, len),
      close: closes.slice(0, len),
      period,
    });
  }

  /**
   * Rate of Change — percentage change over n periods
   */
  calculateROC(closes: number[], period: number = 12): number[] {
    if (closes.length < period + 1) return [];
    return ROC.calculate({ period, values: closes });
  }

  /**
   * Money Flow Index — volume-weighted RSI (0-100)
   */
  calculateMFI(
    highs: number[],
    lows: number[],
    closes: number[],
    volumes: number[],
    period: number = 14,
  ): number[] {
    const len = Math.min(highs.length, lows.length, closes.length, volumes.length);
    if (len < period + 1) return [];

    return MFI.calculate({
      high: highs.slice(0, len),
      low: lows.slice(0, len),
      close: closes.slice(0, len),
      volume: volumes.slice(0, len),
      period,
    });
  }

  /**
   * Stochastic RSI — Stochastic oscillator applied to RSI values
   */
  calculateStochasticRSI(
    closes: number[],
    rsiPeriod: number = 14,
    stochasticPeriod: number = 14,
    kPeriod: number = 3,
    dPeriod: number = 3,
  ): StochasticRSIResult {
    if (closes.length < rsiPeriod + stochasticPeriod + kPeriod) {
      return { stochRSI: [], k: [], d: [] };
    }

    const result = StochasticRSI.calculate({
      values: closes,
      rsiPeriod,
      stochasticPeriod,
      kPeriod,
      dPeriod,
    });

    const stochRSI: number[] = [];
    const k: number[] = [];
    const d: number[] = [];

    for (const r of result) {
      if (r.stochRSI !== undefined) stochRSI.push(r.stochRSI);
      if (r.k !== undefined) k.push(r.k);
      if (r.d !== undefined) d.push(r.d);
    }

    return { stochRSI, k, d };
  }

  /**
   * Awesome Oscillator — difference between 5-period and 34-period SMA of median price
   */
  calculateAwesomeOscillator(
    highs: number[],
    lows: number[],
    fastPeriod: number = 5,
    slowPeriod: number = 34,
  ): number[] {
    const len = Math.min(highs.length, lows.length);
    if (len < slowPeriod) return [];

    return AwesomeOscillator.calculate({
      high: highs.slice(0, len),
      low: lows.slice(0, len),
      fastPeriod,
      slowPeriod,
    });
  }

  /**
   * Chaikin Money Flow — volume-weighted accumulation/distribution over period
   * CMF = SUM[(close - low) - (high - close)] / (high - low) * volume] / SUM[volume]
   */
  calculateCMF(
    highs: number[],
    lows: number[],
    closes: number[],
    volumes: number[],
    period: number = 20,
  ): number[] {
    const len = Math.min(highs.length, lows.length, closes.length, volumes.length);
    if (len < period) return [];

    // Compute Money Flow Multiplier and Money Flow Volume
    const mfv: number[] = [];
    for (let i = 0; i < len; i++) {
      const hl = highs[i] - lows[i];
      if (hl === 0) {
        mfv.push(0);
      } else {
        const mfm = ((closes[i] - lows[i]) - (highs[i] - closes[i])) / hl;
        mfv.push(mfm * volumes[i]);
      }
    }

    const result: number[] = [];
    for (let i = period - 1; i < len; i++) {
      let sumMFV = 0;
      let sumVol = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sumMFV += mfv[j];
        sumVol += volumes[j];
      }
      result.push(sumVol === 0 ? 0 : sumMFV / sumVol);
    }

    return result;
  }

  /**
   * True Strength Index — double-smoothed momentum oscillator
   * TSI = 100 * EMA(EMA(priceChange, r), s) / EMA(EMA(|priceChange|, r), s)
   */
  calculateTSI(
    closes: number[],
    longPeriod: number = 25,
    shortPeriod: number = 13,
  ): number[] {
    if (closes.length < longPeriod + shortPeriod + 1) return [];

    // Price changes
    const pc: number[] = [];
    const absPC: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      pc.push(closes[i] - closes[i - 1]);
      absPC.push(Math.abs(closes[i] - closes[i - 1]));
    }

    const emaPC1 = EMA.calculate({ period: longPeriod, values: pc });
    const emaPC2 = EMA.calculate({ period: shortPeriod, values: emaPC1 });

    const emaAbs1 = EMA.calculate({ period: longPeriod, values: absPC });
    const emaAbs2 = EMA.calculate({ period: shortPeriod, values: emaAbs1 });

    const minLen = Math.min(emaPC2.length, emaAbs2.length);
    const result: number[] = [];

    const offsetPC = emaPC2.length - minLen;
    const offsetAbs = emaAbs2.length - minLen;

    for (let i = 0; i < minLen; i++) {
      const denom = emaAbs2[i + offsetAbs];
      result.push(denom === 0 ? 0 : 100 * (emaPC2[i + offsetPC] / denom));
    }

    return result;
  }

  /**
   * Ultimate Oscillator — multi-timeframe momentum (combines 7, 14, 28 periods)
   */
  calculateUltimateOscillator(
    highs: number[],
    lows: number[],
    closes: number[],
    period1: number = 7,
    period2: number = 14,
    period3: number = 28,
  ): number[] {
    const len = Math.min(highs.length, lows.length, closes.length);
    if (len < period3 + 1) return [];

    // Buying Pressure and True Range
    const bp: number[] = [];
    const tr: number[] = [];

    for (let i = 1; i < len; i++) {
      const minVal = Math.min(lows[i], closes[i - 1]);
      const maxVal = Math.max(highs[i], closes[i - 1]);
      bp.push(closes[i] - minVal);
      tr.push(maxVal - minVal);
    }

    const result: number[] = [];

    for (let i = period3 - 1; i < bp.length; i++) {
      let bpSum1 = 0, trSum1 = 0;
      let bpSum2 = 0, trSum2 = 0;
      let bpSum3 = 0, trSum3 = 0;

      for (let j = i - period1 + 1; j <= i; j++) {
        bpSum1 += bp[j];
        trSum1 += tr[j];
      }
      for (let j = i - period2 + 1; j <= i; j++) {
        bpSum2 += bp[j];
        trSum2 += tr[j];
      }
      for (let j = i - period3 + 1; j <= i; j++) {
        bpSum3 += bp[j];
        trSum3 += tr[j];
      }

      const avg1 = trSum1 === 0 ? 0 : bpSum1 / trSum1;
      const avg2 = trSum2 === 0 ? 0 : bpSum2 / trSum2;
      const avg3 = trSum3 === 0 ? 0 : bpSum3 / trSum3;

      result.push(100 * (4 * avg1 + 2 * avg2 + avg3) / 7);
    }

    return result;
  }

  /**
   * Momentum — simple price difference over n periods
   */
  calculateMomentum(closes: number[], period: number = 10): number[] {
    if (closes.length < period + 1) return [];

    const result: number[] = [];
    for (let i = period; i < closes.length; i++) {
      result.push(closes[i] - closes[i - period]);
    }

    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  VOLATILITY INDICATORS (6 new)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Keltner Channels — ATR-based volatility envelope around EMA
   */
  calculateKeltnerChannels(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number = 20,
    atrPeriod: number = 10,
    multiplier: number = 1,
  ): KeltnerChannelsResult {
    const len = Math.min(highs.length, lows.length, closes.length);
    if (len < Math.max(period, atrPeriod) + 1) {
      return { upper: [], middle: [], lower: [] };
    }

    const result = KeltnerChannels.calculate({
      high: highs.slice(0, len),
      low: lows.slice(0, len),
      close: closes.slice(0, len),
      maPeriod: period,
      atrPeriod,
      useSMA: false,
      multiplier,
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
   * Chandelier Exit — trailing stop based on ATR from highest high / lowest low
   */
  calculateChandelierExit(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number = 22,
    multiplier: number = 3,
  ): ChandelierExitResult {
    const len = Math.min(highs.length, lows.length, closes.length);
    if (len < period + 1) return { exitLong: [], exitShort: [] };

    const exitLong: number[] = [];
    const exitShort: number[] = [];

    // Compute manually: exitLong = highest high - multiplier * ATR, exitShort = lowest low + multiplier * ATR
    const atrValues = this.calculateATR(highs, lows, closes, period);
    if (atrValues.length === 0) return { exitLong: [], exitShort: [] };

    const atrOffset = len - atrValues.length;

    for (let i = 0; i < atrValues.length; i++) {
      const idx = i + atrOffset;
      // Highest high over period
      let hh = -Infinity;
      let ll = Infinity;
      const start = Math.max(0, idx - period + 1);
      for (let j = start; j <= idx; j++) {
        if (highs[j] > hh) hh = highs[j];
        if (lows[j] < ll) ll = lows[j];
      }
      exitLong.push(hh - multiplier * atrValues[i]);
      exitShort.push(ll + multiplier * atrValues[i]);
    }

    return { exitLong, exitShort };
  }

  /**
   * Standard Deviation — statistical measure of price volatility
   */
  calculateSD(closes: number[], period: number = 20): number[] {
    if (closes.length < period) return [];
    return SD.calculate({ period, values: closes });
  }

  /**
   * Historical Volatility — annualized standard deviation of log returns
   */
  calculateHistoricalVolatility(
    closes: number[],
    period: number = 20,
    annualizationFactor: number = 252,
  ): number[] {
    if (closes.length < period + 1) return [];

    // Compute log returns
    const logReturns: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      if (closes[i - 1] <= 0) {
        logReturns.push(0);
      } else {
        logReturns.push(Math.log(closes[i] / closes[i - 1]));
      }
    }

    const sd = SD.calculate({ period, values: logReturns });

    // Annualize
    const sqrtFactor = Math.sqrt(annualizationFactor);
    return sd.map((v) => v * sqrtFactor * 100);
  }

  /**
   * Donchian Channel — highest high and lowest low over period
   */
  calculateDonchianChannel(
    highs: number[],
    lows: number[],
    period: number = 20,
  ): DonchianChannelResult {
    const len = Math.min(highs.length, lows.length);
    if (len < period) return { upper: [], middle: [], lower: [] };

    const upper: number[] = [];
    const middle: number[] = [];
    const lower: number[] = [];

    for (let i = period - 1; i < len; i++) {
      let hi = -Infinity;
      let lo = Infinity;
      for (let j = i - period + 1; j <= i; j++) {
        if (highs[j] > hi) hi = highs[j];
        if (lows[j] < lo) lo = lows[j];
      }
      upper.push(hi);
      lower.push(lo);
      middle.push((hi + lo) / 2);
    }

    return { upper, middle, lower };
  }

  /**
   * ATR Percent — ATR expressed as percentage of closing price
   */
  calculateATRPercent(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number = 14,
  ): number[] {
    const atrValues = this.calculateATR(highs, lows, closes, period);
    if (atrValues.length === 0) return [];

    // ATR output is aligned to the end of the closes array
    const offset = closes.length - atrValues.length;
    const result: number[] = [];

    for (let i = 0; i < atrValues.length; i++) {
      const closeVal = closes[i + offset];
      result.push(closeVal === 0 ? 0 : (atrValues[i] / closeVal) * 100);
    }

    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  VOLUME INDICATORS (6 new)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Accumulation/Distribution Line — cumulative volume-based momentum
   */
  calculateADL(
    highs: number[],
    lows: number[],
    closes: number[],
    volumes: number[],
  ): number[] {
    const len = Math.min(highs.length, lows.length, closes.length, volumes.length);
    if (len < 1) return [];

    return ADL.calculate({
      high: highs.slice(0, len),
      low: lows.slice(0, len),
      close: closes.slice(0, len),
      volume: volumes.slice(0, len),
    });
  }

  /**
   * Force Index — price change multiplied by volume; measures buying/selling pressure
   */
  calculateForceIndex(
    closes: number[],
    volumes: number[],
    period: number = 13,
  ): number[] {
    const len = Math.min(closes.length, volumes.length);
    if (len < period + 1) return [];

    return ForceIndex.calculate({
      close: closes.slice(0, len),
      volume: volumes.slice(0, len),
      period,
    });
  }

  /**
   * Volume Profile — distribution of volume across price levels
   */
  calculateVolumeProfile(
    highs: number[],
    lows: number[],
    closes: number[],
    opens: number[],
    volumes: number[],
    noOfBars: number = 14,
  ): VolumeProfileResult[] {
    const len = Math.min(highs.length, lows.length, closes.length, opens.length, volumes.length);
    if (len < noOfBars) return [];

    const result = VolumeProfile.calculate({
      high: highs.slice(0, len),
      low: lows.slice(0, len),
      close: closes.slice(0, len),
      open: opens.slice(0, len),
      volume: volumes.slice(0, len),
      noOfBars,
    });

    return result.map((r: any) => ({
      rangeStart: r.rangeStart,
      rangeEnd: r.rangeEnd,
      bullishVolume: r.bullishVolume ?? 0,
      bearishVolume: r.bearishVolume ?? 0,
    }));
  }

  /**
   * Volume Weighted Moving Average — SMA weighted by volume
   */
  calculateVWMA(
    closes: number[],
    volumes: number[],
    period: number = 20,
  ): number[] {
    const len = Math.min(closes.length, volumes.length);
    if (len < period) return [];

    const result: number[] = [];

    for (let i = period - 1; i < len; i++) {
      let sumPV = 0;
      let sumV = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sumPV += closes[j] * volumes[j];
        sumV += volumes[j];
      }
      result.push(sumV === 0 ? closes[i] : sumPV / sumV);
    }

    return result;
  }

  /**
   * Ease of Movement — relates price change to volume; measures how easily price moves
   * EMV = ((H+L)/2 - (prevH+prevL)/2) / (Volume / (H - L))
   */
  calculateEMV(
    highs: number[],
    lows: number[],
    volumes: number[],
    period: number = 14,
  ): number[] {
    const len = Math.min(highs.length, lows.length, volumes.length);
    if (len < period + 1) return [];

    const emv: number[] = [];
    for (let i = 1; i < len; i++) {
      const hl = highs[i] - lows[i];
      const distanceMoved = (highs[i] + lows[i]) / 2 - (highs[i - 1] + lows[i - 1]) / 2;
      const boxRatio = hl === 0 ? 0 : volumes[i] / hl;
      emv.push(boxRatio === 0 ? 0 : distanceMoved / boxRatio);
    }

    // Smooth with SMA
    return SMA.calculate({ period, values: emv });
  }

  /**
   * Volume Oscillator — percentage difference between fast and slow volume EMAs
   */
  calculateVolumeOscillator(
    volumes: number[],
    fastPeriod: number = 5,
    slowPeriod: number = 10,
  ): number[] {
    if (volumes.length < slowPeriod) return [];

    const fastEMA = EMA.calculate({ period: fastPeriod, values: volumes });
    const slowEMA = EMA.calculate({ period: slowPeriod, values: volumes });

    const offset = fastEMA.length - slowEMA.length;
    const result: number[] = [];

    for (let i = 0; i < slowEMA.length; i++) {
      const slow = slowEMA[i];
      result.push(slow === 0 ? 0 : ((fastEMA[i + offset] - slow) / slow) * 100);
    }

    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  COMPOSITE / CUSTOM INDICATORS (8 new)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Pivot Points (Standard) — key support/resistance levels from prior period
   */
  calculatePivotPoints(
    high: number,
    low: number,
    close: number,
  ): PivotPointsResult {
    const pivot = (high + low + close) / 3;
    return {
      pivot,
      s1: 2 * pivot - high,
      s2: pivot - (high - low),
      s3: low - 2 * (high - pivot),
      r1: 2 * pivot - low,
      r2: pivot + (high - low),
      r3: high + 2 * (pivot - low),
    };
  }

  /**
   * Fibonacci Retracement — key retracement levels between swing high and low
   */
  calculateFibonacciRetracement(
    swingHigh: number,
    swingLow: number,
  ): FibonacciRetracementResult {
    const range = swingHigh - swingLow;
    return {
      level0: swingHigh,
      level236: swingHigh - range * 0.236,
      level382: swingHigh - range * 0.382,
      level500: swingHigh - range * 0.5,
      level618: swingHigh - range * 0.618,
      level786: swingHigh - range * 0.786,
      level1000: swingLow,
    };
  }

  /**
   * Heikin-Ashi — smoothed candlestick representation for trend clarity
   */
  calculateHeikinAshi(
    opens: number[],
    highs: number[],
    lows: number[],
    closes: number[],
  ): HeikinAshiResult {
    const len = Math.min(opens.length, highs.length, lows.length, closes.length);
    if (len < 1) return { open: [], high: [], low: [], close: [] };

    const result = HeikinAshi.calculate({
      open: opens.slice(0, len),
      high: highs.slice(0, len),
      low: lows.slice(0, len),
      close: closes.slice(0, len),
    });

    return {
      open: result.open ?? [],
      high: result.high ?? [],
      low: result.low ?? [],
      close: result.close ?? [],
    };
  }

  /**
   * Renko — price-based chart bricks that filter out noise
   */
  calculateRenko(
    opens: number[],
    highs: number[],
    lows: number[],
    closes: number[],
    volumes: number[],
    brickSize: number = 10,
  ): RenkoBrick[] {
    const len = Math.min(opens.length, highs.length, lows.length, closes.length, volumes.length);
    if (len < 2) return [];

    try {
      const result = renko({
        open: opens.slice(0, len),
        high: highs.slice(0, len),
        low: lows.slice(0, len),
        close: closes.slice(0, len),
        volume: volumes.slice(0, len),
        brickSize,
      });

      const rOpen = result.open ?? [];
      const rClose = result.close ?? [];
      const rHigh = result.high ?? [];
      const rLow = result.low ?? [];
      const bricks: RenkoBrick[] = [];

      for (let i = 0; i < rOpen.length; i++) {
        bricks.push({
          open: rOpen[i],
          close: rClose[i],
          high: rHigh[i],
          low: rLow[i],
          uptrend: rClose[i] > rOpen[i],
        });
      }

      return bricks;
    } catch {
      return [];
    }
  }

  /**
   * Supertrend — ATR-based trend-following overlay
   */
  calculateSupertrend(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number = 10,
    multiplier: number = 3,
  ): SupertrendResult {
    const atrValues = this.calculateATR(highs, lows, closes, period);
    if (atrValues.length === 0) return { supertrend: [], direction: [] };

    const offset = closes.length - atrValues.length;
    const supertrend: number[] = [];
    const direction: number[] = []; // 1 = up (bullish), -1 = down (bearish)

    let prevUpperBand = 0;
    let prevLowerBand = 0;
    let prevSupertrend = 0;
    let prevDirection = 1;

    for (let i = 0; i < atrValues.length; i++) {
      const idx = i + offset;
      const hl2 = (highs[idx] + lows[idx]) / 2;
      let upperBand = hl2 + multiplier * atrValues[i];
      let lowerBand = hl2 - multiplier * atrValues[i];

      // Adjust bands based on previous values
      if (i > 0) {
        if (lowerBand > prevLowerBand || closes[idx - 1] < prevLowerBand) {
          // keep lowerBand as is
        } else {
          lowerBand = prevLowerBand;
        }

        if (upperBand < prevUpperBand || closes[idx - 1] > prevUpperBand) {
          // keep upperBand as is
        } else {
          upperBand = prevUpperBand;
        }
      }

      let dir: number;
      let st: number;

      if (i === 0) {
        dir = closes[idx] > upperBand ? 1 : -1;
      } else if (prevSupertrend === prevUpperBand) {
        dir = closes[idx] > upperBand ? 1 : -1;
      } else {
        dir = closes[idx] < lowerBand ? -1 : 1;
      }

      st = dir === 1 ? lowerBand : upperBand;

      supertrend.push(st);
      direction.push(dir);

      prevUpperBand = upperBand;
      prevLowerBand = lowerBand;
      prevSupertrend = st;
      prevDirection = dir;
    }

    return { supertrend, direction };
  }

  /**
   * Squeeze Momentum — detects Bollinger Bands squeeze inside Keltner Channels
   * Squeeze on = BB inside KC; momentum = linear regression of (close - midline(KC+BB)/2)
   */
  calculateSqueezeMomentum(
    highs: number[],
    lows: number[],
    closes: number[],
    bbPeriod: number = 20,
    bbStdDev: number = 2,
    kcPeriod: number = 20,
    kcAtrPeriod: number = 10,
    kcMultiplier: number = 1.5,
  ): SqueezeMomentumResult {
    const bb = this.calculateBollingerBands(closes, bbPeriod, bbStdDev);
    const kc = this.calculateKeltnerChannels(highs, lows, closes, kcPeriod, kcAtrPeriod, kcMultiplier);

    if (bb.upper.length === 0 || kc.upper.length === 0) {
      return { squeezOn: [], momentum: [] };
    }

    // Align arrays to the shorter one (from the end)
    const minLen = Math.min(bb.upper.length, kc.upper.length);
    const bbOffset = bb.upper.length - minLen;
    const kcOffset = kc.upper.length - minLen;

    const squeezOn: boolean[] = [];
    const momentum: number[] = [];

    for (let i = 0; i < minLen; i++) {
      const bbUpper = bb.upper[i + bbOffset];
      const bbLower = bb.lower[i + bbOffset];
      const kcUpper = kc.upper[i + kcOffset];
      const kcLower = kc.lower[i + kcOffset];

      // Squeeze is on when BB is inside KC
      squeezOn.push(bbLower > kcLower && bbUpper < kcUpper);

      // Momentum = midpoint delta
      const bbMid = bb.middle[i + bbOffset];
      const kcMid = kc.middle[i + kcOffset];
      // Use the close relative to the average of the two midlines
      const closesOffset = closes.length - minLen;
      const closeVal = closes[i + closesOffset];
      momentum.push(closeVal - (bbMid + kcMid) / 2);
    }

    return { squeezOn, momentum };
  }

  /**
   * Elder Ray — Bull Power and Bear Power relative to EMA
   * Bull Power = High - EMA; Bear Power = Low - EMA
   */
  calculateElderRay(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number = 13,
  ): ElderRayResult {
    const len = Math.min(highs.length, lows.length, closes.length);
    if (len < period) return { bullPower: [], bearPower: [] };

    const emaValues = EMA.calculate({ period, values: closes.slice(0, len) });
    const offset = len - emaValues.length;

    const bullPower: number[] = [];
    const bearPower: number[] = [];

    for (let i = 0; i < emaValues.length; i++) {
      bullPower.push(highs[i + offset] - emaValues[i]);
      bearPower.push(lows[i + offset] - emaValues[i]);
    }

    return { bullPower, bearPower };
  }

  /**
   * Choppiness Index — measures whether market is trending or range-bound (0-100)
   * CI = 100 * LOG10(SUM(ATR, n) / (HighestHigh - LowestLow)) / LOG10(n)
   */
  calculateChoppinessIndex(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number = 14,
  ): number[] {
    const atrValues = this.calculateATR(highs, lows, closes, 1);
    if (atrValues.length === 0) return [];

    // ATR(1) = true range for each bar
    const atrOffset = closes.length - atrValues.length;
    const result: number[] = [];
    const log10N = Math.log10(period);

    for (let i = period - 1; i < atrValues.length; i++) {
      let sumATR = 0;
      let highestHigh = -Infinity;
      let lowestLow = Infinity;

      for (let j = i - period + 1; j <= i; j++) {
        sumATR += atrValues[j];
        const idx = j + atrOffset;
        if (highs[idx] > highestHigh) highestHigh = highs[idx];
        if (lows[idx] < lowestLow) lowestLow = lows[idx];
      }

      const range = highestHigh - lowestLow;
      if (range === 0 || log10N === 0) {
        result.push(100);
      } else {
        result.push(100 * Math.log10(sumATR / range) / log10N);
      }
    }

    return result;
  }
}

export default new IndicatorCalculator();
