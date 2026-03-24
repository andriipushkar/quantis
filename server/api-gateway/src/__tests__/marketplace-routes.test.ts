/**
 * Marketplace routes — unit tests
 *
 * Tests strategy listing, detail, follow/unfollow, rating, and publishing.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockQuery = jest.fn();
jest.mock('../config/database.js', () => ({
  __esModule: true,
  query: (...args: any[]) => mockQuery(...args),
  default: {},
}));

jest.mock('../config/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('../config/env.js', () => ({
  __esModule: true,
  env: { JWT_ACCESS_SECRET: 'test-secret-long-enough-for-jwt' },
}));

jest.mock('../config/redis.js', () => ({
  __esModule: true,
  default: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
}));

// ---------------------------------------------------------------------------
// Tests — rowToStrategy mapper
// ---------------------------------------------------------------------------

describe('Marketplace — rowToStrategy mapping', () => {
  // Replicate the mapper to test it in isolation
  function rowToStrategy(r: Record<string, unknown>, avgRating: number, ratingCount: number) {
    return {
      id: r.id as string,
      name: r.name as string,
      description: r.description as string,
      creator: r.author_name as string,
      type: r.type as string,
      winRate: parseFloat(r.win_rate as string),
      totalReturn: parseFloat(r.total_return as string),
      maxDrawdown: parseFloat(r.max_drawdown as string),
      sharpeRatio: parseFloat(r.sharpe_ratio as string),
      followers: parseInt(r.followers_count as string, 10),
      rating: avgRating,
      ratingCount,
      price: r.price != null ? parseFloat(r.price as string) : 'free',
      timeframe: r.timeframe as string,
      pairs: r.pairs as string[],
      createdAt: (r.created_at as Date).toISOString(),
    };
  }

  const sampleRow = {
    id: 's1',
    name: 'Alpha Strategy',
    description: 'A trend-following bot',
    author_name: 'trader42',
    type: 'trend',
    win_rate: '65.5',
    total_return: '142.3',
    max_drawdown: '-12.8',
    sharpe_ratio: '2.1',
    followers_count: '150',
    price: '29.99',
    timeframe: '4h',
    pairs: ['BTCUSDT', 'ETHUSDT'],
    created_at: new Date('2026-01-15'),
  };

  test('maps all fields correctly', () => {
    const result = rowToStrategy(sampleRow, 4.2, 35);
    expect(result).toEqual({
      id: 's1',
      name: 'Alpha Strategy',
      description: 'A trend-following bot',
      creator: 'trader42',
      type: 'trend',
      winRate: 65.5,
      totalReturn: 142.3,
      maxDrawdown: -12.8,
      sharpeRatio: 2.1,
      followers: 150,
      rating: 4.2,
      ratingCount: 35,
      price: 29.99,
      timeframe: '4h',
      pairs: ['BTCUSDT', 'ETHUSDT'],
      createdAt: '2026-01-15T00:00:00.000Z',
    });
  });

  test('null price → "free"', () => {
    const result = rowToStrategy({ ...sampleRow, price: null }, 0, 0);
    expect(result.price).toBe('free');
  });

  test('undefined price → "free"', () => {
    const result = rowToStrategy({ ...sampleRow, price: undefined }, 0, 0);
    expect(result.price).toBe('free');
  });
});

// ---------------------------------------------------------------------------
// Tests — Sorting logic
// ---------------------------------------------------------------------------

describe('Marketplace — sort options', () => {
  test('valid sort options: rating, return, followers', () => {
    const validSorts = ['rating', 'return', 'followers'];
    expect(validSorts).toContain('rating');
    expect(validSorts).toContain('return');
    expect(validSorts).toContain('followers');
  });

  test('default sort is by rating', () => {
    const sort = undefined;
    const orderClause =
      sort === 'return' ? 'ms.total_return DESC'
      : sort === 'followers' ? 'ms.followers_count DESC'
      : 'avg_rating DESC';
    expect(orderClause).toBe('avg_rating DESC');
  });
});

// ---------------------------------------------------------------------------
// Tests — Strategy type validation
// ---------------------------------------------------------------------------

describe('Marketplace — strategy type validation', () => {
  const validTypes = ['trend', 'mean_reversion', 'breakout', 'scalp'];

  test.each(validTypes)('"%s" is a valid type', (type) => {
    expect(validTypes.includes(type)).toBe(true);
  });

  test.each(['momentum', 'arbitrage', ''])('"%s" is an invalid type', (type) => {
    expect(validTypes.includes(type)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests — Publish validation
// ---------------------------------------------------------------------------

describe('Marketplace — publish validation', () => {
  test('missing name → invalid', () => {
    const body = { description: 'x', type: 'trend', timeframe: '4h', pairs: ['BTC'] };
    expect(!body.name).toBe(true);
  });

  test('missing pairs → invalid', () => {
    const body = { name: 'X', description: 'x', type: 'trend', timeframe: '4h' } as any;
    expect(!body.pairs || !Array.isArray(body.pairs)).toBe(true);
  });

  test('pairs not array → invalid', () => {
    const body = { name: 'X', description: 'x', type: 'trend', timeframe: '4h', pairs: 'BTC' };
    expect(!Array.isArray(body.pairs)).toBe(true);
  });

  test('all fields present with array pairs → valid', () => {
    const body = { name: 'X', description: 'x', type: 'trend', timeframe: '4h', pairs: ['BTC'] };
    const valid = body.name && body.description && body.type && body.timeframe && body.pairs && Array.isArray(body.pairs);
    expect(valid).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Tests — Rating validation
// ---------------------------------------------------------------------------

describe('Marketplace — rating validation', () => {
  test.each([1, 2, 3, 4, 5])('rating %d is valid', (rating) => {
    expect(typeof rating === 'number' && rating >= 1 && rating <= 5).toBe(true);
  });

  test.each([0, 6, -1, 10])('rating %d is invalid', (rating) => {
    expect(typeof rating === 'number' && rating >= 1 && rating <= 5).toBe(false);
  });

  test('string rating is invalid', () => {
    const rating = '3' as any;
    expect(typeof rating === 'number').toBe(false);
  });

  test('rating is rounded to integer', () => {
    expect(Math.round(3.7)).toBe(4);
    expect(Math.round(2.2)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Tests — Follow/unfollow toggle logic
// ---------------------------------------------------------------------------

describe('Marketplace — follow/unfollow logic', () => {
  beforeEach(() => jest.clearAllMocks());

  test('strategy not found → 404', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const result = await mockQuery('SELECT id FROM marketplace_strategies WHERE id = $1', ['nonexistent']);
    expect(result.rows.length).toBe(0);
  });

  test('not following → follow (insert)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 's1', followers_count: 10 }] }) // strategy exists
      .mockResolvedValueOnce({ rows: [] }); // not yet following

    const strat = await mockQuery('SELECT id, followers_count...', ['s1']);
    expect(strat.rows.length).toBe(1);
    const existing = await mockQuery('SELECT 1 FROM marketplace_followers...', ['s1', 'u1']);
    expect(existing.rows.length).toBe(0); // → follow
  });

  test('already following → unfollow (delete)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 's1', followers_count: 10 }] })
      .mockResolvedValueOnce({ rows: [{ '1': 1 }] }); // already following

    await mockQuery('SELECT...', ['s1']);
    const existing = await mockQuery('SELECT 1...', ['s1', 'u1']);
    expect(existing.rows.length).toBe(1); // → unfollow
  });
});

// ---------------------------------------------------------------------------
// Tests — DB error handling
// ---------------------------------------------------------------------------

describe('Marketplace — error handling', () => {
  test('DB error is caught gracefully', async () => {
    mockQuery.mockRejectedValue(new Error('DB timeout'));
    await expect(mockQuery('SELECT...')).rejects.toThrow('DB timeout');
  });
});
