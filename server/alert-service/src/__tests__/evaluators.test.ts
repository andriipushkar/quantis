/**
 * Tests for the alert evaluators: PriceAlertEvaluator and SignalAlertEvaluator.
 *
 * All database, Redis, and Bull queue dependencies are mocked.
 */

// ── Mock external modules ──────────────────────────────────────────

const mockQuery = jest.fn();
const mockQueueAdd = jest.fn();

jest.mock('../config/database.js', () => ({
  query: mockQuery,
  default: {},
  __esModule: true,
}));

jest.mock('../config/redis.js', () => ({
  publisher: { publish: jest.fn() },
  __esModule: true,
}));

jest.mock('../config/logger.js', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  __esModule: true,
}));

jest.mock('../index.js', () => ({
  alertDeliveryQueue: {
    add: mockQueueAdd,
  },
  __esModule: true,
}));

import { PriceAlertEvaluator } from '../evaluators/price';
import { SignalAlertEvaluator } from '../evaluators/signal';

// ── PriceAlertEvaluator ────────────────────────────────────────────

describe('PriceAlertEvaluator', () => {
  let evaluator: PriceAlertEvaluator;

  beforeEach(() => {
    evaluator = new PriceAlertEvaluator();
    jest.clearAllMocks();
  });

  it('should do nothing when no active alerts match the symbol', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await evaluator.evaluate('BTCUSDT', 42000);

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('should trigger a price_above alert when price exceeds threshold', async () => {
    mockQuery
      // First call: fetch alerts
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'alert-1',
            user_id: 'user-1',
            name: 'BTC above 40k',
            conditions_json: JSON.stringify([
              { type: 'price_above', value: 40000 },
            ]),
            cooldown_minutes: 0,
            last_triggered_at: null,
          },
        ],
      })
      // Second call: INSERT alert_history
      .mockResolvedValueOnce({ rows: [] })
      // Third call: UPDATE alerts
      .mockResolvedValueOnce({ rows: [] });

    mockQueueAdd.mockResolvedValue({});

    await evaluator.evaluate('BTCUSDT', 42000);

    expect(mockQueueAdd).toHaveBeenCalledWith(
      'deliver',
      expect.objectContaining({
        alertId: 'alert-1',
        userId: 'user-1',
      }),
      expect.objectContaining({
        attempts: 3,
      })
    );
  });

  it('should NOT trigger price_above when price is below threshold', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'alert-2',
          user_id: 'user-1',
          name: 'BTC above 50k',
          conditions_json: JSON.stringify([
            { type: 'price_above', value: 50000 },
          ]),
          cooldown_minutes: 0,
          last_triggered_at: null,
        },
      ],
    });

    await evaluator.evaluate('BTCUSDT', 42000);

    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('should trigger a price_below alert when price drops below threshold', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'alert-3',
            user_id: 'user-2',
            name: 'BTC below 40k',
            conditions_json: JSON.stringify([
              { type: 'price_below', value: 40000 },
            ]),
            cooldown_minutes: 0,
            last_triggered_at: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    mockQueueAdd.mockResolvedValue({});

    await evaluator.evaluate('BTCUSDT', 38000);

    expect(mockQueueAdd).toHaveBeenCalledTimes(1);
  });

  it('should NOT trigger price_below when price is above threshold', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'alert-4',
          user_id: 'user-2',
          name: 'BTC below 30k',
          conditions_json: JSON.stringify([
            { type: 'price_below', value: 30000 },
          ]),
          cooldown_minutes: 0,
          last_triggered_at: null,
        },
      ],
    });

    await evaluator.evaluate('BTCUSDT', 42000);

    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('should trigger price_change_percent when change exceeds threshold', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'alert-5',
            user_id: 'user-3',
            name: 'BTC big move',
            conditions_json: JSON.stringify([
              { type: 'price_change_percent', value: 5, reference_price: 40000 },
            ]),
            cooldown_minutes: 0,
            last_triggered_at: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    mockQueueAdd.mockResolvedValue({});

    // 42400 is a 6% increase from 40000 -> exceeds 5% threshold
    await evaluator.evaluate('BTCUSDT', 42400);

    expect(mockQueueAdd).toHaveBeenCalledTimes(1);
  });

  it('should NOT trigger price_change_percent when change is below threshold', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'alert-6',
          user_id: 'user-3',
          name: 'BTC small move',
          conditions_json: JSON.stringify([
            { type: 'price_change_percent', value: 10, reference_price: 40000 },
          ]),
          cooldown_minutes: 0,
          last_triggered_at: null,
        },
      ],
    });

    // 42000 is a 5% increase from 40000 -> does NOT exceed 10%
    await evaluator.evaluate('BTCUSDT', 42000);

    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('should skip alert in cooldown period', async () => {
    const recentTime = new Date(Date.now() - 30_000).toISOString(); // 30 seconds ago

    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'alert-7',
          user_id: 'user-1',
          name: 'BTC above 40k',
          conditions_json: JSON.stringify([
            { type: 'price_above', value: 40000 },
          ]),
          cooldown_minutes: 5, // 5 minutes cooldown
          last_triggered_at: recentTime,
        },
      ],
    });

    await evaluator.evaluate('BTCUSDT', 42000);

    // Should not trigger because cooldown hasn't expired
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('should trigger alert when cooldown has fully elapsed', async () => {
    const oldTime = new Date(Date.now() - 600_000).toISOString(); // 10 minutes ago

    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'alert-8',
            user_id: 'user-1',
            name: 'BTC above 40k',
            conditions_json: JSON.stringify([
              { type: 'price_above', value: 40000 },
            ]),
            cooldown_minutes: 5,
            last_triggered_at: oldTime,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    mockQueueAdd.mockResolvedValue({});

    await evaluator.evaluate('BTCUSDT', 42000);

    expect(mockQueueAdd).toHaveBeenCalledTimes(1);
  });

  it('should handle database errors gracefully', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB connection lost'));

    await expect(evaluator.evaluate('BTCUSDT', 42000)).resolves.not.toThrow();
  });
});

// ── SignalAlertEvaluator ───────────────────────────────────────────

describe('SignalAlertEvaluator', () => {
  let evaluator: SignalAlertEvaluator;

  const baseSignal = {
    id: 'sig-1',
    pair: 'BTCUSDT',
    strategy: 'RSI_MACD',
    direction: 'BUY',
    strength: 80,
    confidence: 0.85,
    timestamp: new Date().toISOString(),
  };

  beforeEach(() => {
    evaluator = new SignalAlertEvaluator();
    jest.clearAllMocks();
  });

  it('should do nothing when no signal alerts exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await evaluator.evaluate(baseSignal);

    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('should trigger when signal matches all conditions', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'salert-1',
            user_id: 'user-1',
            name: 'BTC buy signals',
            conditions_json: JSON.stringify({
              pair: 'BTCUSDT',
              strategy: 'RSI_MACD',
              direction: 'BUY',
              min_strength: 70,
              min_confidence: 0.8,
            }),
            cooldown_minutes: 0,
            last_triggered_at: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    mockQueueAdd.mockResolvedValue({});

    await evaluator.evaluate(baseSignal);

    expect(mockQueueAdd).toHaveBeenCalledTimes(1);
  });

  it('should NOT trigger when pair does not match', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'salert-2',
          user_id: 'user-1',
          name: 'ETH signals only',
          conditions_json: JSON.stringify({
            pair: 'ETHUSDT',
          }),
          cooldown_minutes: 0,
          last_triggered_at: null,
        },
      ],
    });

    await evaluator.evaluate(baseSignal); // signal is for BTCUSDT

    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('should NOT trigger when direction does not match', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'salert-3',
          user_id: 'user-1',
          name: 'SELL only',
          conditions_json: JSON.stringify({
            direction: 'SELL',
          }),
          cooldown_minutes: 0,
          last_triggered_at: null,
        },
      ],
    });

    await evaluator.evaluate(baseSignal); // signal direction is BUY

    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('should NOT trigger when strength is below min_strength', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'salert-4',
          user_id: 'user-1',
          name: 'Strong signals only',
          conditions_json: JSON.stringify({
            min_strength: 90,
          }),
          cooldown_minutes: 0,
          last_triggered_at: null,
        },
      ],
    });

    await evaluator.evaluate({ ...baseSignal, strength: 80 });

    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('should NOT trigger when confidence is below min_confidence', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'salert-5',
          user_id: 'user-1',
          name: 'High confidence only',
          conditions_json: JSON.stringify({
            min_confidence: 0.95,
          }),
          cooldown_minutes: 0,
          last_triggered_at: null,
        },
      ],
    });

    await evaluator.evaluate({ ...baseSignal, confidence: 0.85 });

    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('should trigger when conditions are empty (wildcard match)', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'salert-6',
            user_id: 'user-1',
            name: 'All signals',
            conditions_json: JSON.stringify({}),
            cooldown_minutes: 0,
            last_triggered_at: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    mockQueueAdd.mockResolvedValue({});

    await evaluator.evaluate(baseSignal);

    expect(mockQueueAdd).toHaveBeenCalledTimes(1);
  });

  it('should skip signal alert in cooldown period', async () => {
    const recentTime = new Date(Date.now() - 60_000).toISOString(); // 1 min ago

    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'salert-7',
          user_id: 'user-1',
          name: 'Rate-limited alerts',
          conditions_json: JSON.stringify({}),
          cooldown_minutes: 10,
          last_triggered_at: recentTime,
        },
      ],
    });

    await evaluator.evaluate(baseSignal);

    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('should handle database errors gracefully', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB timeout'));

    await expect(evaluator.evaluate(baseSignal)).resolves.not.toThrow();
  });
});
