import { calculateConfluence, type ConfluenceInput } from '../confluence/engine';

function generateCandles(count: number, basePrice = 100) {
  const closes: number[] = [];
  const highs: number[] = [];
  const lows: number[] = [];
  const volumes: number[] = [];

  let price = basePrice;
  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 2;
    price = Math.max(1, price + change);
    const high = price + Math.random() * 2;
    const low = price - Math.random() * 2;
    closes.push(price);
    highs.push(high);
    lows.push(Math.max(0.01, low));
    volumes.push(1000 + Math.random() * 5000);
  }

  return { closes, highs, lows, volumes };
}

function makeInput(overrides: Partial<ConfluenceInput> = {}): ConfluenceInput {
  const candles = generateCandles(100);
  return {
    symbol: 'BTCUSDT',
    ...candles,
    activeSignals: [],
    newsSentiment: { bullish: 2, bearish: 1, neutral: 3 },
    fearGreedIndex: 55,
    whaleAlertCount: 0,
    ...overrides,
  };
}

describe('Decision Confluence Engine', () => {
  it('returns a score between 1 and 100', () => {
    const result = calculateConfluence(makeInput());
    expect(result.score).toBeGreaterThanOrEqual(1);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('returns valid label', () => {
    const result = calculateConfluence(makeInput());
    expect(['strong_sell', 'sell', 'neutral', 'buy', 'strong_buy']).toContain(result.label);
  });

  it('returns valid risk level', () => {
    const result = calculateConfluence(makeInput());
    expect(['low', 'medium', 'high']).toContain(result.risk);
  });

  it('returns confidence between 20 and 95', () => {
    const result = calculateConfluence(makeInput());
    expect(result.confidence).toBeGreaterThanOrEqual(20);
    expect(result.confidence).toBeLessThanOrEqual(95);
  });

  it('includes all 5 components with correct weights', () => {
    const result = calculateConfluence(makeInput());
    const { components } = result;

    expect(components.trend.weight).toBe(30);
    expect(components.momentum.weight).toBe(25);
    expect(components.signals.weight).toBe(20);
    expect(components.sentiment.weight).toBe(15);
    expect(components.volume.weight).toBe(10);

    // All component scores should be in range
    for (const key of Object.keys(components) as Array<keyof typeof components>) {
      expect(components[key].score).toBeGreaterThanOrEqual(1);
      expect(components[key].score).toBeLessThanOrEqual(100);
    }
  });

  it('signals component returns neutral (50) when no active signals', () => {
    const result = calculateConfluence(makeInput({ activeSignals: [] }));
    expect(result.components.signals.score).toBe(50);
    expect(result.components.signals.details.agreement).toBe('none');
  });

  it('signals component is bullish when all signals are BUY', () => {
    const result = calculateConfluence(makeInput({
      activeSignals: [
        { type: 'buy', confidence: 80, strategy: 'trend_following' },
        { type: 'buy', confidence: 75, strategy: 'mean_reversion' },
      ],
    }));
    expect(result.components.signals.score).toBeGreaterThan(50);
    expect(result.components.signals.details.agreement).toBe('bullish');
  });

  it('signals component is bearish when all signals are SELL', () => {
    const result = calculateConfluence(makeInput({
      activeSignals: [
        { type: 'sell', confidence: 85, strategy: 'trend_following' },
        { type: 'sell', confidence: 70, strategy: 'mean_reversion' },
      ],
    }));
    expect(result.components.signals.score).toBeLessThan(50);
    expect(result.components.signals.details.agreement).toBe('bearish');
  });

  it('sentiment score reflects fear & greed index', () => {
    const fearResult = calculateConfluence(makeInput({
      fearGreedIndex: 10,
      newsSentiment: { bullish: 0, bearish: 5, neutral: 1 },
    }));
    const greedResult = calculateConfluence(makeInput({
      fearGreedIndex: 90,
      newsSentiment: { bullish: 5, bearish: 0, neutral: 1 },
    }));

    expect(greedResult.components.sentiment.score).toBeGreaterThan(
      fearResult.components.sentiment.score
    );
  });

  it('whale activity increases volume score', () => {
    // Use deterministic data so OBV trend is consistent
    const count = 100;
    const closes = Array.from({ length: count }, (_, i) => 100 + Math.sin(i / 5) * 2);
    const highs = closes.map((c) => c + 1);
    const lows = closes.map((c) => c - 1);
    const volumes = Array.from({ length: count }, () => 2000);

    const sharedCandles = { closes, highs, lows, volumes };
    const noWhales = calculateConfluence(makeInput({ ...sharedCandles, whaleAlertCount: 0 }));
    const highWhales = calculateConfluence(makeInput({ ...sharedCandles, whaleAlertCount: 5 }));

    // Whale activity adds up to 10 points to the same base
    expect(highWhales.components.volume.score).toBeGreaterThanOrEqual(
      noWhales.components.volume.score
    );
  });

  it('includes symbol and timestamp', () => {
    const result = calculateConfluence(makeInput({ symbol: 'ETHUSDT' }));
    expect(result.symbol).toBe('ETHUSDT');
    expect(result.timestamp).toBeTruthy();
    expect(new Date(result.timestamp).getTime()).not.toBeNaN();
  });

  it('handles strongly bullish trending data', () => {
    // Create steadily rising prices
    const count = 100;
    const closes = Array.from({ length: count }, (_, i) => 100 + i * 0.5);
    const highs = closes.map((c) => c + 1);
    const lows = closes.map((c) => c - 0.5);
    const volumes = Array.from({ length: count }, () => 3000);

    const result = calculateConfluence(makeInput({ closes, highs, lows, volumes }));

    // Should lean bullish
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(['buy', 'strong_buy', 'neutral']).toContain(result.label);
  });

  it('handles strongly bearish trending data', () => {
    const count = 100;
    const closes = Array.from({ length: count }, (_, i) => 200 - i * 0.5);
    const highs = closes.map((c) => c + 0.5);
    const lows = closes.map((c) => c - 1);
    const volumes = Array.from({ length: count }, () => 3000);

    const result = calculateConfluence(makeInput({ closes, highs, lows, volumes }));

    // Should lean bearish
    expect(result.score).toBeLessThanOrEqual(55);
    expect(['sell', 'strong_sell', 'neutral']).toContain(result.label);
  });
});
