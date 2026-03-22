import { Router, Request, Response } from 'express';
import redis from '../../config/redis.js';
import logger from '../../config/logger.js';
import { CircuitBreaker } from '@quantis/shared';

const router = Router();

// Circuit breaker for external API calls
const defiLlamaBreaker = new CircuitBreaker('defillama', {
  failureThreshold: 3,
  resetTimeout: 60_000,
  onStateChange: (name, from, to) => {
    logger.warn(`Circuit breaker "${name}" transitioned ${from} → ${to}`);
  },
});

// --- DeFi TVL Tracker (Real data from DeFiLlama API) ---

// Fallback data used when DeFiLlama API is unavailable
const DEFI_FALLBACK = [
  { name: 'Lido', tvl: 28_400_000_000, chain: 'Ethereum', category: 'Liquid Staking' },
  { name: 'Aave', tvl: 12_500_000_000, chain: 'Multi-chain', category: 'Lending' },
  { name: 'MakerDAO', tvl: 8_700_000_000, chain: 'Ethereum', category: 'CDP' },
  { name: 'Uniswap', tvl: 5_800_000_000, chain: 'Multi-chain', category: 'Dexes' },
  { name: 'Curve', tvl: 3_200_000_000, chain: 'Multi-chain', category: 'Dexes' },
  { name: 'Compound', tvl: 2_800_000_000, chain: 'Ethereum', category: 'Lending' },
  { name: 'PancakeSwap', tvl: 2_100_000_000, chain: 'BSC', category: 'Dexes' },
  { name: 'Raydium', tvl: 1_200_000_000, chain: 'Solana', category: 'Dexes' },
  { name: 'Jupiter', tvl: 900_000_000, chain: 'Solana', category: 'Dexes' },
  { name: 'GMX', tvl: 700_000_000, chain: 'Arbitrum', category: 'Derivatives' },
];

interface DefiLlamaProtocol {
  name: string;
  tvl: number;
  chain: string;
  chains: string[];
  category: string;
  change_1d?: number;
  change_7d?: number;
  symbol?: string;
  url?: string;
}

// GET /defi — Real DeFi TVL data from DeFiLlama (free, no API key)
router.get('/defi', async (_req: Request, res: Response) => {
  try {
    // Check cache (10 min)
    const cached = await redis.get('market:defi');
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    const protocols = await defiLlamaBreaker.call(
      async () => {
        const response = await fetch('https://api.llama.fi/protocols');
        if (!response.ok) throw new Error(`DeFiLlama API ${response.status}`);
        const data = (await response.json()) as DefiLlamaProtocol[];

        // Take top 30 by TVL
        return data
          .filter((p) => p.tvl > 0)
          .sort((a, b) => b.tvl - a.tvl)
          .slice(0, 30)
          .map((p) => ({
            name: p.name,
            symbol: p.symbol || '',
            tvl: Math.round(p.tvl),
            chain: p.chains?.length > 1 ? 'Multi-chain' : (p.chain || 'Unknown'),
            category: p.category || 'Other',
            tvlChange24h: p.change_1d ? Math.round(p.change_1d * 100) / 100 : 0,
            tvlChange7d: p.change_7d ? Math.round(p.change_7d * 100) / 100 : 0,
            url: p.url,
          }));
      },
      () => {
        logger.warn('DeFiLlama circuit breaker fallback — using cached data');
        return DEFI_FALLBACK.map((p) => ({
          ...p,
          symbol: '',
          tvlChange24h: 0,
          tvlChange7d: 0,
          url: undefined,
        }));
      },
    );

    const totalTvl = protocols.reduce((sum, p) => sum + p.tvl, 0);

    const response = {
      success: true,
      data: {
        protocols,
        totalTvl,
        protocolCount: protocols.length,
        source: 'defillama',
      },
    };

    await redis.set('market:defi', JSON.stringify(response), 'EX', 600);
    res.json(response);
  } catch (err) {
    logger.error('DeFi TVL error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /dev-activity — Mock developer activity for top projects
router.get('/dev-activity', async (_req: Request, res: Response) => {
  try {
    const cacheKey = 'market:dev-activity';
    const cached = await redis.get(cacheKey);
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    const projects = [
      {
        symbol: 'BTC',
        name: 'Bitcoin',
        weeklyCommits: 85,
        activeDevs: 45,
        stars: 75000,
        openIssues: 420,
        lastRelease: '2026-01-15',
        devScore: 92,
      },
      {
        symbol: 'ETH',
        name: 'Ethereum',
        weeklyCommits: 120,
        activeDevs: 180,
        stars: 47000,
        openIssues: 1250,
        lastRelease: '2026-02-28',
        devScore: 95,
      },
      {
        symbol: 'SOL',
        name: 'Solana',
        weeklyCommits: 95,
        activeDevs: 80,
        stars: 12000,
        openIssues: 340,
        lastRelease: '2026-03-05',
        devScore: 78,
      },
      {
        symbol: 'DOT',
        name: 'Polkadot',
        weeklyCommits: 70,
        activeDevs: 55,
        stars: 7100,
        openIssues: 280,
        lastRelease: '2026-02-10',
        devScore: 72,
      },
      {
        symbol: 'LINK',
        name: 'Chainlink',
        weeklyCommits: 40,
        activeDevs: 30,
        stars: 5200,
        openIssues: 95,
        lastRelease: '2026-01-22',
        devScore: 58,
      },
    ];

    const response = { success: true, data: { projects } };
    await redis.set(cacheKey, JSON.stringify(response), 'EX', 1800);
    res.json(response);
  } catch (err) {
    logger.error('Dev activity error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /network-metrics/:symbol — Mock network health metrics
router.get('/network-metrics/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const cacheKey = `market:network-metrics:${symbol}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    const metricsMap: Record<string, {
      dailyActiveAddresses: number;
      txCount: number;
      transferValueUsd: number;
      nvtRatio: number;
      metcalfeRatio: number;
      newAddresses: number;
      giniCoefficient: number;
      healthScore: number;
      interpretation: string;
    }> = {
      BTC: {
        dailyActiveAddresses: 900000,
        txCount: 350000,
        transferValueUsd: 25000000000,
        nvtRatio: 45,
        metcalfeRatio: 1.12,
        newAddresses: 450000,
        giniCoefficient: 0.65,
        healthScore: 88,
        interpretation: 'Strong network activity. High transfer value with stable active addresses indicates healthy usage. NVT ratio suggests fair valuation relative to on-chain throughput.',
      },
      BTCUSDT: {
        dailyActiveAddresses: 900000,
        txCount: 350000,
        transferValueUsd: 25000000000,
        nvtRatio: 45,
        metcalfeRatio: 1.12,
        newAddresses: 450000,
        giniCoefficient: 0.65,
        healthScore: 88,
        interpretation: 'Strong network activity. High transfer value with stable active addresses indicates healthy usage. NVT ratio suggests fair valuation relative to on-chain throughput.',
      },
      ETH: {
        dailyActiveAddresses: 500000,
        txCount: 1200000,
        transferValueUsd: 8000000000,
        nvtRatio: 38,
        metcalfeRatio: 0.95,
        newAddresses: 120000,
        giniCoefficient: 0.72,
        healthScore: 82,
        interpretation: 'Very high transaction count driven by DeFi and NFT activity. NVT ratio is low, suggesting the network is heavily utilized relative to market cap. High Gini indicates whale concentration.',
      },
      ETHUSDT: {
        dailyActiveAddresses: 500000,
        txCount: 1200000,
        transferValueUsd: 8000000000,
        nvtRatio: 38,
        metcalfeRatio: 0.95,
        newAddresses: 120000,
        giniCoefficient: 0.72,
        healthScore: 82,
        interpretation: 'Very high transaction count driven by DeFi and NFT activity. NVT ratio is low, suggesting the network is heavily utilized relative to market cap. High Gini indicates whale concentration.',
      },
      SOL: {
        dailyActiveAddresses: 2000000,
        txCount: 40000000,
        transferValueUsd: 3000000000,
        nvtRatio: 15,
        metcalfeRatio: 1.85,
        newAddresses: 800000,
        giniCoefficient: 0.58,
        healthScore: 75,
        interpretation: 'Extremely high transaction throughput with many active addresses. Low NVT suggests heavy usage. High Metcalfe ratio may indicate overvaluation relative to network size. Strong new address growth.',
      },
      SOLUSDT: {
        dailyActiveAddresses: 2000000,
        txCount: 40000000,
        transferValueUsd: 3000000000,
        nvtRatio: 15,
        metcalfeRatio: 1.85,
        newAddresses: 800000,
        giniCoefficient: 0.58,
        healthScore: 75,
        interpretation: 'Extremely high transaction throughput with many active addresses. Low NVT suggests heavy usage. High Metcalfe ratio may indicate overvaluation relative to network size. Strong new address growth.',
      },
    };

    const metrics = metricsMap[symbol];
    if (!metrics) {
      res.status(404).json({ success: false, error: `No network metrics available for ${symbol}. Supported: BTC, ETH, SOL` });
      return;
    }

    const { healthScore, interpretation, ...metricValues } = metrics;

    const response = {
      success: true,
      data: {
        symbol,
        metrics: metricValues,
        healthScore,
        interpretation,
      },
    };

    await redis.set(cacheKey, JSON.stringify(response), 'EX', 1800);
    res.json(response);
  } catch (err) {
    logger.error('Network metrics error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /btc-models — Bitcoin valuation models
router.get('/btc-models', async (_req: Request, res: Response) => {
  try {
    const cacheKey = 'market:btc-models';
    const cached = await redis.get(cacheKey);
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    // Get current BTC price
    let currentPrice = 97500;
    const btcData = await redis.get('ticker:binance:BTCUSDT');
    if (btcData) {
      const parsed = JSON.parse(btcData);
      currentPrice = parsed.price ?? currentPrice;
    }

    // Bitcoin genesis: Jan 3, 2009
    const genesisDate = new Date('2009-01-03');
    const daysSinceGenesis = Math.floor((Date.now() - genesisDate.getTime()) / 86400000);

    // Stock-to-Flow model
    const s2fRatio = 120;
    const s2fFairValue = Math.round(Math.exp(3.21 * Math.log(s2fRatio) - 1.6));
    const s2fDeviation = Math.round(((currentPrice - s2fFairValue) / s2fFairValue) * 10000) / 100;

    // Rainbow Chart (log regression)
    const logFairValue = 2.66 * Math.log10(daysSinceGenesis) - 17.01;
    const rainbowFairValue = Math.round(Math.pow(10, logFairValue));
    const rainbowDeviation = Math.round(((currentPrice - rainbowFairValue) / rainbowFairValue) * 10000) / 100;
    const priceRatio = currentPrice / rainbowFairValue;
    let rainbowBand = 'Fair Value';
    if (priceRatio < 0.5) rainbowBand = 'Fire Sale';
    else if (priceRatio < 0.8) rainbowBand = 'Accumulate';
    else if (priceRatio < 1.0) rainbowBand = 'Still Cheap';
    else if (priceRatio < 1.5) rainbowBand = 'Fair Value';
    else if (priceRatio < 2.5) rainbowBand = 'FOMO';
    else rainbowBand = 'Bubble';

    // Pi Cycle Top Indicator
    const simulated350DMA = currentPrice * 0.85;
    const simulated111DMA = currentPrice * 0.95;
    const piCycleThreshold = simulated350DMA * 2;
    const piCycleCrossed = simulated111DMA >= piCycleThreshold;
    const piCycleDistance = Math.round(((piCycleThreshold - simulated111DMA) / piCycleThreshold) * 10000) / 100;

    // MVRV Z-Score
    const realizedPrice = 35000;
    const mvrvRatio = currentPrice / realizedPrice;
    const zScore = Math.round((mvrvRatio - 1) * 100) / 100;
    const mvrvSignal = zScore > 7 ? 'overvalued' : zScore > 3 ? 'fair' : 'undervalued';

    // Power Law model
    const powerLawLog = 5.71 * Math.log10(daysSinceGenesis) - 38.24;
    const powerLawFairValue = Math.round(Math.pow(10, powerLawLog));
    const powerLawDeviation = Math.round(((currentPrice - powerLawFairValue) / powerLawFairValue) * 10000) / 100;

    const models = [
      {
        name: 'Stock-to-Flow',
        fairValue: s2fFairValue,
        deviation: s2fDeviation,
        signal: (s2fDeviation < -20 ? 'undervalued' : s2fDeviation > 20 ? 'overvalued' : 'fair') as 'undervalued' | 'fair' | 'overvalued',
        description: `S2F ratio of ${s2fRatio} post-halving. Model predicts $${s2fFairValue.toLocaleString()} fair value.`,
      },
      {
        name: 'Rainbow Chart',
        fairValue: rainbowFairValue,
        deviation: rainbowDeviation,
        signal: (rainbowDeviation < -20 ? 'undervalued' : rainbowDeviation > 50 ? 'overvalued' : 'fair') as 'undervalued' | 'fair' | 'overvalued',
        description: `Log regression band: "${rainbowBand}". Fair value at $${rainbowFairValue.toLocaleString()}.`,
      },
      {
        name: 'Pi Cycle Top',
        fairValue: Math.round(piCycleThreshold),
        deviation: -piCycleDistance,
        signal: (piCycleCrossed ? 'overvalued' : 'undervalued') as 'undervalued' | 'fair' | 'overvalued',
        description: piCycleCrossed
          ? 'WARNING: 111DMA has crossed above 350DMA x 2. Historical top signal triggered.'
          : `111DMA is ${piCycleDistance}% below the 350DMA x 2 threshold. No top signal.`,
      },
      {
        name: 'MVRV Z-Score',
        fairValue: realizedPrice,
        deviation: Math.round((mvrvRatio - 1) * 100),
        signal: mvrvSignal as 'undervalued' | 'fair' | 'overvalued',
        description: `MVRV ratio: ${mvrvRatio.toFixed(2)}x. Z-Score: ${zScore}. ${zScore > 7 ? 'Extremely overheated.' : zScore > 3 ? 'Elevated but not extreme.' : 'Healthy range.'}`,
      },
      {
        name: 'Power Law',
        fairValue: powerLawFairValue,
        deviation: powerLawDeviation,
        signal: (powerLawDeviation < -30 ? 'undervalued' : powerLawDeviation > 50 ? 'overvalued' : 'fair') as 'undervalued' | 'fair' | 'overvalued',
        description: `Power law corridor model. Fair value: $${powerLawFairValue.toLocaleString()}.`,
      },
    ];

    // Overall signal: majority vote
    const signals = models.map((m) => m.signal);
    const underCount = signals.filter((s) => s === 'undervalued').length;
    const overCount = signals.filter((s) => s === 'overvalued').length;
    let overallSignal: 'undervalued' | 'fair' | 'overvalued' = 'fair';
    if (underCount >= 3) overallSignal = 'undervalued';
    else if (overCount >= 3) overallSignal = 'overvalued';

    const response = {
      success: true,
      data: {
        currentPrice,
        models,
        overallSignal,
      },
    };

    await redis.set(cacheKey, JSON.stringify(response), 'EX', 1800);
    res.json(response);
  } catch (err) {
    logger.error('BTC models error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /multi-asset — Simulated TradFi + macro data (Intermarket)
router.get('/multi-asset', async (_req: Request, res: Response) => {
  try {
    const cacheKey = 'market:multi-asset';
    const cached = await redis.get(cacheKey);
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    // Try to get live BTC price for correlation reference
    let btcPrice = 97500;
    const btcData = await redis.get('ticker:binance:BTCUSDT');
    if (btcData) {
      const parsed = JSON.parse(btcData);
      btcPrice = parsed.price ?? btcPrice;
    }

    const assets = [
      { name: 'S&P 500', symbol: 'SPX', price: 5430, change24h: 0.3, category: 'Indices' },
      { name: 'NASDAQ', symbol: 'NDX', price: 17200, change24h: 0.5, category: 'Indices' },
      { name: 'DXY', symbol: 'DXY', price: 104.2, change24h: -0.1, category: 'Forex' },
      { name: 'Gold', symbol: 'XAU', price: 2340, change24h: 0.2, category: 'Commodities' },
      { name: 'Silver', symbol: 'XAG', price: 29.50, change24h: 0.5, category: 'Commodities' },
      { name: 'Oil WTI', symbol: 'WTI', price: 78.30, change24h: -0.8, category: 'Commodities' },
      { name: 'US 10Y Yield', symbol: 'US10Y', price: 4.35, change24h: 0.02, category: 'Bonds' },
      { name: 'US 2Y Yield', symbol: 'US2Y', price: 4.72, change24h: -0.01, category: 'Bonds' },
      { name: 'VIX', symbol: 'VIX', price: 14.2, change24h: -1.5, category: 'Indices' },
      { name: 'Bitcoin', symbol: 'BTC', price: btcPrice, change24h: 1.2, category: 'Crypto' },
    ];

    const correlations = [
      { pair: 'BTC/SPX', value: 0.62 },
      { pair: 'BTC/NDX', value: 0.68 },
      { pair: 'BTC/DXY', value: -0.45 },
      { pair: 'BTC/Gold', value: 0.32 },
      { pair: 'BTC/Silver', value: 0.28 },
      { pair: 'BTC/Oil', value: 0.15 },
      { pair: 'BTC/US10Y', value: -0.22 },
      { pair: 'BTC/VIX', value: -0.55 },
    ];

    // Risk-on/off determination
    const spxChange = assets.find((a) => a.symbol === 'SPX')!.change24h;
    const dxyChange = assets.find((a) => a.symbol === 'DXY')!.change24h;
    const vixPrice = assets.find((a) => a.symbol === 'VIX')!.price;
    let riskOnOff: 'risk-on' | 'risk-off' | 'neutral' = 'neutral';
    if (spxChange > 0 && dxyChange < 0 && vixPrice < 20) riskOnOff = 'risk-on';
    else if (spxChange < -0.5 || vixPrice > 25) riskOnOff = 'risk-off';

    const response = {
      success: true,
      data: {
        assets,
        correlations,
        riskOnOff,
        updatedAt: new Date().toISOString(),
      },
    };

    await redis.set(cacheKey, JSON.stringify(response), 'EX', 1800);
    res.json(response);
  } catch (err) {
    logger.error('Multi-asset error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
