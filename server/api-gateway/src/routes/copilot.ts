import { Router, Response } from 'express';
import { query } from '../config/database.js';
import { env } from '../config/env.js';
import redis from '../config/redis.js';
import logger from '../config/logger.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { validateBody, copilotSchema } from '../validators/index.js';
import { CircuitBreaker } from '@quantis/shared';
import { getAllTickers, getTickerBySymbol } from '../utils/ticker-cache.js';
import { computeRSI, computeEMA } from '../utils/indicators.js';

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

// Fetch ticker via shared cache (O(1) hash lookup, no redis.keys)
async function getTickerFromCache(symbol: string): Promise<{ price: number; change24h: number; volume: number } | null> {
  const entry = await getTickerBySymbol(symbol);
  if (!entry) return null;
  return { price: entry.price ?? 0, change24h: entry.change24h ?? 0, volume: entry.volume ?? 0 };
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
    const ticker = await getTickerFromCache(symbol);
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

// Rate limit for morning brief: 1 per hour per user (separate key)
async function checkMorningBriefRateLimit(userId: string): Promise<boolean> {
  const key = `copilot:morning-brief:ratelimit:${userId}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 3600); // 1 hour TTL
  }
  return count <= 1;
}

// GET /morning-brief — AI daily market summary
router.get('/morning-brief', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Rate limit check
    const allowed = await checkMorningBriefRateLimit(userId);
    if (!allowed) {
      res.status(429).json({ success: false, error: 'Rate limit exceeded. Maximum 1 morning brief per hour.' });
      return;
    }

    // Check Redis cache (30 minutes per user)
    const cacheKey = `copilot:morning-brief:${userId}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    // Gather comprehensive market context
    const allTickers = await getAllTickers();

    // Top 5 gainers and losers
    const tickerEntries = Array.from(allTickers.entries())
      .filter(([, t]) => t.change24h !== undefined && t.price !== undefined)
      .map(([symbol, t]) => ({ symbol, price: t.price ?? 0, change24h: t.change24h ?? 0 }));

    const sortedByChange = [...tickerEntries].sort((a, b) => b.change24h - a.change24h);
    const gainers = sortedByChange.slice(0, 5);
    const losers = sortedByChange.slice(-5).reverse();

    // Overall market sentiment (Fear & Greed)
    let sentiment = 50;
    if (tickerEntries.length > 0) {
      const changes = tickerEntries.map((t) => t.change24h);
      const bullishPct = (changes.filter((c) => c > 0).length / changes.length) * 100;
      sentiment = Math.max(0, Math.min(100, Math.round(bullishPct)));
    }
    const sentimentLabel = sentiment < 20 ? 'Extreme Fear' : sentiment < 40 ? 'Fear' : sentiment < 60 ? 'Neutral' : sentiment < 80 ? 'Greed' : 'Extreme Greed';

    // BTC and ETH current price + 24h change
    const btcTicker = await getTickerBySymbol('BTCUSDT');
    const ethTicker = await getTickerBySymbol('ETHUSDT');
    const btcPrice = btcTicker ? { price: btcTicker.price ?? 0, change24h: btcTicker.change24h ?? 0 } : { price: 0, change24h: 0 };
    const ethPrice = ethTicker ? { price: ethTicker.price ?? 0, change24h: ethTicker.change24h ?? 0 } : { price: 0, change24h: 0 };

    // Top 3 latest signals from DB
    const signalsResult = await query(
      `SELECT s.type, s.strategy, s.strength, s.confidence, s.reasoning, tp.symbol
       FROM signals s
       JOIN trading_pairs tp ON tp.id = s.pair_id
       ORDER BY s.created_at DESC
       LIMIT 3`,
      []
    );
    const latestSignals = signalsResult.rows;

    const contextData = {
      gainers,
      losers,
      sentiment: { score: sentiment, label: sentimentLabel },
      btcPrice,
      ethPrice,
      latestSignals,
    };

    let brief: string;

    if (env.ANTHROPIC_API_KEY) {
      brief = await claudeBreaker.call(
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
              system: `You are a professional crypto market analyst for Quantis platform. Generate a concise morning brief that includes:
1. Market overview (1-2 sentences summarizing current conditions)
2. Top 3 trade ideas with specific entry/exit levels based on the data
3. Key levels to watch for BTC and ETH (support/resistance)
4. Risk assessment (1-2 sentences on current market risk)
Be concise and actionable. Never give financial advice — frame as analysis. Use bullet points for clarity.`,
              messages: [
                {
                  role: 'user',
                  content: `Generate a morning market brief based on this data:\n\n${JSON.stringify(contextData, null, 2)}`,
                },
              ],
            }),
          });

          if (!response.ok) {
            throw new Error(`Claude API ${response.status}`);
          }

          const data = (await response.json()) as { content?: Array<{ text?: string }> };
          return data.content?.[0]?.text || 'Unable to generate morning brief at this time.';
        },
        () => {
          logger.warn('Claude API circuit breaker fallback — using mock morning brief');
          return generateMockMorningBrief(contextData);
        },
      );
    } else {
      brief = generateMockMorningBrief(contextData);
    }

    const responseData = {
      success: true as const,
      data: {
        brief,
        generatedAt: new Date().toISOString(),
        context: {
          gainers,
          losers,
          sentiment: contextData.sentiment,
          btcPrice,
          ethPrice,
        },
      },
    };

    // Cache for 30 minutes
    await redis.setex(cacheKey, 1800, JSON.stringify(responseData));

    res.json(responseData);
  } catch (err) {
    logger.error('Morning brief error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Failed to generate morning brief' });
  }
});

function generateMockMorningBrief(ctx: {
  gainers: Array<{ symbol: string; price: number; change24h: number }>;
  losers: Array<{ symbol: string; price: number; change24h: number }>;
  sentiment: { score: number; label: string };
  btcPrice: { price: number; change24h: number };
  ethPrice: { price: number; change24h: number };
  latestSignals: Array<{ type: string; strategy: string; strength: string; confidence: number; reasoning: string; symbol: string }>;
}): string {
  const parts: string[] = [];

  // Market overview
  const btcDir = ctx.btcPrice.change24h >= 0 ? 'up' : 'down';
  const ethDir = ctx.ethPrice.change24h >= 0 ? 'up' : 'down';
  parts.push(`## Market Overview`);
  parts.push(`The crypto market is showing ${ctx.sentiment.label.toLowerCase()} sentiment (${ctx.sentiment.score}/100). BTC is ${btcDir} ${Math.abs(ctx.btcPrice.change24h).toFixed(2)}% at $${ctx.btcPrice.price.toLocaleString()} and ETH is ${ethDir} ${Math.abs(ctx.ethPrice.change24h).toFixed(2)}% at $${ctx.ethPrice.price.toLocaleString()}.`);

  // Top movers
  if (ctx.gainers.length > 0) {
    parts.push(`\n## Top Gainers`);
    ctx.gainers.forEach((g) => parts.push(`- ${g.symbol}: +${g.change24h.toFixed(2)}% ($${g.price.toLocaleString()})`));
  }
  if (ctx.losers.length > 0) {
    parts.push(`\n## Top Losers`);
    ctx.losers.forEach((l) => parts.push(`- ${l.symbol}: ${l.change24h.toFixed(2)}% ($${l.price.toLocaleString()})`));
  }

  // Trade ideas from signals
  parts.push(`\n## Trade Ideas`);
  if (ctx.latestSignals.length > 0) {
    ctx.latestSignals.forEach((sig, i) => {
      parts.push(`${i + 1}. **${sig.symbol}** — ${sig.type.toUpperCase()} signal (${sig.strategy}, ${sig.strength} strength, ${sig.confidence}% confidence)`);
    });
  } else {
    parts.push('No active signals at this time. Consider watching BTC and ETH key levels.');
  }

  // Key levels
  parts.push(`\n## Key Levels to Watch`);
  if (ctx.btcPrice.price > 0) {
    const btcSupport = Math.round(ctx.btcPrice.price * 0.97);
    const btcResistance = Math.round(ctx.btcPrice.price * 1.03);
    parts.push(`- **BTC:** Support $${btcSupport.toLocaleString()} | Resistance $${btcResistance.toLocaleString()}`);
  }
  if (ctx.ethPrice.price > 0) {
    const ethSupport = Math.round(ctx.ethPrice.price * 0.97);
    const ethResistance = Math.round(ctx.ethPrice.price * 1.03);
    parts.push(`- **ETH:** Support $${ethSupport.toLocaleString()} | Resistance $${ethResistance.toLocaleString()}`);
  }

  // Risk assessment
  parts.push(`\n## Risk Assessment`);
  if (ctx.sentiment.score < 30) {
    parts.push('Market fear is elevated — consider smaller position sizes and tighter stop losses. High volatility expected.');
  } else if (ctx.sentiment.score > 70) {
    parts.push('Market greed is high — be cautious of potential reversals. Consider taking partial profits on existing positions.');
  } else {
    parts.push('Market conditions are relatively balanced. Standard position sizing applies. Watch for breakout catalysts.');
  }

  parts.push('\n*Disclaimer: This is not financial advice. Always do your own research.*');

  return parts.join('\n');
}

export default router;
