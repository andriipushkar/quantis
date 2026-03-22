/**
 * Watchlist Route — Unit Tests
 *
 * Tests watchlist business logic, symbol normalization,
 * and tier-based limit patterns from watchlist.ts.
 */

// ---------------------------------------------------------------------------
// Symbol normalization
// ---------------------------------------------------------------------------
describe('Watchlist symbol normalization', () => {
  // Mirrors the toUpperCase() call in watchlist.ts POST/DELETE handlers
  function normalizeSymbol(symbol: string): string {
    return symbol.toUpperCase();
  }

  test('converts lowercase to uppercase', () => {
    expect(normalizeSymbol('btcusdt')).toBe('BTCUSDT');
  });

  test('converts mixed case to uppercase', () => {
    expect(normalizeSymbol('BtcUsdt')).toBe('BTCUSDT');
  });

  test('already uppercase stays the same', () => {
    expect(normalizeSymbol('BTCUSDT')).toBe('BTCUSDT');
  });

  test('handles various symbol formats', () => {
    expect(normalizeSymbol('ethusdt')).toBe('ETHUSDT');
    expect(normalizeSymbol('sol/usdt')).toBe('SOL/USDT');
    expect(normalizeSymbol('doge-usdt')).toBe('DOGE-USDT');
  });
});

// ---------------------------------------------------------------------------
// Watchlist add with ON CONFLICT DO NOTHING (idempotency)
// ---------------------------------------------------------------------------
describe('Watchlist add idempotency', () => {
  // Simulates the ON CONFLICT DO NOTHING behavior
  function addToWatchlist(
    watchlist: Map<string, Set<number>>,
    userId: string,
    pairId: number
  ): { added: boolean } {
    if (!watchlist.has(userId)) {
      watchlist.set(userId, new Set());
    }
    const userWl = watchlist.get(userId)!;
    if (userWl.has(pairId)) {
      return { added: false }; // ON CONFLICT DO NOTHING
    }
    userWl.add(pairId);
    return { added: true };
  }

  test('first add succeeds', () => {
    const watchlist = new Map<string, Set<number>>();
    const result = addToWatchlist(watchlist, 'user-1', 1);
    expect(result.added).toBe(true);
    expect(watchlist.get('user-1')?.size).toBe(1);
  });

  test('duplicate add is idempotent (no error)', () => {
    const watchlist = new Map<string, Set<number>>();
    addToWatchlist(watchlist, 'user-1', 1);
    const result = addToWatchlist(watchlist, 'user-1', 1);
    expect(result.added).toBe(false);
    expect(watchlist.get('user-1')?.size).toBe(1);
  });

  test('different pairs are added independently', () => {
    const watchlist = new Map<string, Set<number>>();
    addToWatchlist(watchlist, 'user-1', 1);
    addToWatchlist(watchlist, 'user-1', 2);
    addToWatchlist(watchlist, 'user-1', 3);
    expect(watchlist.get('user-1')?.size).toBe(3);
  });

  test('different users have independent watchlists', () => {
    const watchlist = new Map<string, Set<number>>();
    addToWatchlist(watchlist, 'user-1', 1);
    addToWatchlist(watchlist, 'user-2', 1);
    expect(watchlist.get('user-1')?.size).toBe(1);
    expect(watchlist.get('user-2')?.size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Watchlist removal logic
// ---------------------------------------------------------------------------
describe('Watchlist removal logic', () => {
  function removeFromWatchlist(
    watchlist: Map<string, Set<number>>,
    userId: string,
    pairId: number
  ): { removed: boolean } {
    const userWl = watchlist.get(userId);
    if (!userWl || !userWl.has(pairId)) {
      return { removed: false };
    }
    userWl.delete(pairId);
    return { removed: true };
  }

  test('removing existing item succeeds', () => {
    const watchlist = new Map<string, Set<number>>();
    watchlist.set('user-1', new Set([1, 2, 3]));
    const result = removeFromWatchlist(watchlist, 'user-1', 2);
    expect(result.removed).toBe(true);
    expect(watchlist.get('user-1')?.size).toBe(2);
    expect(watchlist.get('user-1')?.has(2)).toBe(false);
  });

  test('removing non-existent item returns not removed', () => {
    const watchlist = new Map<string, Set<number>>();
    watchlist.set('user-1', new Set([1]));
    const result = removeFromWatchlist(watchlist, 'user-1', 99);
    expect(result.removed).toBe(false);
  });

  test('removing from non-existent user returns not removed', () => {
    const watchlist = new Map<string, Set<number>>();
    const result = removeFromWatchlist(watchlist, 'user-999', 1);
    expect(result.removed).toBe(false);
  });

  test('removing does not affect other users', () => {
    const watchlist = new Map<string, Set<number>>();
    watchlist.set('user-1', new Set([1, 2]));
    watchlist.set('user-2', new Set([1, 2]));
    removeFromWatchlist(watchlist, 'user-1', 1);
    expect(watchlist.get('user-1')?.size).toBe(1);
    expect(watchlist.get('user-2')?.size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Watchlist limit per tier
// ---------------------------------------------------------------------------
describe('Watchlist max limit per tier', () => {
  const TIER_LIMITS: Record<string, number> = {
    free: 10,
    basic: 25,
    pro: 50,
    enterprise: 200,
  };

  function canAddToWatchlist(tier: string, currentCount: number): boolean {
    const limit = TIER_LIMITS[tier] ?? TIER_LIMITS['free'];
    return currentCount < limit;
  }

  test('free tier allows up to 10 items', () => {
    expect(canAddToWatchlist('free', 0)).toBe(true);
    expect(canAddToWatchlist('free', 9)).toBe(true);
    expect(canAddToWatchlist('free', 10)).toBe(false);
    expect(canAddToWatchlist('free', 15)).toBe(false);
  });

  test('basic tier allows up to 25 items', () => {
    expect(canAddToWatchlist('basic', 24)).toBe(true);
    expect(canAddToWatchlist('basic', 25)).toBe(false);
  });

  test('pro tier allows up to 50 items', () => {
    expect(canAddToWatchlist('pro', 49)).toBe(true);
    expect(canAddToWatchlist('pro', 50)).toBe(false);
  });

  test('enterprise tier allows up to 200 items', () => {
    expect(canAddToWatchlist('enterprise', 199)).toBe(true);
    expect(canAddToWatchlist('enterprise', 200)).toBe(false);
  });

  test('unknown tier defaults to free limit', () => {
    expect(canAddToWatchlist('unknown', 9)).toBe(true);
    expect(canAddToWatchlist('unknown', 10)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Watchlist ticker enrichment pattern
// ---------------------------------------------------------------------------
describe('Watchlist ticker enrichment', () => {
  // Mirrors the pattern from GET / handler
  type WatchlistRow = {
    id: number;
    symbol: string;
    base_asset: string;
    quote_asset: string;
    exchange: string;
    added_at: string;
  };

  type Ticker = {
    price: number;
    change24h: number;
    volume: number;
  };

  function enrichWithTicker(row: WatchlistRow, ticker: Ticker | null) {
    return { ...row, ticker };
  }

  test('enriches row with ticker data', () => {
    const row: WatchlistRow = {
      id: 1,
      symbol: 'BTCUSDT',
      base_asset: 'BTC',
      quote_asset: 'USDT',
      exchange: 'binance',
      added_at: '2026-01-01T00:00:00Z',
    };
    const ticker: Ticker = { price: 97500, change24h: 2.5, volume: 5000000 };
    const result = enrichWithTicker(row, ticker);

    expect(result.symbol).toBe('BTCUSDT');
    expect(result.ticker).toBeDefined();
    expect(result.ticker!.price).toBe(97500);
  });

  test('handles null ticker (no live data)', () => {
    const row: WatchlistRow = {
      id: 2,
      symbol: 'XYZUSDT',
      base_asset: 'XYZ',
      quote_asset: 'USDT',
      exchange: 'binance',
      added_at: '2026-01-01T00:00:00Z',
    };
    const result = enrichWithTicker(row, null);
    expect(result.ticker).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Watchlist exchange lookup order (binance > bybit > okx)
// ---------------------------------------------------------------------------
describe('Watchlist exchange ticker lookup order', () => {
  // Mirrors the exchange priority from watchlist.ts
  const EXCHANGE_PRIORITY = ['binance', 'bybit', 'okx'];

  function findTickerFromExchanges(
    symbol: string,
    tickerStore: Record<string, string | null>
  ): { price: number } | null {
    for (const ex of EXCHANGE_PRIORITY) {
      const key = `ticker:${ex}:${symbol}`;
      const data = tickerStore[key];
      if (data) {
        try {
          return JSON.parse(data);
        } catch {
          // skip
        }
      }
    }
    return null;
  }

  test('prefers binance when available', () => {
    const store: Record<string, string> = {
      'ticker:binance:BTCUSDT': JSON.stringify({ price: 97500 }),
      'ticker:bybit:BTCUSDT': JSON.stringify({ price: 97450 }),
    };
    const result = findTickerFromExchanges('BTCUSDT', store);
    expect(result?.price).toBe(97500);
  });

  test('falls back to bybit when binance unavailable', () => {
    const store: Record<string, string> = {
      'ticker:bybit:BTCUSDT': JSON.stringify({ price: 97450 }),
    };
    const result = findTickerFromExchanges('BTCUSDT', store);
    expect(result?.price).toBe(97450);
  });

  test('falls back to okx as last resort', () => {
    const store: Record<string, string> = {
      'ticker:okx:BTCUSDT': JSON.stringify({ price: 97400 }),
    };
    const result = findTickerFromExchanges('BTCUSDT', store);
    expect(result?.price).toBe(97400);
  });

  test('returns null when no exchange has data', () => {
    const result = findTickerFromExchanges('UNKNOWNUSDT', {});
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Watchlist ordering (added_at DESC)
// ---------------------------------------------------------------------------
describe('Watchlist ordering', () => {
  test('items sorted by added_at descending (newest first)', () => {
    const items = [
      { symbol: 'BTCUSDT', added_at: '2026-01-15T10:00:00Z' },
      { symbol: 'ETHUSDT', added_at: '2026-03-20T10:00:00Z' },
      { symbol: 'SOLUSDT', added_at: '2026-02-10T10:00:00Z' },
    ];

    const sorted = [...items].sort(
      (a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime()
    );

    expect(sorted[0].symbol).toBe('ETHUSDT');
    expect(sorted[1].symbol).toBe('SOLUSDT');
    expect(sorted[2].symbol).toBe('BTCUSDT');
  });
});
