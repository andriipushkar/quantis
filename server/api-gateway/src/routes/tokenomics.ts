import { Router, Request, Response } from 'express';
import redis from '../config/redis.js';
import logger from '../config/logger.js';

const router = Router();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TokenUnlock {
  date: string;
  amount: number;
  description: string;
}

interface TokenomicsData {
  symbol: string;
  name: string;
  circulatingSupply: number;
  maxSupply: number | null; // null = infinite
  inflationRate: number;
  fdv: number;
  supplyRatio: number;
  unlocks: TokenUnlock[];
  score: number;
  scoreExplanation: string;
}

// ---------------------------------------------------------------------------
// Mock Tokenomics Database
// ---------------------------------------------------------------------------

const PRICE_ESTIMATES: Record<string, number> = {
  BTC: 97_500,
  ETH: 3_650,
  SOL: 185,
  BNB: 620,
  XRP: 2.35,
};

const TOKENOMICS_DB: Record<string, TokenomicsData> = {
  BTC: {
    symbol: 'BTC',
    name: 'Bitcoin',
    circulatingSupply: 19_600_000,
    maxSupply: 21_000_000,
    inflationRate: 1.7,
    fdv: 21_000_000 * PRICE_ESTIMATES.BTC,
    supplyRatio: 19_600_000 / 21_000_000,
    unlocks: [
      {
        date: '2028-04-01',
        amount: 0,
        description: 'Next halving — block reward drops to 1.5625 BTC',
      },
    ],
    score: 95,
    scoreExplanation:
      'Hard-capped supply at 21M, decreasing inflation via halvings, highest decentralization. Near-perfect tokenomics.',
  },
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    circulatingSupply: 120_200_000,
    maxSupply: null,
    inflationRate: 0.5,
    fdv: 120_200_000 * PRICE_ESTIMATES.ETH,
    supplyRatio: 1.0,
    unlocks: [],
    score: 88,
    scoreExplanation:
      'Post-merge net issuance near zero or deflationary during high activity. No max cap but burn mechanism (EIP-1559) offsets inflation.',
  },
  SOL: {
    symbol: 'SOL',
    name: 'Solana',
    circulatingSupply: 440_000_000,
    maxSupply: null,
    inflationRate: 5.5,
    fdv: 440_000_000 * PRICE_ESTIMATES.SOL,
    supplyRatio: 1.0,
    unlocks: [
      {
        date: '2026-06-15',
        amount: 12_000_000,
        description: 'Foundation staking unlock — 12M SOL',
      },
    ],
    score: 65,
    scoreExplanation:
      'High current inflation rate (5.5%) decreasing 15% annually. Large foundation/VC holdings still vesting. No supply cap.',
  },
  BNB: {
    symbol: 'BNB',
    name: 'BNB',
    circulatingSupply: 145_000_000,
    maxSupply: 200_000_000,
    inflationRate: -1.2,
    fdv: 200_000_000 * PRICE_ESTIMATES.BNB,
    supplyRatio: 145_000_000 / 200_000_000,
    unlocks: [],
    score: 72,
    scoreExplanation:
      'Quarterly auto-burn mechanism makes it deflationary. Centralized supply distribution (Binance holds majority). Capped at 200M.',
  },
  XRP: {
    symbol: 'XRP',
    name: 'XRP',
    circulatingSupply: 54_000_000_000,
    maxSupply: 100_000_000_000,
    inflationRate: 4.2,
    fdv: 100_000_000_000 * PRICE_ESTIMATES.XRP,
    supplyRatio: 54_000_000_000 / 100_000_000_000,
    unlocks: [
      {
        date: '2026-04-01',
        amount: 1_000_000_000,
        description: 'Monthly escrow release — 1B XRP',
      },
      {
        date: '2026-05-01',
        amount: 1_000_000_000,
        description: 'Monthly escrow release — 1B XRP',
      },
    ],
    score: 48,
    scoreExplanation:
      'Large percentage still locked in Ripple escrow (46B). Monthly 1B releases create selling pressure. Centralized distribution.',
  },
};

// ---------------------------------------------------------------------------
// GET /api/v1/tokenomics/:symbol — Single token tokenomics
// ---------------------------------------------------------------------------

const CACHE_TTL = 1800; // 30 minutes

router.get('/compare', async (req: Request, res: Response) => {
  try {
    const symbolsParam = (req.query.symbols as string) || 'BTC,ETH,SOL,BNB,XRP';
    const symbols = symbolsParam
      .toUpperCase()
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const cacheKey = `tokenomics:compare:${symbols.sort().join(',')}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      res.json({ success: true, data: JSON.parse(cached) });
      return;
    }

    const results: TokenomicsData[] = [];
    for (const sym of symbols) {
      const data = TOKENOMICS_DB[sym];
      if (data) results.push(data);
    }

    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(results));
    res.json({ success: true, data: results });
  } catch (err) {
    logger.error('Tokenomics compare error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();

    const cacheKey = `tokenomics:${symbol}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      res.json({ success: true, data: JSON.parse(cached) });
      return;
    }

    const data = TOKENOMICS_DB[symbol];
    if (!data) {
      res.status(404).json({ success: false, error: `Tokenomics data not available for ${symbol}` });
      return;
    }

    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(data));
    res.json({ success: true, data });
  } catch (err) {
    logger.error('Tokenomics detail error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
