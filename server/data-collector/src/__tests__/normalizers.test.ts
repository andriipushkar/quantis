import {
  normalizeBinanceKline,
  normalizeBybitKline,
  normalizeOkxKline,
  type BinanceRawKline,
  type NormalizedKline,
} from '../normalizers/index';

describe('normalizeBinanceKline', () => {
  const validKline: BinanceRawKline = {
    t: 1700000000000,
    T: 1700000060000,
    s: 'BTCUSDT',
    i: '1m',
    f: 100,
    L: 200,
    o: '42000.50',
    c: '42100.75',
    h: '42200.00',
    l: '41900.25',
    v: '123.456',
    n: 500,
    x: true,
    q: '5200000.00',
    V: '60.000',
    Q: '2520000.00',
  };

  it('should normalize a valid Binance kline', () => {
    const result = normalizeBinanceKline(validKline);

    expect(result.time).toEqual(new Date(1700000000000));
    expect(result.open).toBe(42000.50);
    expect(result.high).toBe(42200.00);
    expect(result.low).toBe(41900.25);
    expect(result.close).toBe(42100.75);
    expect(result.volume).toBe(123.456);
    expect(result.trades).toBe(500);
  });

  it('should return a valid NormalizedKline structure', () => {
    const result = normalizeBinanceKline(validKline);

    expect(result).toHaveProperty('time');
    expect(result).toHaveProperty('open');
    expect(result).toHaveProperty('high');
    expect(result).toHaveProperty('low');
    expect(result).toHaveProperty('close');
    expect(result).toHaveProperty('volume');
    expect(result).toHaveProperty('trades');
    expect(result.time).toBeInstanceOf(Date);
  });

  it('should handle zero values', () => {
    const zeroKline: BinanceRawKline = {
      ...validKline,
      o: '0',
      c: '0',
      h: '0',
      l: '0',
      v: '0',
      n: 0,
    };
    const result = normalizeBinanceKline(zeroKline);

    expect(result.open).toBe(0);
    expect(result.close).toBe(0);
    expect(result.high).toBe(0);
    expect(result.low).toBe(0);
    expect(result.volume).toBe(0);
    expect(result.trades).toBe(0);
  });

  it('should handle very large price values', () => {
    const largeKline: BinanceRawKline = {
      ...validKline,
      o: '999999999.99999999',
      c: '999999999.99999999',
      h: '999999999.99999999',
      l: '0.00000001',
      v: '1000000000.0',
    };
    const result = normalizeBinanceKline(largeKline);

    expect(result.open).toBeCloseTo(999999999.99999999);
    expect(result.low).toBeCloseTo(0.00000001);
    expect(result.volume).toBe(1000000000.0);
  });

  it('should handle very small (sub-satoshi) prices', () => {
    const tinyKline: BinanceRawKline = {
      ...validKline,
      o: '0.00000001',
      c: '0.00000002',
      h: '0.00000003',
      l: '0.00000001',
    };
    const result = normalizeBinanceKline(tinyKline);

    expect(result.open).toBe(0.00000001);
    expect(result.close).toBe(0.00000002);
  });

  it('should correctly convert timestamp to Date', () => {
    const result = normalizeBinanceKline(validKline);
    expect(result.time.getTime()).toBe(1700000000000);
  });
});

describe('normalizeBybitKline', () => {
  it('should normalize valid Bybit kline data', () => {
    const raw = {
      start: 1700000000000,
      open: '42000.50',
      high: '42200.00',
      low: '41900.25',
      close: '42100.75',
      volume: '123.456',
    };
    const result = normalizeBybitKline(raw);

    expect(result.time).toEqual(new Date(1700000000000));
    expect(result.open).toBe(42000.50);
    expect(result.high).toBe(42200.00);
    expect(result.low).toBe(41900.25);
    expect(result.close).toBe(42100.75);
    expect(result.volume).toBe(123.456);
    expect(result.trades).toBe(0); // Bybit doesn't provide trade count
  });

  it('should handle missing fields with defaults of 0', () => {
    const raw = {
      start: 1700000000000,
    };
    const result = normalizeBybitKline(raw);

    expect(result.time).toEqual(new Date(1700000000000));
    expect(result.open).toBe(0);
    expect(result.high).toBe(0);
    expect(result.low).toBe(0);
    expect(result.close).toBe(0);
    expect(result.volume).toBe(0);
  });

  it('should handle undefined fields gracefully', () => {
    const raw = {
      start: 1700000000000,
      open: undefined,
      high: undefined,
      low: undefined,
      close: undefined,
      volume: undefined,
    };
    const result = normalizeBybitKline(raw as Record<string, unknown>);

    expect(result.open).toBe(0);
    expect(result.close).toBe(0);
  });

  it('should always return trades as 0', () => {
    const raw = {
      start: 1700000000000,
      open: '100',
      high: '200',
      low: '50',
      close: '150',
      volume: '1000',
    };
    const result = normalizeBybitKline(raw);
    expect(result.trades).toBe(0);
  });
});

describe('normalizeOkxKline', () => {
  it('should normalize valid OKX kline array data', () => {
    // OKX returns arrays: [ts, o, h, l, c, vol, volCcy, volCcyQuote, confirm]
    const raw = ['1700000000000', '42000.50', '42200.00', '41900.25', '42100.75', '123.456', '0', '0', '1'];
    const result = normalizeOkxKline(raw as unknown as Record<string, unknown>);

    expect(result.time).toEqual(new Date(1700000000000));
    expect(result.open).toBe(42000.50);
    expect(result.high).toBe(42200.00);
    expect(result.low).toBe(41900.25);
    expect(result.close).toBe(42100.75);
    expect(result.volume).toBe(123.456);
    expect(result.trades).toBe(0); // OKX doesn't provide trade count
  });

  it('should handle object with data property', () => {
    const raw = {
      data: ['1700000000000', '42000.50', '42200.00', '41900.25', '42100.75', '123.456'],
    };
    const result = normalizeOkxKline(raw as unknown as Record<string, unknown>);

    expect(result.open).toBe(42000.50);
    expect(result.close).toBe(42100.75);
  });

  it('should handle empty array with defaults of 0', () => {
    const raw: unknown[] = [];
    const result = normalizeOkxKline(raw as unknown as Record<string, unknown>);

    expect(result.time).toEqual(new Date(0));
    expect(result.open).toBe(0);
    expect(result.high).toBe(0);
    expect(result.low).toBe(0);
    expect(result.close).toBe(0);
    expect(result.volume).toBe(0);
  });

  it('should handle object without data property', () => {
    const raw = { something: 'else' };
    const result = normalizeOkxKline(raw as unknown as Record<string, unknown>);

    expect(result.open).toBe(0);
    expect(result.close).toBe(0);
    expect(result.volume).toBe(0);
  });

  it('should always return trades as 0', () => {
    const raw = ['1700000000000', '100', '200', '50', '150', '1000'];
    const result = normalizeOkxKline(raw as unknown as Record<string, unknown>);
    expect(result.trades).toBe(0);
  });
});
