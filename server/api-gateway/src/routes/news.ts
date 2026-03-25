import { Router, Request, Response } from 'express';
import redis from '../config/redis.js';
import logger from '../config/logger.js';

const router = Router();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NewsItem {
  id: string;
  title: string;
  description: string;
  source: string;
  category: 'market' | 'regulatory' | 'technology' | 'exchange' | 'defi';
  sentiment: 'bullish' | 'bearish' | 'neutral';
  publishedAt: string;
  url: string;
}

// ---------------------------------------------------------------------------
// Sentiment analysis based on keywords
// ---------------------------------------------------------------------------

const BULLISH_KEYWORDS = [
  'surge', 'rally', 'bullish', 'soar', 'gain', 'rise', 'pump', 'breakout',
  'all-time high', 'ath', 'adoption', 'partnership', 'launch', 'upgrade',
  'approval', 'institutional', 'accumulation', 'growth', 'record',
];

const BEARISH_KEYWORDS = [
  'crash', 'dump', 'bearish', 'plunge', 'drop', 'decline', 'hack', 'exploit',
  'ban', 'regulation', 'crackdown', 'lawsuit', 'fraud', 'liquidation',
  'sell-off', 'selloff', 'collapse', 'fear', 'warning', 'vulnerability',
];

function analyzeSentiment(title: string): 'bullish' | 'bearish' | 'neutral' {
  const lower = title.toLowerCase();
  const bullishScore = BULLISH_KEYWORDS.filter((kw) => lower.includes(kw)).length;
  const bearishScore = BEARISH_KEYWORDS.filter((kw) => lower.includes(kw)).length;

  if (bullishScore > bearishScore) return 'bullish';
  if (bearishScore > bullishScore) return 'bearish';
  return 'neutral';
}

// ---------------------------------------------------------------------------
// Category detection
// ---------------------------------------------------------------------------

function detectCategory(title: string, description: string): NewsItem['category'] {
  const text = `${title} ${description}`.toLowerCase();

  if (/defi|dex|yield|liquidity|aave|uniswap|compound|staking/.test(text)) return 'defi';
  if (/regulation|sec|law|compliance|ban|legal|government|policy/.test(text)) return 'regulatory';
  if (/exchange|binance|coinbase|kraken|okx|bybit|trading/.test(text)) return 'exchange';
  if (/upgrade|protocol|blockchain|layer|network|fork|development|smart contract/.test(text)) return 'technology';
  return 'market';
}

// ---------------------------------------------------------------------------
// Mock news (fallback)
// ---------------------------------------------------------------------------

const MOCK_NEWS: Omit<NewsItem, 'id' | 'sentiment' | 'category'>[] = [
  {
    title: 'Bitcoin Surges Past Key Resistance as Institutional Demand Grows',
    description: 'Bitcoin has broken through a major resistance level as institutional investors continue to accumulate. Analysts point to increased ETF inflows and corporate treasury adoption as primary catalysts for the latest move.',
    source: 'CryptoInsight',
    publishedAt: new Date(Date.now() - 15 * 60_000).toISOString(),
    url: 'https://example.com/btc-surge',
  },
  {
    title: 'SEC Delays Decision on Ethereum ETF Applications',
    description: 'The U.S. Securities and Exchange Commission has pushed back its deadline for reviewing several spot Ethereum ETF applications, citing the need for additional public comment periods.',
    source: 'CoinDesk',
    publishedAt: new Date(Date.now() - 45 * 60_000).toISOString(),
    url: 'https://example.com/sec-eth-etf',
  },
  {
    title: 'Uniswap V4 Launch Brings Major DeFi Innovations',
    description: 'Uniswap has officially launched its V4 protocol upgrade, introducing hooks and custom pool logic that could reshape decentralized exchange architecture.',
    source: 'DeFi Pulse',
    publishedAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
    url: 'https://example.com/uniswap-v4',
  },
  {
    title: 'Binance Reports Record Trading Volume Amid Market Rally',
    description: 'Binance has reported its highest 24-hour trading volume in months as cryptocurrency markets experience a broad-based rally across major and mid-cap assets.',
    source: 'The Block',
    publishedAt: new Date(Date.now() - 3 * 3600_000).toISOString(),
    url: 'https://example.com/binance-volume',
  },
  {
    title: 'Ethereum Layer 2 Networks Hit New Transaction Records',
    description: 'Arbitrum and Optimism have both achieved new daily transaction records, signaling growing adoption of Ethereum scaling solutions and reduced mainnet congestion.',
    source: 'L2Beat',
    publishedAt: new Date(Date.now() - 4 * 3600_000).toISOString(),
    url: 'https://example.com/l2-records',
  },
  {
    title: 'Major Crypto Hack: DeFi Protocol Loses $12M in Exploit',
    description: 'A vulnerability in a prominent DeFi lending protocol was exploited, resulting in the loss of approximately $12 million in user funds. The team has paused the protocol and is investigating.',
    source: 'Rekt News',
    publishedAt: new Date(Date.now() - 5 * 3600_000).toISOString(),
    url: 'https://example.com/defi-hack',
  },
  {
    title: 'Solana Ecosystem Sees Surge in Developer Activity',
    description: 'Developer activity on Solana has increased significantly over the past quarter, with new projects spanning DeFi, gaming, and NFT infrastructure launching on the network.',
    source: 'Messari',
    publishedAt: new Date(Date.now() - 6 * 3600_000).toISOString(),
    url: 'https://example.com/solana-dev',
  },
  {
    title: 'Central Banks Accelerate CBDC Research Amid Crypto Growth',
    description: 'Multiple central banks worldwide are fast-tracking their digital currency research programs as cryptocurrency adoption continues to expand among retail and institutional users.',
    source: 'Reuters Crypto',
    publishedAt: new Date(Date.now() - 7 * 3600_000).toISOString(),
    url: 'https://example.com/cbdc-research',
  },
  {
    title: 'Bitcoin Mining Difficulty Reaches All-Time High',
    description: 'Bitcoin network mining difficulty has hit a new record, reflecting increased hash rate and miner competition following the recent price appreciation.',
    source: 'CoinMetrics',
    publishedAt: new Date(Date.now() - 8 * 3600_000).toISOString(),
    url: 'https://example.com/btc-mining',
  },
  {
    title: 'Aave Governance Approves Cross-Chain Expansion Proposal',
    description: 'Aave token holders have voted to approve a governance proposal for deploying the protocol on two additional blockchain networks, expanding its multi-chain DeFi presence.',
    source: 'Aave Blog',
    publishedAt: new Date(Date.now() - 9 * 3600_000).toISOString(),
    url: 'https://example.com/aave-crosschain',
  },
  {
    title: 'Crypto Market Fear & Greed Index Shifts to Extreme Greed',
    description: 'The popular crypto sentiment indicator has moved into "Extreme Greed" territory for the first time in months, historically a signal for potential short-term corrections.',
    source: 'Alternative.me',
    publishedAt: new Date(Date.now() - 10 * 3600_000).toISOString(),
    url: 'https://example.com/fear-greed',
  },
  {
    title: 'European Union Finalizes MiCA Crypto Regulation Framework',
    description: 'The EU has finalized its Markets in Crypto-Assets regulation, establishing comprehensive rules for crypto-asset service providers operating within the European market.',
    source: 'CoinTelegraph',
    publishedAt: new Date(Date.now() - 12 * 3600_000).toISOString(),
    url: 'https://example.com/mica-eu',
  },
];

// ---------------------------------------------------------------------------
// Fetch from CryptoPanic or fallback to mock
// ---------------------------------------------------------------------------

async function fetchFromCryptoPanic(): Promise<NewsItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  const token = process.env.CRYPTOPANIC_API_TOKEN || 'free';
  const response = await fetch(
    `https://cryptopanic.com/api/free/v1/posts/?auth_token=${token}&public=true&kind=news`,
    { signal: controller.signal }
  );
  clearTimeout(timeout);

  if (!response.ok) throw new Error(`CryptoPanic returned ${response.status}`);

  const json = await response.json() as {
    results?: Array<{
      title: string;
      url: string;
      source: { title: string };
      published_at: string;
      currencies?: Array<{ code: string }>;
    }>;
  };

  const results = json.results ?? [];
  if (results.length === 0) throw new Error('No results from CryptoPanic');

  return results.map((item, i) => {
    const title = item.title || 'Crypto News';
    const currencies = (item.currencies ?? []).map((c) => c.code).join(', ');
    const description = currencies ? `Related to: ${currencies}` : '';
    const source = item.source?.title || 'CryptoPanic';

    return {
      id: `cp-${i}-${Date.now()}`,
      title,
      description,
      source,
      category: detectCategory(title, description),
      sentiment: analyzeSentiment(title),
      publishedAt: item.published_at || new Date().toISOString(),
      url: item.url || 'https://cryptopanic.com',
    };
  });
}

async function fetchNews(): Promise<NewsItem[]> {
  try {
    return await fetchFromCryptoPanic();
  } catch (err) {
    logger.warn('CryptoPanic news fetch failed, using mock data', {
      error: (err as Error).message,
    });

    return MOCK_NEWS.map((item, i) => ({
      ...item,
      id: `mock-${i}-${Date.now()}`,
      category: detectCategory(item.title, item.description),
      sentiment: analyzeSentiment(item.title),
    }));
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/news
// ---------------------------------------------------------------------------

const CACHE_KEY = 'news:feed';
const CACHE_TTL = 300; // 5 minutes

router.get('/', async (_req: Request, res: Response) => {
  try {
    // Check Redis cache
    const cached = await redis.get(CACHE_KEY);
    if (cached) {
      res.json({ success: true, data: JSON.parse(cached) });
      return;
    }

    // Fetch fresh
    const news = await fetchNews();

    // Cache in Redis
    await redis.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(news));

    res.json({ success: true, data: news });
  } catch (err) {
    logger.error('News route error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
