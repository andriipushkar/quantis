import { Router, Response } from 'express';
import { query } from '../config/database.js';
import { env } from '../config/env.js';
import redis from '../config/redis.js';
import logger from '../config/logger.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { validateBody, copilotSchema } from '../validators/index.js';
import { CircuitBreaker } from '@quantis/shared';
import { getAllTickers } from '../utils/ticker-cache.js';

const router = Router();

const claudeBreaker = new CircuitBreaker('claude-api', {
  failureThreshold: 3,
  resetTimeout: 60_000, // 1 minute cooldown for paid API
  onStateChange: (name, from, to) => {
    logger.warn(`Circuit breaker "${name}" transitioned ${from} → ${to}`);
  },
});

// Rate limit: 10 queries per hour per user
async function checkRateLimit(userId: string): Promise<boolean> {
  const key = `copilot:ratelimit:${userId}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 3600); // 1 hour TTL
  }
  return count <= 10;
}

// Fetch ticker from Redis (try binance first, then others)
async function getTickerFromRedis(symbol: string): Promise<{ price: number; change24h: number; volume: number } | null> {
  const exchanges = ['binance', 'bybit', 'okx'];
  for (const exchange of exchanges) {
    const data = await redis.get(`ticker:${exchange}:${symbol}`);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        return {
          price: parsed.price ?? 0,
          change24h: parsed.change24h ?? 0,
          volume: parsed.volume ?? 0,
        };
      } catch { /* skip */ }
    }
  }
  return null;
}

// Compute RSI inline from closes
function computeRSI(closes: number[], period: number = 14): number | null {
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

// Compute EMA inline
function computeEMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const k = 2 / (period + 1);
  let ema = closes[0];
  for (let i = 1; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return Math.round(ema * 100) / 100;
}

// POST /ask — AI analysis endpoint
router.post('/ask', authenticate, validateBody(copilotSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Rate limit check
    const allowed = await checkRateLimit(userId);
    if (!allowed) {
      res.status(429).json({ success: false, error: 'Rate limit exceeded. Maximum 10 queries per hour.' });
      return;
    }

    const { question, symbol: rawSymbol } = req.body;

    const symbol = (rawSymbol || 'BTCUSDT').toUpperCase();

    // Gather market context
    const ticker = await getTickerFromRedis(symbol);
    const price = ticker?.price ?? 0;
    const change24h = ticker?.change24h ?? 0;

    // Fetch last 20 candles for RSI and EMA computation
    const pairResult = await query(
      `SELECT tp.id FROM trading_pairs tp WHERE tp.symbol = $1 LIMIT 1`,
      [symbol]
    );

    let rsi: number | null = null;
    let ema9: number | null = null;
    let ema21: number | null = null;
    let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';

    if (pairResult.rows.length > 0) {
      const pairId = pairResult.rows[0].id;
      const candlesResult = await query(
        `SELECT close FROM ohlcv_1m WHERE pair_id = $1 ORDER BY time DESC LIMIT 25`,
        [pairId]
      );
      const closes = candlesResult.rows.map((r: { close: string }) => parseFloat(r.close)).reverse();

      if (closes.length >= 15) {
        rsi = computeRSI(closes, 14);
      }
      if (closes.length >= 9) {
        ema9 = computeEMA(closes, 9);
      }
      if (closes.length >= 21) {
        ema21 = computeEMA(closes, 21);
      }
      if (ema9 !== null && ema21 !== null) {
        if (ema9 > ema21) trend = 'bullish';
        else if (ema9 < ema21) trend = 'bearish';
      }
    }

    // Fetch latest signals for the pair
    const signalsResult = await query(
      `SELECT s.type, s.strategy, s.strength, s.confidence, s.reasoning
       FROM signals s
       JOIN trading_pairs tp ON tp.id = s.pair_id
       WHERE tp.symbol = $1
       ORDER BY s.created_at DESC
       LIMIT 3`,
      [symbol]
    );
    const latestSignals = signalsResult.rows;

    // Compute Fear & Greed score inline (simplified)
    let fearGreed = 50;
    try {
      const allTickers = await getAllTickers();
      if (allTickers.size > 0) {
        const changes: number[] = [];
        for (const [, entry] of allTickers) {
          if (entry.change24h !== undefined) changes.push(entry.change24h);
        }
        if (changes.length > 0) {
          const bullishPct = (changes.filter((c) => c > 0).length / changes.length) * 100;
          fearGreed = Math.max(0, Math.min(100, Math.round(bullishPct)));
        }
      }
    } catch { /* ignore fear-greed computation errors */ }

    const rsiLabel = rsi !== null
      ? rsi < 30 ? 'oversold' : rsi > 70 ? 'overbought' : 'neutral'
      : 'unknown';

    const contextData = {
      symbol,
      price,
      change24h,
      rsi,
      rsiLabel,
      ema9,
      ema21,
      trend,
      fearGreed,
      latestSignals,
    };

    let answer: string;

    if (env.ANTHROPIC_API_KEY) {
      // Call Claude API with Circuit Breaker protection
      answer = await claudeBreaker.call(
        async () => {
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': env.ANTHROPIC_API_KEY!,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: env.ANTHROPIC_MODEL,
              max_tokens: env.COPILOT_MAX_TOKENS,
              system: 'You are a professional crypto technical analyst for Quantis platform. Analyze based on the provided data. Be concise. Never give financial advice. Include confidence level.',
              messages: [
                {
                  role: 'user',
                  content: `${question}\n\nMarket Context:\n${JSON.stringify(contextData, null, 2)}`,
                },
              ],
            }),
          });

          if (!response.ok) {
            throw new Error(`Claude API ${response.status}`);
          }

          const data = (await response.json()) as { content?: Array<{ text?: string }> };
          return data.content?.[0]?.text || 'Unable to generate analysis at this time.';
        },
        () => {
          logger.warn('Claude API circuit breaker fallback — using mock analysis');
          return generateMockAnalysis(contextData);
        },
      );
    } else {
      answer = generateMockAnalysis(contextData);
    }

    res.json({
      success: true,
      data: {
        answer,
        context: {
          symbol,
          price,
          rsi,
          ema9,
          ema21,
          trend,
          fearGreed,
        },
      },
    });
  } catch (err) {
    logger.error('Copilot ask error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

function generateMockAnalysis(ctx: {
  symbol: string;
  price: number;
  rsi: number | null;
  rsiLabel: string;
  ema9: number | null;
  ema21: number | null;
  trend: string;
  fearGreed: number;
  latestSignals: Array<{ type: string; strategy: string; strength: string; confidence: number }>;
}): string {
  const parts: string[] = [];

  parts.push(`Based on current data for ${ctx.symbol}:`);

  if (ctx.price > 0) {
    parts.push(`Price is at $${ctx.price.toLocaleString()}.`);
  }

  if (ctx.rsi !== null) {
    parts.push(`RSI(14) is at ${ctx.rsi} (${ctx.rsiLabel}).`);
    if (ctx.rsiLabel === 'oversold') {
      parts.push('This suggests the asset may be undervalued in the short term and could see a bounce.');
    } else if (ctx.rsiLabel === 'overbought') {
      parts.push('This suggests the asset may be overextended and could face selling pressure.');
    }
  }

  if (ctx.ema9 !== null && ctx.ema21 !== null) {
    if (ctx.ema9 > ctx.ema21) {
      parts.push(`EMA9 ($${ctx.ema9}) is above EMA21 ($${ctx.ema21}), suggesting a bullish short-term trend.`);
    } else {
      parts.push(`EMA9 ($${ctx.ema9}) is below EMA21 ($${ctx.ema21}), suggesting a bearish short-term trend.`);
    }
  }

  const fearLabel = ctx.fearGreed < 20 ? 'Extreme Fear' : ctx.fearGreed < 40 ? 'Fear' : ctx.fearGreed < 60 ? 'Neutral' : ctx.fearGreed < 80 ? 'Greed' : 'Extreme Greed';
  parts.push(`Market sentiment (Fear & Greed): ${ctx.fearGreed}/100 (${fearLabel}).`);

  if (ctx.latestSignals.length > 0) {
    const sig = ctx.latestSignals[0];
    parts.push(`Latest signal: ${sig.type.toUpperCase()} (${sig.strategy}) with ${sig.strength} strength and ${sig.confidence}% confidence.`);
  }

  // Confidence level based on data availability
  const dataPoints = [ctx.rsi !== null, ctx.ema9 !== null, ctx.ema21 !== null, ctx.price > 0, ctx.latestSignals.length > 0];
  const availablePoints = dataPoints.filter(Boolean).length;
  const confidence = availablePoints >= 4 ? 'High' : availablePoints >= 2 ? 'Medium' : 'Low';
  parts.push(`\nAnalysis confidence: ${confidence} (based on ${availablePoints}/5 data points available).`);

  parts.push('\nDisclaimer: This is not financial advice. Always do your own research.');

  return parts.join(' ');
}

export default router;
