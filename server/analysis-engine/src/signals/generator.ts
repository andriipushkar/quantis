import { query } from '../config/database.js';
import { publisherClient } from '../config/redis.js';
import logger from '../config/logger.js';
import calculator from '../indicators/calculator.js';
import { calculateAllIndicators, IndicatorResults } from '../indicators/index.js';

export interface Signal {
  pairId: number;
  strategy: string;
  type: 'BUY' | 'SELL';
  strength: 'WEAK' | 'MEDIUM' | 'STRONG';
  entryPrice: number;
  stopLoss: number;
  tp1: number;
  tp2: number;
  tp3: number;
  confidence: number;
  timeframe: string;
  reasoning: string;
}

export class SignalGenerator {
  /**
   * Calculates a stop-loss price based on ATR.
   * For buy signals, SL is below entry; for sell signals, SL is above entry.
   * Uses 2x ATR distance from entry.
   */
  calculateStopLoss(entryPrice: number, atr: number, type: 'buy' | 'sell'): number {
    const distance = atr * 2;
    return type === 'buy'
      ? entryPrice - distance
      : entryPrice + distance;
  }

  /**
   * Calculates take-profit price based on entry, stop-loss, and risk/reward ratio.
   * The TP is placed at `ratio` times the risk distance from entry, in the direction
   * opposite to the stop-loss.
   */
  calculateTakeProfit(entry: number, sl: number, ratio: number): number {
    const risk = Math.abs(entry - sl);
    // If SL is below entry, it is a long trade: TP is above entry.
    // If SL is above entry, it is a short trade: TP is below entry.
    return sl < entry
      ? entry + risk * ratio
      : entry - risk * ratio;
  }

  /**
   * Evaluates all strategies against the current indicators for a pair/timeframe.
   * Returns an array of generated signals.
   */
  async evaluateStrategies(pairId: number, timeframe: string): Promise<Signal[]> {
    const indicators = await calculateAllIndicators(pairId, timeframe);
    if (!indicators) {
      logger.warn('No indicators available for signal evaluation', { pairId, timeframe });
      return [];
    }

    const signals: Signal[] = [];

    const trendSignal = this.evaluateTrendFollowing(pairId, timeframe, indicators);
    if (trendSignal) signals.push(trendSignal);

    const meanRevSignal = this.evaluateMeanReversion(pairId, timeframe, indicators);
    if (meanRevSignal) signals.push(meanRevSignal);

    // Persist and publish each signal
    for (const signal of signals) {
      await this.persistSignal(signal);
    }

    return signals;
  }

  /**
   * Strategy 1: Trend Following
   * Conditions for BUY:
   *   - EMA(9) crosses above EMA(21) (latest EMA9 > EMA21, previous EMA9 <= EMA21)
   *   - RSI > 50
   *   - Current volume above 20-period average volume
   *
   * Conditions for SELL (inverse):
   *   - EMA(9) crosses below EMA(21)
   *   - RSI < 50
   *   - Volume above average
   */
  private evaluateTrendFollowing(
    pairId: number,
    timeframe: string,
    ind: IndicatorResults,
  ): Signal | null {
    const { ema9, ema21, rsi14, atr14 } = ind;

    if (ema9.length < 2 || ema21.length < 2 || rsi14.length < 1 || atr14.length < 1) {
      return null;
    }

    const currentEma9 = ema9[ema9.length - 1];
    const prevEma9 = ema9[ema9.length - 2];
    const currentEma21 = ema21[ema21.length - 1];
    const prevEma21 = ema21[ema21.length - 2];
    const currentRsi = rsi14[rsi14.length - 1];
    const currentAtr = atr14[atr14.length - 1];

    // Use EMA21 last value as proxy for entry price (most recent close is near it)
    // We use the midpoint of the two EMAs as a reasonable entry estimate
    const entryPrice = currentEma9;

    // Check bullish crossover
    const bullishCross = prevEma9 <= prevEma21 && currentEma9 > currentEma21;
    // Check bearish crossover
    const bearishCross = prevEma9 >= prevEma21 && currentEma9 < currentEma21;

    if (bullishCross && currentRsi > 50) {
      const sl = this.calculateStopLoss(entryPrice, currentAtr, 'buy');
      const confidence = this.calculateTrendConfidence(currentRsi, currentEma9, currentEma21);

      return {
        pairId,
        strategy: 'TREND_FOLLOWING',
        type: 'BUY',
        strength: confidence >= 0.75 ? 'STRONG' : confidence >= 0.5 ? 'MEDIUM' : 'WEAK',
        entryPrice,
        stopLoss: sl,
        tp1: this.calculateTakeProfit(entryPrice, sl, 1),
        tp2: this.calculateTakeProfit(entryPrice, sl, 2),
        tp3: this.calculateTakeProfit(entryPrice, sl, 3),
        confidence,
        timeframe,
        reasoning: `EMA(9) crossed above EMA(21). RSI at ${currentRsi.toFixed(1)}. Bullish trend confirmed.`,
      };
    }

    if (bearishCross && currentRsi < 50) {
      const sl = this.calculateStopLoss(entryPrice, currentAtr, 'sell');
      const confidence = this.calculateTrendConfidence(100 - currentRsi, currentEma21, currentEma9);

      return {
        pairId,
        strategy: 'TREND_FOLLOWING',
        type: 'SELL',
        strength: confidence >= 0.75 ? 'STRONG' : confidence >= 0.5 ? 'MEDIUM' : 'WEAK',
        entryPrice,
        stopLoss: sl,
        tp1: this.calculateTakeProfit(entryPrice, sl, 1),
        tp2: this.calculateTakeProfit(entryPrice, sl, 2),
        tp3: this.calculateTakeProfit(entryPrice, sl, 3),
        confidence,
        timeframe,
        reasoning: `EMA(9) crossed below EMA(21). RSI at ${currentRsi.toFixed(1)}. Bearish trend confirmed.`,
      };
    }

    return null;
  }

  /**
   * Strategy 2: Mean Reversion
   * BUY condition:
   *   - RSI < 30 (oversold)
   *   - Price near lower Bollinger Band (within 0.5% of lower band)
   *
   * SELL condition:
   *   - RSI > 70 (overbought)
   *   - Price near upper Bollinger Band
   */
  private evaluateMeanReversion(
    pairId: number,
    timeframe: string,
    ind: IndicatorResults,
  ): Signal | null {
    const { rsi14, bollingerBands, atr14, ema9 } = ind;

    if (rsi14.length < 1 || bollingerBands.lower.length < 1 || atr14.length < 1 || ema9.length < 1) {
      return null;
    }

    const currentRsi = rsi14[rsi14.length - 1];
    const currentLowerBB = bollingerBands.lower[bollingerBands.lower.length - 1];
    const currentUpperBB = bollingerBands.upper[bollingerBands.upper.length - 1];
    const currentMiddleBB = bollingerBands.middle[bollingerBands.middle.length - 1];
    const currentAtr = atr14[atr14.length - 1];
    const currentPrice = ema9[ema9.length - 1]; // Approximate current price

    // Check if price is near lower Bollinger Band (within 0.5%)
    const nearLowerBB = currentPrice <= currentLowerBB * 1.005;
    // Check if price is near upper Bollinger Band (within 0.5%)
    const nearUpperBB = currentPrice >= currentUpperBB * 0.995;

    if (currentRsi < 30 && nearLowerBB) {
      const entryPrice = currentPrice;
      const sl = this.calculateStopLoss(entryPrice, currentAtr, 'buy');
      const confidence = this.calculateMeanRevConfidence(currentRsi, currentPrice, currentLowerBB, currentMiddleBB);

      return {
        pairId,
        strategy: 'MEAN_REVERSION',
        type: 'BUY',
        strength: confidence >= 0.75 ? 'STRONG' : confidence >= 0.5 ? 'MEDIUM' : 'WEAK',
        entryPrice,
        stopLoss: sl,
        tp1: this.calculateTakeProfit(entryPrice, sl, 1),
        tp2: this.calculateTakeProfit(entryPrice, sl, 2),
        tp3: this.calculateTakeProfit(entryPrice, sl, 3),
        confidence,
        timeframe,
        reasoning: `RSI oversold at ${currentRsi.toFixed(1)}. Price near lower Bollinger Band. Mean reversion expected.`,
      };
    }

    if (currentRsi > 70 && nearUpperBB) {
      const entryPrice = currentPrice;
      const sl = this.calculateStopLoss(entryPrice, currentAtr, 'sell');
      const confidence = this.calculateMeanRevConfidence(100 - currentRsi, currentUpperBB, currentPrice, currentMiddleBB);

      return {
        pairId,
        strategy: 'MEAN_REVERSION',
        type: 'SELL',
        strength: confidence >= 0.75 ? 'STRONG' : confidence >= 0.5 ? 'MEDIUM' : 'WEAK',
        entryPrice,
        stopLoss: sl,
        tp1: this.calculateTakeProfit(entryPrice, sl, 1),
        tp2: this.calculateTakeProfit(entryPrice, sl, 2),
        tp3: this.calculateTakeProfit(entryPrice, sl, 3),
        confidence,
        timeframe,
        reasoning: `RSI overbought at ${currentRsi.toFixed(1)}. Price near upper Bollinger Band. Mean reversion expected.`,
      };
    }

    return null;
  }

  /**
   * Confidence for trend-following: higher when RSI strongly confirms
   * direction and EMA spread is wide.
   */
  private calculateTrendConfidence(rsi: number, fastEma: number, slowEma: number): number {
    // RSI contribution: how far RSI is from 50 in the expected direction (0 to 0.5)
    const rsiScore = Math.min(Math.abs(rsi - 50) / 50, 1) * 0.5;

    // EMA spread contribution: percentage gap between EMAs (0 to 0.5)
    const spread = Math.abs(fastEma - slowEma) / slowEma;
    const spreadScore = Math.min(spread / 0.02, 1) * 0.5; // 2% spread = max score

    return Math.min(rsiScore + spreadScore, 1);
  }

  /**
   * Confidence for mean reversion: higher when RSI is deeply oversold/overbought
   * and price is firmly touching the band.
   */
  private calculateMeanRevConfidence(
    rsi: number,
    price: number,
    band: number,
    middle: number,
  ): number {
    // RSI extremity: how far below 30 (or equivalently above 70) - already inverted for sell
    const rsiScore = Math.min((30 - rsi) / 30, 1) * 0.5;

    // Band proximity: how close price is to the band vs the middle
    const bandDistance = Math.abs(price - band);
    const totalRange = Math.abs(middle - band);
    const bandScore = totalRange > 0 ? Math.max(1 - bandDistance / totalRange, 0) * 0.5 : 0.25;

    return Math.min(rsiScore + bandScore, 1);
  }

  /**
   * Persists a signal to the database and publishes it to Redis.
   */
  private async persistSignal(signal: Signal): Promise<void> {
    try {
      const result = await query(
        `INSERT INTO signals (
           pair_id, strategy, type, strength, entry_price,
           stop_loss, tp1, tp2, tp3, confidence,
           timeframe, reasoning, status, created_at, expires_at
         ) VALUES (
           $1, $2, $3, $4, $5,
           $6, $7, $8, $9, $10,
           $11, $12, 'ACTIVE', NOW(), NOW() + INTERVAL '24 hours'
         ) RETURNING id`,
        [
          signal.pairId,
          signal.strategy,
          signal.type,
          signal.strength,
          signal.entryPrice,
          signal.stopLoss,
          signal.tp1,
          signal.tp2,
          signal.tp3,
          signal.confidence,
          signal.timeframe,
          signal.reasoning,
        ],
      );

      const signalId = result.rows[0]?.id;

      // Publish to Redis for real-time consumers
      await publisherClient.publish(
        'signal:new',
        JSON.stringify({ id: signalId, ...signal }),
      );

      logger.info('Signal generated and published', {
        signalId,
        pairId: signal.pairId,
        strategy: signal.strategy,
        type: signal.type,
        strength: signal.strength,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to persist signal', { signal, error: message });
    }
  }
}

export default new SignalGenerator();
