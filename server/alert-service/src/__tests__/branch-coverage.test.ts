/**
 * Branch coverage tests for alert-service
 *
 * Targets uncovered branches in:
 *   - delivery/index.ts — default switch case (unknown channel), email without address,
 *     telegram stub, per-channel catch block, outer catch block
 *   - delivery/email.ts — sendAlertEmail without currentPrice, without symbol,
 *     without triggeredCondition, catch block on sendMail failure
 *   - evaluators/price.ts — catch blocks (lines 134-135), price_change_percent with
 *     refPrice = 0, cooldown elapsed vs not elapsed
 *   - evaluators/signal.ts — catch blocks, cooldown branch,
 *     condition mismatch branches (pair, strategy, direction, min_strength, min_confidence)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Mocks ───────────────────────────────────────────────────────────

const mockQuery = jest.fn();
const mockPublish = jest.fn();
const mockSendMail = jest.fn();
const mockQueueAdd = jest.fn();

jest.mock('../config/database.js', () => ({
  query: mockQuery,
  default: {},
  __esModule: true,
}));

jest.mock('../config/redis.js', () => ({
  publisher: { publish: mockPublish },
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

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
  })),
}));

jest.mock('../index.js', () => ({
  alertDeliveryQueue: {
    add: mockQueueAdd,
  },
  __esModule: true,
}));

// ── Imports ─────────────────────────────────────────────────────────

import { deliverAlert } from '../delivery/index';
import { sendAlertEmail } from '../delivery/email';
import { PriceAlertEvaluator } from '../evaluators/price';
import { SignalAlertEvaluator } from '../evaluators/signal';

// =====================================================================
// deliverAlert — branch coverage
// =====================================================================

describe('deliverAlert — branch coverage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should log warning and return when alert is not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await deliverAlert('alert-missing', 'user-1', {});
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('should handle default/unknown channel type', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'a1',
        name: 'Test',
        channels_json: JSON.stringify([{ type: 'sms' }]),
        email: 'x@y.com',
      }],
    });

    await deliverAlert('a1', 'u1', {});
    // Should not throw, unknown channel gets logged and skipped
  });

  it('should handle telegram channel (stub)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'a2',
        name: 'Telegram Test',
        channels_json: JSON.stringify([{ type: 'telegram' }]),
        email: 'x@y.com',
      }],
    });

    await deliverAlert('a2', 'u2', {});
  });

  it('should skip email when user has no email address', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'a3',
        name: 'No Email',
        channels_json: JSON.stringify([{ type: 'email' }]),
        email: null,
      }],
    });

    await deliverAlert('a3', 'u3', {});
  });

  it('should handle per-channel delivery failure (catch block)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'a4',
        name: 'Fail Push',
        channels_json: JSON.stringify([{ type: 'push' }]),
        email: 'x@y.com',
      }],
    });
    mockPublish.mockRejectedValueOnce(new Error('Redis down'));

    await deliverAlert('a4', 'u4', {});
    // Should not throw — error is caught per channel
  });

  it('should handle per-channel failure with non-Error thrown', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'a5',
        name: 'Fail Non-Error',
        channels_json: JSON.stringify([{ type: 'push' }]),
        email: 'x@y.com',
      }],
    });
    mockPublish.mockRejectedValueOnce('string error');

    await deliverAlert('a5', 'u5', {});
  });

  it('should throw when outer try fails (db error)', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB connection lost'));

    await expect(deliverAlert('a6', 'u6', {})).rejects.toThrow('DB connection lost');
  });

  it('should deliver email successfully when user has email', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'a7',
        name: 'Email Alert',
        channels_json: JSON.stringify([{ type: 'email' }]),
        email: 'user@test.com',
      }],
    });
    mockSendMail.mockResolvedValueOnce({});

    await deliverAlert('a7', 'u7', { triggeredCondition: 'Price above 50000' });
  });

  it('should handle null channels_json (defaults to empty array then push)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'a8',
        name: 'Null Channels',
        channels_json: null,
        email: 'x@y.com',
      }],
    });
    mockPublish.mockResolvedValueOnce(1);

    await deliverAlert('a8', 'u8', {});
    expect(mockPublish).toHaveBeenCalled();
  });
});

// =====================================================================
// sendAlertEmail — branch coverage
// =====================================================================

describe('sendAlertEmail — branch coverage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should send email without currentPrice or symbol (template branches)', async () => {
    mockSendMail.mockResolvedValueOnce({});

    await sendAlertEmail(
      'user@test.com',
      { name: 'My Alert', id: 'a1' },
      { triggeredCondition: 'Price > 100', timestamp: '2024-01-01T00:00:00Z' },
    );

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const callArgs = mockSendMail.mock.calls[0][0];
    expect(callArgs.to).toBe('user@test.com');
    // The HTML should NOT contain "Current Price" or "Symbol" sections
    expect(callArgs.html).not.toContain('Current Price');
    expect(callArgs.html).not.toContain('Symbol');
  });

  it('should include currentPrice and symbol when present', async () => {
    mockSendMail.mockResolvedValueOnce({});

    await sendAlertEmail(
      'user@test.com',
      { name: 'Alert', id: 'a2' },
      { triggeredCondition: 'Test', currentPrice: 42000, symbol: 'BTCUSDT' },
    );

    const html = mockSendMail.mock.calls[0][0].html;
    expect(html).toContain('$42000');
    expect(html).toContain('BTCUSDT');
  });

  it('should use N/A when triggeredCondition is undefined', async () => {
    mockSendMail.mockResolvedValueOnce({});

    await sendAlertEmail(
      'user@test.com',
      { name: 'Alert', id: 'a3' },
      {},
    );

    const html = mockSendMail.mock.calls[0][0].html;
    expect(html).toContain('N/A');
  });

  it('should throw when sendMail fails', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('SMTP timeout'));

    await expect(
      sendAlertEmail('user@test.com', { name: 'A', id: '1' }, {}),
    ).rejects.toThrow('SMTP timeout');
  });

  it('should handle non-Error throw from sendMail', async () => {
    mockSendMail.mockRejectedValueOnce('raw string failure');

    await expect(
      sendAlertEmail('user@test.com', { name: 'A', id: '1' }, {}),
    ).rejects.toBe('raw string failure');
  });
});

// =====================================================================
// PriceAlertEvaluator — branch coverage
// =====================================================================

describe('PriceAlertEvaluator — branch coverage', () => {
  let evaluator: PriceAlertEvaluator;

  beforeEach(() => {
    evaluator = new PriceAlertEvaluator();
    jest.clearAllMocks();
  });

  it('should skip alert in cooldown', async () => {
    const now = new Date();
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'a1',
        user_id: 'u1',
        name: 'Cooldown Test',
        conditions_json: JSON.stringify([{ type: 'price_above', value: 100 }]),
        cooldown_minutes: 60,
        last_triggered_at: now.toISOString(),
      }],
    });

    await evaluator.evaluate('BTCUSDT', 150);

    // Should have queried but NOT inserted history or triggered delivery
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('should handle price_change_percent with refPrice = 0', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'a2',
        user_id: 'u2',
        name: 'PctChange Zero Ref',
        conditions_json: JSON.stringify([
          { type: 'price_change_percent', value: 5, reference_price: 0 },
        ]),
        cooldown_minutes: 0,
        last_triggered_at: null,
      }],
    });

    await evaluator.evaluate('ETHUSDT', 3000);

    // refPrice is 0, so condition not met — no delivery
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('should handle price_change_percent with missing refPrice', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'a3',
        user_id: 'u3',
        name: 'PctChange No Ref',
        conditions_json: JSON.stringify([
          { type: 'price_change_percent', value: 5 },
        ]),
        cooldown_minutes: 0,
        last_triggered_at: null,
      }],
    });

    await evaluator.evaluate('ETHUSDT', 3000);
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('should trigger price_below alert and enqueue delivery', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          id: 'a4',
          user_id: 'u4',
          name: 'Price Below',
          conditions_json: JSON.stringify([{ type: 'price_below', value: 50000 }]),
          cooldown_minutes: 0,
          last_triggered_at: null,
        }],
      })
      .mockResolvedValueOnce({ rows: [] }) // INSERT into alert_history
      .mockResolvedValueOnce({ rows: [] }); // UPDATE last_triggered_at

    await evaluator.evaluate('BTCUSDT', 42000);

    expect(mockQueueAdd).toHaveBeenCalledTimes(1);
    expect(mockQueueAdd).toHaveBeenCalledWith(
      'deliver',
      expect.objectContaining({ alertId: 'a4', userId: 'u4' }),
      expect.any(Object),
    );
  });

  it('should trigger price_change_percent alert when threshold met', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          id: 'a5',
          user_id: 'u5',
          name: 'Price Change',
          conditions_json: JSON.stringify([
            { type: 'price_change_percent', value: 5, reference_price: 100 },
          ]),
          cooldown_minutes: 0,
          last_triggered_at: null,
        }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await evaluator.evaluate('ETHUSDT', 110); // 10% change >= 5% threshold

    expect(mockQueueAdd).toHaveBeenCalledTimes(1);
  });

  it('should catch errors in evaluateAlert (individual alert catch)', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          id: 'a6',
          user_id: 'u6',
          name: 'Bad JSON',
          conditions_json: 'NOT VALID JSON',
          cooldown_minutes: 0,
          last_triggered_at: null,
        }],
      });

    // Should not throw — error is caught in the per-alert try/catch
    await evaluator.evaluate('BTCUSDT', 42000);
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('should catch errors in outer evaluate() when query fails', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    // Should not throw — caught in outer try/catch
    await evaluator.evaluate('BTCUSDT', 42000);
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('should not trigger when condition is not met (price_above but price lower)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'a7',
        user_id: 'u7',
        name: 'Above Not Met',
        conditions_json: JSON.stringify([{ type: 'price_above', value: 50000 }]),
        cooldown_minutes: 0,
        last_triggered_at: null,
      }],
    });

    await evaluator.evaluate('BTCUSDT', 40000);
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });
});

// =====================================================================
// SignalAlertEvaluator — branch coverage
// =====================================================================

describe('SignalAlertEvaluator — branch coverage', () => {
  let evaluator: SignalAlertEvaluator;

  const baseSignal = {
    id: 'sig-1',
    pair: 'BTCUSDT',
    strategy: 'trend_following',
    direction: 'BUY',
    strength: 80,
    confidence: 75,
    timestamp: new Date().toISOString(),
  };

  beforeEach(() => {
    evaluator = new SignalAlertEvaluator();
    jest.clearAllMocks();
  });

  it('should skip alert in cooldown', async () => {
    const now = new Date();
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'sa1',
        user_id: 'u1',
        name: 'Signal Cooldown',
        conditions_json: JSON.stringify({}),
        cooldown_minutes: 60,
        last_triggered_at: now.toISOString(),
      }],
    });

    await evaluator.evaluate(baseSignal);
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('should not match when pair condition does not match', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'sa2',
        user_id: 'u2',
        name: 'Wrong Pair',
        conditions_json: JSON.stringify({ pair: 'ETHUSDT' }),
        cooldown_minutes: 0,
        last_triggered_at: null,
      }],
    });

    await evaluator.evaluate(baseSignal);
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('should not match when strategy condition does not match', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'sa3',
        user_id: 'u3',
        name: 'Wrong Strategy',
        conditions_json: JSON.stringify({ strategy: 'mean_reversion' }),
        cooldown_minutes: 0,
        last_triggered_at: null,
      }],
    });

    await evaluator.evaluate(baseSignal);
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('should not match when direction condition does not match', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'sa4',
        user_id: 'u4',
        name: 'Wrong Direction',
        conditions_json: JSON.stringify({ direction: 'SELL' }),
        cooldown_minutes: 0,
        last_triggered_at: null,
      }],
    });

    await evaluator.evaluate(baseSignal);
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('should not match when min_strength is not met', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'sa5',
        user_id: 'u5',
        name: 'Weak Strength',
        conditions_json: JSON.stringify({ min_strength: 90 }),
        cooldown_minutes: 0,
        last_triggered_at: null,
      }],
    });

    await evaluator.evaluate(baseSignal); // strength is 80 < 90
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('should not match when min_confidence is not met', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'sa6',
        user_id: 'u6',
        name: 'Low Confidence',
        conditions_json: JSON.stringify({ min_confidence: 90 }),
        cooldown_minutes: 0,
        last_triggered_at: null,
      }],
    });

    await evaluator.evaluate(baseSignal); // confidence is 75 < 90
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('should trigger when all conditions match', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          id: 'sa7',
          user_id: 'u7',
          name: 'Match All',
          conditions_json: JSON.stringify({
            pair: 'BTCUSDT',
            strategy: 'trend_following',
            direction: 'BUY',
            min_strength: 70,
            min_confidence: 70,
          }),
          cooldown_minutes: 0,
          last_triggered_at: null,
        }],
      })
      .mockResolvedValueOnce({ rows: [] }) // INSERT
      .mockResolvedValueOnce({ rows: [] }); // UPDATE

    await evaluator.evaluate(baseSignal);
    expect(mockQueueAdd).toHaveBeenCalledTimes(1);
  });

  it('should catch JSON parse errors in evaluateAlert', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'sa8',
        user_id: 'u8',
        name: 'Bad JSON',
        conditions_json: '{{{INVALID',
        cooldown_minutes: 0,
        last_triggered_at: null,
      }],
    });

    await evaluator.evaluate(baseSignal);
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('should catch outer query errors', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    await evaluator.evaluate(baseSignal);
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('should handle cooldown_minutes = 0 with last_triggered_at set (no cooldown)', async () => {
    const pastTime = new Date(Date.now() - 1000).toISOString();
    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          id: 'sa9',
          user_id: 'u9',
          name: 'No Cooldown',
          conditions_json: JSON.stringify({}),
          cooldown_minutes: 0,
          last_triggered_at: pastTime,
        }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await evaluator.evaluate(baseSignal);
    // cooldown is 0 * 60 * 1000 = 0, and Date.now() - past > 0, so not in cooldown
    expect(mockQueueAdd).toHaveBeenCalledTimes(1);
  });
});
