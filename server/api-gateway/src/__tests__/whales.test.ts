/**
 * Whale Alerts — Unit Tests
 *
 * Tests the whale detection logic extracted from routes/whales.ts.
 */

// ---------------------------------------------------------------------------
// Replicated types & logic from whales.ts
// ---------------------------------------------------------------------------

type WhaleType = 'exchange_inflow' | 'exchange_outflow' | 'transfer';

const WHALE_TYPES: WhaleType[] = ['exchange_inflow', 'exchange_outflow', 'transfer'];

function pickWhaleType(seed: number): WhaleType {
  return WHALE_TYPES[seed % WHALE_TYPES.length];
}

interface VolumeCandle {
  time: string;
  volume: number;
}

interface WhaleAlert {
  symbol: string;
  exchange: string;
  type: WhaleType;
  amount_usd: number;
  timestamp: string;
}

/**
 * Core detection logic replicated from the route handler.
 * Returns alerts for a single trading pair.
 */
function detectWhaleActivity(
  pair: { id: number; symbol: string; exchange: string },
  candles: VolumeCandle[],
  price: number
): WhaleAlert[] {
  const alerts: WhaleAlert[] = [];

  if (candles.length < 5) return alerts;

  const volumes = candles.map((c) => parseFloat(String(c.volume)));
  const latestVolume = volumes[0];

  // Average volume of candles 1..N (excluding latest)
  const historicalVolumes = volumes.slice(1);
  const avgVolume =
    historicalVolumes.reduce((a, b) => a + b, 0) / historicalVolumes.length;

  // Detect whale activity: current volume > 3x average
  if (avgVolume > 0 && latestVolume > avgVolume * 3) {
    const spikeMagnitude = latestVolume / avgVolume;

    const excessVolume = latestVolume - avgVolume;
    const amountUsd =
      price > 0
        ? Math.round(excessVolume * price)
        : Math.round(excessVolume * 100); // fallback

    const seedIndex = pair.id + Math.floor(Date.now() / 60_000);

    alerts.push({
      symbol: pair.symbol,
      exchange: pair.exchange,
      type: pickWhaleType(seedIndex),
      amount_usd: amountUsd,
      timestamp: candles[0].time,
    });

    // Extreme spike (>6x) adds second alert
    if (spikeMagnitude > 6) {
      alerts.push({
        symbol: pair.symbol,
        exchange: pair.exchange,
        type: pickWhaleType(seedIndex + 1),
        amount_usd: Math.round(amountUsd * 0.6),
        timestamp: candles[0].time,
      });
    }
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeVolumeCandles(volumes: number[]): VolumeCandle[] {
  return volumes.map((v, i) => ({
    time: new Date(Date.now() - i * 60_000).toISOString(),
    volume: v,
  }));
}

const defaultPair = { id: 1, symbol: 'BTCUSDT', exchange: 'binance' };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Whale Alerts — pickWhaleType', () => {
  test('seed 0 returns exchange_inflow', () => {
    expect(pickWhaleType(0)).toBe('exchange_inflow');
  });

  test('seed 1 returns exchange_outflow', () => {
    expect(pickWhaleType(1)).toBe('exchange_outflow');
  });

  test('seed 2 returns transfer', () => {
    expect(pickWhaleType(2)).toBe('transfer');
  });

  test('cycles through all three types', () => {
    expect(pickWhaleType(3)).toBe('exchange_inflow');
    expect(pickWhaleType(4)).toBe('exchange_outflow');
    expect(pickWhaleType(5)).toBe('transfer');
  });

  test('always returns a valid whale type', () => {
    for (let i = 0; i < 100; i++) {
      expect(WHALE_TYPES).toContain(pickWhaleType(i));
    }
  });
});

describe('Whale Alerts — Volume Spike Detection', () => {
  test('no alert when latest volume is at average', () => {
    // latest = 100, historical avg = 100 => 1x, no spike
    const candles = makeVolumeCandles([100, 100, 100, 100, 100, 100]);
    const alerts = detectWhaleActivity(defaultPair, candles, 50000);
    expect(alerts).toHaveLength(0);
  });

  test('no alert when latest volume is 2x average (below 3x threshold)', () => {
    const candles = makeVolumeCandles([200, 100, 100, 100, 100, 100]);
    const alerts = detectWhaleActivity(defaultPair, candles, 50000);
    expect(alerts).toHaveLength(0);
  });

  test('no alert when latest volume is exactly 3x average', () => {
    // 3x is NOT greater than 3x, so no alert
    const candles = makeVolumeCandles([300, 100, 100, 100, 100, 100]);
    const alerts = detectWhaleActivity(defaultPair, candles, 50000);
    expect(alerts).toHaveLength(0);
  });

  test('alert when latest volume is 3.1x average', () => {
    const candles = makeVolumeCandles([310, 100, 100, 100, 100, 100]);
    const alerts = detectWhaleActivity(defaultPair, candles, 50000);
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts[0].symbol).toBe('BTCUSDT');
    expect(alerts[0].exchange).toBe('binance');
  });

  test('alert when latest volume is 5x average', () => {
    const candles = makeVolumeCandles([500, 100, 100, 100, 100, 100]);
    const alerts = detectWhaleActivity(defaultPair, candles, 50000);
    expect(alerts).toHaveLength(1);
  });

  test('two alerts when spike is > 6x average (extreme)', () => {
    const candles = makeVolumeCandles([700, 100, 100, 100, 100, 100]);
    const alerts = detectWhaleActivity(defaultPair, candles, 50000);
    expect(alerts).toHaveLength(2);
    // Second alert should have 60% of the first's amount
    expect(alerts[1].amount_usd).toBe(Math.round(alerts[0].amount_usd * 0.6));
  });

  test('exactly 6x does NOT produce second alert (needs > 6x)', () => {
    const candles = makeVolumeCandles([600, 100, 100, 100, 100, 100]);
    const alerts = detectWhaleActivity(defaultPair, candles, 50000);
    expect(alerts).toHaveLength(1);
  });
});

describe('Whale Alerts — USD Amount Estimation', () => {
  test('amount is (excessVolume * price) when price > 0', () => {
    const price = 50000;
    const candles = makeVolumeCandles([400, 100, 100, 100, 100, 100]);
    const alerts = detectWhaleActivity(defaultPair, candles, price);
    expect(alerts.length).toBe(1);
    // excessVolume = 400 - 100 = 300
    expect(alerts[0].amount_usd).toBe(Math.round(300 * price));
  });

  test('fallback estimate (excessVolume * 100) when price is 0', () => {
    const candles = makeVolumeCandles([400, 100, 100, 100, 100, 100]);
    const alerts = detectWhaleActivity(defaultPair, candles, 0);
    expect(alerts.length).toBe(1);
    // excessVolume = 300, fallback = 300 * 100
    expect(alerts[0].amount_usd).toBe(30000);
  });

  test('amount is rounded to integer', () => {
    const candles = makeVolumeCandles([333, 100, 100, 100, 100, 100]);
    const alerts = detectWhaleActivity(defaultPair, candles, 12345.67);
    expect(alerts.length).toBe(1);
    expect(Number.isInteger(alerts[0].amount_usd)).toBe(true);
  });
});

describe('Whale Alerts — Insufficient Data', () => {
  test('no alerts with fewer than 5 candles', () => {
    const candles = makeVolumeCandles([1000, 1, 1, 1]);
    const alerts = detectWhaleActivity(defaultPair, candles, 50000);
    expect(alerts).toHaveLength(0);
  });

  test('no alerts with exactly 5 candles and no spike', () => {
    const candles = makeVolumeCandles([100, 100, 100, 100, 100]);
    const alerts = detectWhaleActivity(defaultPair, candles, 50000);
    expect(alerts).toHaveLength(0);
  });

  test('alert with exactly 5 candles and a spike', () => {
    const candles = makeVolumeCandles([500, 100, 100, 100, 100]);
    const alerts = detectWhaleActivity(defaultPair, candles, 50000);
    expect(alerts.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Whale Alerts — Edge Cases', () => {
  test('no alert when avgVolume is 0 (division guard)', () => {
    const candles = makeVolumeCandles([1000, 0, 0, 0, 0, 0]);
    const alerts = detectWhaleActivity(defaultPair, candles, 50000);
    // avgVolume = 0, guard prevents division => no alert
    expect(alerts).toHaveLength(0);
  });

  test('alert fields have correct types', () => {
    const candles = makeVolumeCandles([500, 100, 100, 100, 100, 100]);
    const alerts = detectWhaleActivity(defaultPair, candles, 50000);
    const alert = alerts[0];
    expect(typeof alert.symbol).toBe('string');
    expect(typeof alert.exchange).toBe('string');
    expect(typeof alert.amount_usd).toBe('number');
    expect(typeof alert.timestamp).toBe('string');
    expect(WHALE_TYPES).toContain(alert.type);
  });

  test('multiple exchanges produce independent alerts', () => {
    const candles = makeVolumeCandles([500, 100, 100, 100, 100, 100]);
    const binanceAlerts = detectWhaleActivity(
      { id: 1, symbol: 'BTCUSDT', exchange: 'binance' },
      candles,
      50000
    );
    const bybitAlerts = detectWhaleActivity(
      { id: 2, symbol: 'BTCUSDT', exchange: 'bybit' },
      candles,
      50000
    );
    expect(binanceAlerts[0].exchange).toBe('binance');
    expect(bybitAlerts[0].exchange).toBe('bybit');
    // Same USD amount because same data
    expect(binanceAlerts[0].amount_usd).toBe(bybitAlerts[0].amount_usd);
  });

  test('alerts are sorted by amount_usd descending in aggregation', () => {
    // Simulate aggregation logic from the route
    const allAlerts: WhaleAlert[] = [
      { symbol: 'A', exchange: 'x', type: 'transfer', amount_usd: 100, timestamp: '' },
      { symbol: 'B', exchange: 'x', type: 'transfer', amount_usd: 500, timestamp: '' },
      { symbol: 'C', exchange: 'x', type: 'transfer', amount_usd: 300, timestamp: '' },
    ];
    allAlerts.sort((a, b) => b.amount_usd - a.amount_usd);
    expect(allAlerts[0].amount_usd).toBe(500);
    expect(allAlerts[1].amount_usd).toBe(300);
    expect(allAlerts[2].amount_usd).toBe(100);
  });
});
