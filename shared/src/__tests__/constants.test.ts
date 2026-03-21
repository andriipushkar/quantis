import {
  ALL_TIMEFRAMES,
  TIER_LIMITS,
  SUPPORTED_EXCHANGES,
  WS_EVENTS,
} from '../constants/index';
import { UserTier } from '../types/index';

describe('ALL_TIMEFRAMES', () => {
  it('should contain 15 timeframes', () => {
    expect(ALL_TIMEFRAMES).toHaveLength(15);
  });

  it('should include all minute-based timeframes', () => {
    expect(ALL_TIMEFRAMES).toContain('1m');
    expect(ALL_TIMEFRAMES).toContain('3m');
    expect(ALL_TIMEFRAMES).toContain('5m');
    expect(ALL_TIMEFRAMES).toContain('15m');
    expect(ALL_TIMEFRAMES).toContain('30m');
  });

  it('should include all hour-based timeframes', () => {
    expect(ALL_TIMEFRAMES).toContain('1H');
    expect(ALL_TIMEFRAMES).toContain('2H');
    expect(ALL_TIMEFRAMES).toContain('4H');
    expect(ALL_TIMEFRAMES).toContain('6H');
    expect(ALL_TIMEFRAMES).toContain('8H');
    expect(ALL_TIMEFRAMES).toContain('12H');
  });

  it('should include daily, 3-day, weekly, and monthly', () => {
    expect(ALL_TIMEFRAMES).toContain('1D');
    expect(ALL_TIMEFRAMES).toContain('3D');
    expect(ALL_TIMEFRAMES).toContain('1W');
    expect(ALL_TIMEFRAMES).toContain('1M');
  });

  it('should not contain duplicate values', () => {
    const unique = new Set(ALL_TIMEFRAMES);
    expect(unique.size).toBe(ALL_TIMEFRAMES.length);
  });
});

describe('TIER_LIMITS', () => {
  it('should define limits for all UserTier values', () => {
    const tiers = Object.values(UserTier);
    for (const tier of tiers) {
      expect(TIER_LIMITS).toHaveProperty(tier);
    }
  });

  it('should have STARTER tier with restricted limits', () => {
    const starter = TIER_LIMITS[UserTier.STARTER];
    expect(starter.maxWatchlist).toBe(3);
    expect(starter.maxAlerts).toBe(3);
    expect(starter.maxSignalsPerWeek).toBe(3);
    expect(starter.maxChartPanes).toBe(1);
    expect(starter.maxTimeframes).toEqual(['1D']);
    expect(starter.apiRateLimit).toBe(60);
  });

  it('should have TRADER tier with expanded limits', () => {
    const trader = TIER_LIMITS[UserTier.TRADER];
    expect(trader.maxWatchlist).toBe(20);
    expect(trader.maxAlerts).toBe(20);
    expect(trader.maxSignalsPerWeek).toBe(-1); // unlimited
    expect(trader.maxChartPanes).toBe(2);
    expect(trader.maxTimeframes).toEqual(ALL_TIMEFRAMES);
  });

  it('should have PRO tier with unlimited watchlist and alerts', () => {
    const pro = TIER_LIMITS[UserTier.PRO];
    expect(pro.maxWatchlist).toBe(-1);
    expect(pro.maxAlerts).toBe(-1);
    expect(pro.maxSignalsPerWeek).toBe(-1);
    expect(pro.maxChartPanes).toBe(4);
    expect(pro.apiRateLimit).toBe(1000);
  });

  it('should have INSTITUTIONAL tier with fully unlimited access', () => {
    const inst = TIER_LIMITS[UserTier.INSTITUTIONAL];
    expect(inst.maxWatchlist).toBe(-1);
    expect(inst.maxAlerts).toBe(-1);
    expect(inst.maxSignalsPerWeek).toBe(-1);
    expect(inst.apiRateLimit).toBe(-1);
  });

  it('should have progressively increasing apiRateLimit from STARTER to PRO', () => {
    const starter = TIER_LIMITS[UserTier.STARTER].apiRateLimit;
    const trader = TIER_LIMITS[UserTier.TRADER].apiRateLimit;
    const pro = TIER_LIMITS[UserTier.PRO].apiRateLimit;

    expect(trader).toBeGreaterThan(starter);
    expect(pro).toBeGreaterThan(trader);
  });

  it('each tier limit should have all required fields', () => {
    const requiredFields = [
      'maxWatchlist',
      'maxAlerts',
      'maxSignalsPerWeek',
      'maxChartPanes',
      'maxTimeframes',
      'apiRateLimit',
    ];

    for (const tier of Object.values(UserTier)) {
      for (const field of requiredFields) {
        expect(TIER_LIMITS[tier]).toHaveProperty(field);
      }
    }
  });
});

describe('SUPPORTED_EXCHANGES', () => {
  it('should include binance, bybit, and okx', () => {
    expect(SUPPORTED_EXCHANGES).toContain('binance');
    expect(SUPPORTED_EXCHANGES).toContain('bybit');
    expect(SUPPORTED_EXCHANGES).toContain('okx');
  });

  it('should have exactly 3 exchanges', () => {
    expect(SUPPORTED_EXCHANGES).toHaveLength(3);
  });
});

describe('WS_EVENTS', () => {
  it('should have all subscribe events', () => {
    expect(WS_EVENTS.SUBSCRIBE_TICKER).toBe('subscribe:ticker');
    expect(WS_EVENTS.SUBSCRIBE_OHLCV).toBe('subscribe:ohlcv');
    expect(WS_EVENTS.SUBSCRIBE_SIGNALS).toBe('subscribe:signals');
    expect(WS_EVENTS.SUBSCRIBE_ALERTS).toBe('subscribe:alerts');
    expect(WS_EVENTS.SUBSCRIBE_WHALES).toBe('subscribe:whales');
  });

  it('should have all update/data events', () => {
    expect(WS_EVENTS.TICKER_UPDATE).toBe('ticker:update');
    expect(WS_EVENTS.OHLCV_UPDATE).toBe('ohlcv:update');
    expect(WS_EVENTS.SIGNAL_NEW).toBe('signal:new');
    expect(WS_EVENTS.SIGNAL_UPDATE).toBe('signal:update');
    expect(WS_EVENTS.ALERT_TRIGGERED).toBe('alert:triggered');
    expect(WS_EVENTS.WHALE_TRANSACTION).toBe('whale:transaction');
    expect(WS_EVENTS.LIQUIDATION_EVENT).toBe('liquidation:event');
  });

  it('should have 12 total events', () => {
    const eventCount = Object.keys(WS_EVENTS).length;
    expect(eventCount).toBe(12);
  });

  it('should use colon-separated naming convention', () => {
    for (const value of Object.values(WS_EVENTS)) {
      expect(value).toMatch(/^[a-z]+:[a-z]+$/);
    }
  });
});
