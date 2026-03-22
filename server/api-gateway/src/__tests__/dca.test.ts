/**
 * DCA (Dollar-Cost Averaging) Bot — Unit Tests
 *
 * Tests the pure business logic: validation rules, bot CRUD operations,
 * and simulation calculations (standard, RSI-weighted, fear & greed).
 */

// ---------------------------------------------------------------------------
// Helpers extracted / mirrored from routes/dca.ts
// ---------------------------------------------------------------------------

const VALID_INTERVALS = ['daily', 'weekly'] as const;
const VALID_STRATEGIES = ['standard', 'rsi_weighted', 'fear_greed'] as const;

type Interval = (typeof VALID_INTERVALS)[number];
type Strategy = (typeof VALID_STRATEGIES)[number];

interface DCABot {
  id: string;
  userId: string;
  symbol: string;
  baseAmount: number;
  interval: Interval;
  strategy: Strategy;
  createdAt: string;
}

function validateCreateParams(params: {
  symbol?: string;
  baseAmount?: unknown;
  interval?: string;
  strategy?: string;
}): { error: string } | { bot: Omit<DCABot, 'id' | 'createdAt'> } {
  const { symbol, baseAmount, interval, strategy } = params;

  if (!symbol || !baseAmount || !interval || !strategy) {
    return { error: 'symbol, baseAmount, interval, and strategy are required' };
  }
  if (!VALID_INTERVALS.includes(interval as Interval)) {
    return { error: 'interval must be "daily" or "weekly"' };
  }
  if (!VALID_STRATEGIES.includes(strategy as Strategy)) {
    return { error: 'strategy must be "standard", "rsi_weighted", or "fear_greed"' };
  }
  const amount = parseFloat(String(baseAmount));
  if (isNaN(amount) || amount <= 0) {
    return { error: 'baseAmount must be a positive number' };
  }

  return {
    bot: {
      userId: 'test-user',
      symbol: symbol.toUpperCase(),
      baseAmount: amount,
      interval: interval as Interval,
      strategy: strategy as Strategy,
    },
  };
}

/** RSI(14) calculation identical to routes/dca.ts */
function computeRSI(closes: number[], endIndex: number): number {
  if (endIndex < 14) return 50; // default when not enough data
  let gains = 0;
  let losses = 0;
  for (let i = endIndex - 13; i <= endIndex; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / 14;
  const avgLoss = losses / 14;
  return avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
}

/** Run the DCA simulation logic from routes/dca.ts */
function simulate(params: {
  baseAmount: number;
  interval: Interval;
  strategy: Strategy;
  dailyCloses: number[];
  fearGreedScore?: number;
}) {
  const { baseAmount, interval, strategy, dailyCloses, fearGreedScore = 50 } = params;

  const step = interval === 'weekly' ? 7 : 1;
  const purchases: Array<{ index: number; amount: number; price: number; quantity: number }> = [];
  let totalInvested = 0;
  let totalQuantity = 0;

  // Pre-compute a default RSI from the last 14 candles (matches the route)
  let currentRsi = 50;
  if (strategy === 'rsi_weighted' && dailyCloses.length >= 15) {
    currentRsi = computeRSI(dailyCloses, dailyCloses.length - 1);
  }

  for (let i = 0; i < dailyCloses.length; i += step) {
    let amount = baseAmount;

    if (strategy === 'rsi_weighted') {
      if (i >= 14) {
        const rsi = computeRSI(dailyCloses, i);
        amount = baseAmount * (2 - rsi / 50);
      } else {
        amount = baseAmount * (2 - currentRsi / 50);
      }
    } else if (strategy === 'fear_greed') {
      amount = baseAmount * (2 - fearGreedScore / 50);
    }

    amount = Math.max(1, amount);
    const quantity = amount / dailyCloses[i];

    purchases.push({ index: i, amount: Math.round(amount * 100) / 100, price: dailyCloses[i], quantity });
    totalInvested += amount;
    totalQuantity += quantity;
  }

  const lastPrice = dailyCloses[dailyCloses.length - 1];
  const currentValue = totalQuantity * lastPrice;
  const roi = totalInvested > 0 ? ((currentValue - totalInvested) / totalInvested) * 100 : 0;
  const avgBuyPrice = totalQuantity > 0 ? totalInvested / totalQuantity : 0;

  return {
    purchases,
    totalInvested: Math.round(totalInvested * 100) / 100,
    currentValue: Math.round(currentValue * 100) / 100,
    roi: Math.round(roi * 100) / 100,
    avgBuyPrice: Math.round(avgBuyPrice * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// Bot store helpers (mirrors in-memory Map logic)
// ---------------------------------------------------------------------------

function createBotStore() {
  const store = new Map<string, DCABot[]>();

  function getUserBots(userId: string): DCABot[] {
    if (!store.has(userId)) store.set(userId, []);
    return store.get(userId)!;
  }

  function addBot(userId: string, params: Omit<DCABot, 'id' | 'userId' | 'createdAt'>): DCABot {
    const bot: DCABot = {
      id: `dca_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      userId,
      createdAt: new Date().toISOString(),
      ...params,
    };
    getUserBots(userId).push(bot);
    return bot;
  }

  function deleteBot(userId: string, botId: string): boolean {
    const bots = getUserBots(userId);
    const idx = bots.findIndex((b) => b.id === botId);
    if (idx === -1) return false;
    bots.splice(idx, 1);
    return true;
  }

  return { getUserBots, addBot, deleteBot };
}

// ===========================================================================
// Tests
// ===========================================================================

describe('DCA — Validation', () => {
  test('rejects missing symbol', () => {
    const result = validateCreateParams({ baseAmount: 100, interval: 'daily', strategy: 'standard' });
    expect('error' in result).toBe(true);
  });

  test('rejects missing baseAmount', () => {
    const result = validateCreateParams({ symbol: 'BTCUSDT', interval: 'daily', strategy: 'standard' });
    expect('error' in result).toBe(true);
  });

  test('rejects invalid interval', () => {
    const result = validateCreateParams({ symbol: 'BTCUSDT', baseAmount: 100, interval: 'monthly', strategy: 'standard' });
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('interval');
    }
  });

  test('rejects invalid strategy', () => {
    const result = validateCreateParams({ symbol: 'BTCUSDT', baseAmount: 100, interval: 'daily', strategy: 'martingale' });
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('strategy');
    }
  });

  test('rejects negative baseAmount', () => {
    const result = validateCreateParams({ symbol: 'BTCUSDT', baseAmount: -50, interval: 'daily', strategy: 'standard' });
    expect('error' in result).toBe(true);
  });

  test('rejects zero baseAmount', () => {
    const result = validateCreateParams({ symbol: 'BTCUSDT', baseAmount: 0, interval: 'daily', strategy: 'standard' });
    expect('error' in result).toBe(true);
  });

  test('rejects non-numeric baseAmount', () => {
    const result = validateCreateParams({ symbol: 'BTCUSDT', baseAmount: 'abc', interval: 'daily', strategy: 'standard' });
    expect('error' in result).toBe(true);
  });

  test('accepts valid params and uppercases symbol', () => {
    const result = validateCreateParams({ symbol: 'btcusdt', baseAmount: 100, interval: 'daily', strategy: 'standard' });
    expect('bot' in result).toBe(true);
    if ('bot' in result) {
      expect(result.bot.symbol).toBe('BTCUSDT');
      expect(result.bot.baseAmount).toBe(100);
      expect(result.bot.interval).toBe('daily');
      expect(result.bot.strategy).toBe('standard');
    }
  });

  test('accepts weekly interval', () => {
    const result = validateCreateParams({ symbol: 'ETHUSDT', baseAmount: 50, interval: 'weekly', strategy: 'rsi_weighted' });
    expect('bot' in result).toBe(true);
  });

  test('accepts fear_greed strategy', () => {
    const result = validateCreateParams({ symbol: 'ETHUSDT', baseAmount: 50, interval: 'daily', strategy: 'fear_greed' });
    expect('bot' in result).toBe(true);
  });
});

describe('DCA — Bot CRUD (in-memory store)', () => {
  test('creates a bot and lists it', () => {
    const store = createBotStore();
    const bot = store.addBot('user-1', { symbol: 'BTCUSDT', baseAmount: 100, interval: 'daily', strategy: 'standard' });
    expect(bot.id).toBeDefined();
    expect(bot.userId).toBe('user-1');
    expect(bot.symbol).toBe('BTCUSDT');

    const bots = store.getUserBots('user-1');
    expect(bots).toHaveLength(1);
    expect(bots[0].id).toBe(bot.id);
  });

  test('returns empty array for new user', () => {
    const store = createBotStore();
    expect(store.getUserBots('unknown-user')).toHaveLength(0);
  });

  test('deletes existing bot', () => {
    const store = createBotStore();
    const bot = store.addBot('user-1', { symbol: 'BTCUSDT', baseAmount: 100, interval: 'daily', strategy: 'standard' });
    const deleted = store.deleteBot('user-1', bot.id);
    expect(deleted).toBe(true);
    expect(store.getUserBots('user-1')).toHaveLength(0);
  });

  test('delete returns false for non-existent bot', () => {
    const store = createBotStore();
    const deleted = store.deleteBot('user-1', 'dca_fake_id');
    expect(deleted).toBe(false);
  });

  test('delete returns false for wrong user', () => {
    const store = createBotStore();
    const bot = store.addBot('user-1', { symbol: 'BTCUSDT', baseAmount: 100, interval: 'daily', strategy: 'standard' });
    const deleted = store.deleteBot('user-2', bot.id);
    expect(deleted).toBe(false);
    // original user still has the bot
    expect(store.getUserBots('user-1')).toHaveLength(1);
  });
});

describe('DCA — Standard Simulation', () => {
  // 5 days of constant price => average price equals that price, ROI = 0
  test('constant price produces 0% ROI and correct avg buy price', () => {
    const closes = [100, 100, 100, 100, 100];
    const result = simulate({ baseAmount: 50, interval: 'daily', strategy: 'standard', dailyCloses: closes });
    expect(result.purchases).toHaveLength(5);
    expect(result.avgBuyPrice).toBe(100);
    expect(result.roi).toBe(0);
    expect(result.totalInvested).toBe(250);
  });

  test('rising price produces positive ROI', () => {
    const closes = [100, 110, 120, 130, 140];
    const result = simulate({ baseAmount: 100, interval: 'daily', strategy: 'standard', dailyCloses: closes });
    expect(result.roi).toBeGreaterThan(0);
    // Total invested = 500, avg buy price should be < 140
    expect(result.avgBuyPrice).toBeLessThan(140);
  });

  test('falling price produces negative ROI', () => {
    const closes = [100, 90, 80, 70, 60];
    const result = simulate({ baseAmount: 100, interval: 'daily', strategy: 'standard', dailyCloses: closes });
    expect(result.roi).toBeLessThan(0);
  });

  test('weekly interval buys every 7th candle', () => {
    const closes = Array.from({ length: 30 }, () => 100);
    const result = simulate({ baseAmount: 100, interval: 'weekly', strategy: 'standard', dailyCloses: closes });
    // indices 0, 7, 14, 21, 28 => 5 purchases
    expect(result.purchases).toHaveLength(5);
  });

  test('DCA outperforms lump-sum in falling-then-rising market', () => {
    // Price dips then recovers to original
    const closes = [100, 80, 60, 40, 60, 80, 100];
    const result = simulate({ baseAmount: 100, interval: 'daily', strategy: 'standard', dailyCloses: closes });
    // DCA buys more at lower prices so avg price < 100 => positive ROI at 100
    expect(result.avgBuyPrice).toBeLessThan(100);
    expect(result.roi).toBeGreaterThan(0);
  });
});

describe('DCA — RSI-weighted Simulation', () => {
  test('low RSI increases allocation (buy more when oversold)', () => {
    // Build a 20-candle series where price has been falling => low RSI
    const closes: number[] = [];
    for (let i = 0; i < 20; i++) {
      closes.push(100 - i * 2); // steadily falling
    }
    const result = simulate({ baseAmount: 100, interval: 'daily', strategy: 'rsi_weighted', dailyCloses: closes });

    // After index 14, RSI should be low => allocation > baseAmount
    const laterPurchases = result.purchases.filter((p) => p.index >= 14);
    expect(laterPurchases.length).toBeGreaterThan(0);
    for (const p of laterPurchases) {
      expect(p.amount).toBeGreaterThan(100);
    }
  });

  test('high RSI decreases allocation (buy less when overbought)', () => {
    // Steadily rising prices => high RSI
    const closes: number[] = [];
    for (let i = 0; i < 20; i++) {
      closes.push(100 + i * 3);
    }
    const result = simulate({ baseAmount: 100, interval: 'daily', strategy: 'rsi_weighted', dailyCloses: closes });

    const laterPurchases = result.purchases.filter((p) => p.index >= 14);
    expect(laterPurchases.length).toBeGreaterThan(0);
    for (const p of laterPurchases) {
      expect(p.amount).toBeLessThan(100);
    }
  });

  test('RSI = 50 keeps allocation at baseAmount', () => {
    // alternating +1 / -1 should give RSI near 50
    const closes = [100];
    for (let i = 1; i < 20; i++) {
      closes.push(closes[i - 1] + (i % 2 === 0 ? -1 : 1));
    }
    const rsi = computeRSI(closes, 19);
    // formula: amount = baseAmount * (2 - rsi/50).  When rsi=50 => multiplier = 1
    const multiplier = 2 - rsi / 50;
    expect(multiplier).toBeCloseTo(1, 0); // within 0.5 tolerance
  });

  test('amount never falls below 1', () => {
    // All rising => RSI near 100 => multiplier near 0
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i * 10);
    const result = simulate({ baseAmount: 1, interval: 'daily', strategy: 'rsi_weighted', dailyCloses: closes });
    for (const p of result.purchases) {
      expect(p.amount).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('DCA — Fear & Greed Simulation', () => {
  test('extreme fear (score=10) doubles allocation', () => {
    const closes = [100, 100, 100];
    const result = simulate({ baseAmount: 100, interval: 'daily', strategy: 'fear_greed', dailyCloses: closes, fearGreedScore: 10 });
    // multiplier = 2 - 10/50 = 2 - 0.2 = 1.8
    for (const p of result.purchases) {
      expect(p.amount).toBe(180);
    }
  });

  test('extreme greed (score=90) reduces allocation', () => {
    const closes = [100, 100, 100];
    const result = simulate({ baseAmount: 100, interval: 'daily', strategy: 'fear_greed', dailyCloses: closes, fearGreedScore: 90 });
    // multiplier = 2 - 90/50 = 2 - 1.8 = 0.2 => amount = 20
    for (const p of result.purchases) {
      expect(p.amount).toBe(20);
    }
  });

  test('neutral score (50) keeps allocation at baseAmount', () => {
    const closes = [100, 100, 100];
    const result = simulate({ baseAmount: 100, interval: 'daily', strategy: 'fear_greed', dailyCloses: closes, fearGreedScore: 50 });
    for (const p of result.purchases) {
      expect(p.amount).toBe(100);
    }
  });

  test('very high greed (score=100) floors allocation at 1', () => {
    const closes = [100, 100];
    // multiplier = 2 - 100/50 = 0 => amount = 0 => clamped to 1
    const result = simulate({ baseAmount: 100, interval: 'daily', strategy: 'fear_greed', dailyCloses: closes, fearGreedScore: 100 });
    for (const p of result.purchases) {
      expect(p.amount).toBe(1);
    }
  });
});

describe('DCA — RSI Calculation', () => {
  test('all gains => RSI = 100', () => {
    const closes = Array.from({ length: 16 }, (_, i) => 100 + i);
    expect(computeRSI(closes, 15)).toBe(100);
  });

  test('all losses => RSI = 0', () => {
    const closes = Array.from({ length: 16 }, (_, i) => 200 - i);
    expect(computeRSI(closes, 15)).toBeCloseTo(0, 5);
  });

  test('equal gains and losses => RSI = 50', () => {
    // alternating: +5, -5 over 14 periods => 7 gains of 5, 7 losses of 5
    const closes = [100];
    for (let i = 1; i <= 15; i++) {
      closes.push(closes[i - 1] + (i % 2 === 0 ? -5 : 5));
    }
    // gains: 7*5=35, losses: 7*5=35 => avgGain=2.5, avgLoss=2.5 => RS=1 => RSI=50
    expect(computeRSI(closes, 15)).toBeCloseTo(50, 5);
  });

  test('returns 50 when fewer than 15 data points', () => {
    expect(computeRSI([100, 110, 120], 2)).toBe(50);
  });
});
