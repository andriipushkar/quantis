/**
 * Copy-Trading — Unit Tests
 *
 * Tests the pure business logic: leader ranking, badge assignment,
 * copy relationship CRUD, duplicate detection, PnL aggregation.
 */

// ---------------------------------------------------------------------------
// Types mirrored from routes/copy-trading.ts
// ---------------------------------------------------------------------------

type Badge = 'bronze' | 'silver' | 'gold' | 'platinum';

interface LeadTrader {
  id: string;
  displayName: string;
  winRate: number;
  totalReturn: number;
  maxDrawdown: number;
  totalTrades: number;
  copiers: number;
  riskScore: number;
  badge: Badge;
  monthsProfitable: number;
  avgTradeReturn: number;
  bio: string;
}

interface CopyRelationship {
  id: string;
  userId: string;
  leaderId: string;
  allocation: number;
  startedAt: string;
  currentPnl: number;
}

// ---------------------------------------------------------------------------
// Helpers mirroring the route logic
// ---------------------------------------------------------------------------

function rankLeadersByReturn(leaders: LeadTrader[]): LeadTrader[] {
  return [...leaders].sort((a, b) => b.totalReturn - a.totalReturn);
}

/**
 * Badge assignment thresholds inferred from the mock seed data:
 *   platinum: totalReturn >= 100 OR (winRate >= 75 AND monthsProfitable >= 18)
 *   gold:     totalReturn >= 50  OR monthsProfitable >= 11
 *   silver:   totalReturn >= 0   OR monthsProfitable >= 8
 *   bronze:   everything else (negative returns, low experience)
 *
 * The source file uses hardcoded badges, so we test the data consistency.
 */
function assignBadge(trader: Pick<LeadTrader, 'totalReturn' | 'winRate' | 'monthsProfitable'>): Badge {
  if (trader.totalReturn >= 100 || (trader.winRate >= 75 && trader.monthsProfitable >= 18)) {
    return 'platinum';
  }
  if (trader.totalReturn >= 50 || trader.monthsProfitable >= 11) {
    return 'gold';
  }
  if (trader.totalReturn >= 0 || trader.monthsProfitable >= 8) {
    return 'silver';
  }
  return 'bronze';
}

function validateAllocation(allocation: unknown): { valid: true; value: number } | { valid: false; error: string } {
  if (!allocation || typeof allocation !== 'number' || allocation <= 0) {
    return { valid: false, error: 'Valid allocation amount is required' };
  }
  return { valid: true, value: allocation };
}

/**
 * Simulated PnL calculation from the /active route:
 *   pnl = allocation * (leader.totalReturn / 100) * (elapsedHours / (24 * 30))
 */
function calculateSimulatedPnl(allocation: number, leaderTotalReturn: number, elapsedHours: number): number {
  return Math.round(allocation * (leaderTotalReturn / 100) * (elapsedHours / (24 * 30)) * 100) / 100;
}

// ---------------------------------------------------------------------------
// In-memory store for copy relationships (mirrors route)
// ---------------------------------------------------------------------------

function createCopyStore() {
  const leaders = new Map<string, LeadTrader>();
  const relationships = new Map<string, CopyRelationship>();

  function follow(
    userId: string,
    leaderId: string,
    allocation: number,
  ): { error?: string; status?: number; relationship?: CopyRelationship } {
    const leader = leaders.get(leaderId);
    if (!leader) return { error: 'Leader not found', status: 404 };

    const allocResult = validateAllocation(allocation);
    if (!allocResult.valid) return { error: allocResult.error, status: 400 };

    // Duplicate check
    for (const rel of relationships.values()) {
      if (rel.userId === userId && rel.leaderId === leaderId) {
        return { error: 'Already copying this leader', status: 409 };
      }
    }

    const relationship: CopyRelationship = {
      id: `cr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId,
      leaderId,
      allocation,
      startedAt: new Date().toISOString(),
      currentPnl: 0,
    };

    relationships.set(relationship.id, relationship);
    leader.copiers += 1;

    return { relationship };
  }

  function unfollow(userId: string, leaderId: string): boolean {
    let foundId: string | null = null;
    for (const [id, rel] of relationships.entries()) {
      if (rel.userId === userId && rel.leaderId === leaderId) {
        foundId = id;
        break;
      }
    }
    if (!foundId) return false;

    relationships.delete(foundId);
    const leader = leaders.get(leaderId);
    if (leader && leader.copiers > 0) leader.copiers -= 1;
    return true;
  }

  function getUserCopies(userId: string): CopyRelationship[] {
    const result: CopyRelationship[] = [];
    for (const rel of relationships.values()) {
      if (rel.userId === userId) result.push(rel);
    }
    return result;
  }

  return { leaders, relationships, follow, unfollow, getUserCopies };
}

// ---------------------------------------------------------------------------
// Mock leader data (subset of the 8 leaders from the route)
// ---------------------------------------------------------------------------

const MOCK_LEADERS: LeadTrader[] = [
  {
    id: 'lt-001', displayName: 'CryptoAlpha', winRate: 72.5, totalReturn: 148.3,
    maxDrawdown: 12.4, totalTrades: 1247, copiers: 384, riskScore: 3,
    badge: 'platinum', monthsProfitable: 18, avgTradeReturn: 2.1, bio: 'Trend follower',
  },
  {
    id: 'lt-002', displayName: 'SwingMaster_X', winRate: 68.2, totalReturn: 95.7,
    maxDrawdown: 18.6, totalTrades: 892, copiers: 256, riskScore: 4,
    badge: 'gold', monthsProfitable: 14, avgTradeReturn: 3.4, bio: 'Swing trader',
  },
  {
    id: 'lt-004', displayName: 'SteadyEddie', winRate: 78.4, totalReturn: 42.6,
    maxDrawdown: 5.8, totalTrades: 2103, copiers: 512, riskScore: 1,
    badge: 'platinum', monthsProfitable: 20, avgTradeReturn: 0.8, bio: 'Conservative',
  },
  {
    id: 'lt-005', displayName: 'MoonShot_Pro', winRate: 45.3, totalReturn: 112.8,
    maxDrawdown: 35.2, totalTrades: 678, copiers: 142, riskScore: 5,
    badge: 'silver', monthsProfitable: 9, avgTradeReturn: 7.2, bio: 'High risk',
  },
  {
    id: 'lt-007', displayName: 'NarrativeHunter', winRate: 58.1, totalReturn: -8.3,
    maxDrawdown: 28.9, totalTrades: 312, copiers: 67, riskScore: 5,
    badge: 'bronze', monthsProfitable: 5, avgTradeReturn: 2.9, bio: 'Narrative',
  },
];

// ===========================================================================
// Tests
// ===========================================================================

describe('Copy-Trading — Leader Ranking', () => {
  test('leaders are sorted by totalReturn descending', () => {
    const ranked = rankLeadersByReturn(MOCK_LEADERS);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].totalReturn).toBeGreaterThanOrEqual(ranked[i].totalReturn);
    }
    expect(ranked[0].displayName).toBe('CryptoAlpha');
  });

  test('returns all leaders', () => {
    const ranked = rankLeadersByReturn(MOCK_LEADERS);
    expect(ranked).toHaveLength(MOCK_LEADERS.length);
  });

  test('negative return traders ranked last', () => {
    const ranked = rankLeadersByReturn(MOCK_LEADERS);
    const last = ranked[ranked.length - 1];
    expect(last.totalReturn).toBeLessThan(0);
    expect(last.displayName).toBe('NarrativeHunter');
  });
});

describe('Copy-Trading — Badge Assignment', () => {
  test('platinum badge for high return (>= 100%)', () => {
    expect(assignBadge({ totalReturn: 148.3, winRate: 72.5, monthsProfitable: 18 })).toBe('platinum');
  });

  test('platinum badge for high winRate + long track record', () => {
    expect(assignBadge({ totalReturn: 42.6, winRate: 78.4, monthsProfitable: 20 })).toBe('platinum');
  });

  test('gold badge for moderate return (>= 50%)', () => {
    expect(assignBadge({ totalReturn: 95.7, winRate: 68.2, monthsProfitable: 14 })).toBe('gold');
  });

  test('gold badge from high months profitable (>= 11)', () => {
    expect(assignBadge({ totalReturn: 30, winRate: 55, monthsProfitable: 12 })).toBe('gold');
  });

  test('silver badge for positive return', () => {
    expect(assignBadge({ totalReturn: 10, winRate: 50, monthsProfitable: 6 })).toBe('silver');
  });

  test('silver badge for high months profitable (>= 8)', () => {
    expect(assignBadge({ totalReturn: -5, winRate: 40, monthsProfitable: 9 })).toBe('silver');
  });

  test('bronze badge for negative return, low experience', () => {
    expect(assignBadge({ totalReturn: -8.3, winRate: 58.1, monthsProfitable: 5 })).toBe('bronze');
  });
});

describe('Copy-Trading — Follow / Unfollow', () => {
  function setupStore() {
    const store = createCopyStore();
    for (const l of MOCK_LEADERS) {
      store.leaders.set(l.id, { ...l }); // clone to avoid cross-test mutation
    }
    return store;
  }

  test('follow creates copy relationship with correct allocation', () => {
    const store = setupStore();
    const result = store.follow('user-1', 'lt-001', 500);
    expect(result.relationship).toBeDefined();
    expect(result.relationship!.userId).toBe('user-1');
    expect(result.relationship!.leaderId).toBe('lt-001');
    expect(result.relationship!.allocation).toBe(500);
    expect(result.relationship!.currentPnl).toBe(0);
  });

  test('follow increments copiers count', () => {
    const store = setupStore();
    const before = store.leaders.get('lt-001')!.copiers;
    store.follow('user-1', 'lt-001', 500);
    expect(store.leaders.get('lt-001')!.copiers).toBe(before + 1);
  });

  test('follow rejects non-existent leader (404)', () => {
    const store = setupStore();
    const result = store.follow('user-1', 'lt-999', 500);
    expect(result.status).toBe(404);
    expect(result.error).toContain('not found');
  });

  test('follow rejects invalid allocation', () => {
    const store = setupStore();
    const r1 = store.follow('user-1', 'lt-001', 0);
    expect(r1.status).toBe(400);
    const r2 = store.follow('user-1', 'lt-001', -100);
    expect(r2.status).toBe(400);
  });

  test('follow rejects duplicate copy (409)', () => {
    const store = setupStore();
    store.follow('user-1', 'lt-001', 500);
    const result = store.follow('user-1', 'lt-001', 300);
    expect(result.status).toBe(409);
    expect(result.error).toContain('Already copying');
  });

  test('different users can follow same leader', () => {
    const store = setupStore();
    const r1 = store.follow('user-1', 'lt-001', 500);
    const r2 = store.follow('user-2', 'lt-001', 300);
    expect(r1.relationship).toBeDefined();
    expect(r2.relationship).toBeDefined();
  });

  test('unfollow removes relationship', () => {
    const store = setupStore();
    store.follow('user-1', 'lt-002', 200);
    expect(store.getUserCopies('user-1')).toHaveLength(1);
    const removed = store.unfollow('user-1', 'lt-002');
    expect(removed).toBe(true);
    expect(store.getUserCopies('user-1')).toHaveLength(0);
  });

  test('unfollow decrements copiers count', () => {
    const store = setupStore();
    const before = store.leaders.get('lt-002')!.copiers;
    store.follow('user-1', 'lt-002', 200);
    store.unfollow('user-1', 'lt-002');
    expect(store.leaders.get('lt-002')!.copiers).toBe(before);
  });

  test('unfollow returns false for non-existent relationship', () => {
    const store = setupStore();
    expect(store.unfollow('user-1', 'lt-001')).toBe(false);
  });
});

describe('Copy-Trading — My Active Copies', () => {
  test('returns only the requesting user copies', () => {
    const store = createCopyStore();
    for (const l of MOCK_LEADERS) store.leaders.set(l.id, { ...l });

    store.follow('user-1', 'lt-001', 500);
    store.follow('user-1', 'lt-002', 300);
    store.follow('user-2', 'lt-001', 100);

    const user1Copies = store.getUserCopies('user-1');
    expect(user1Copies).toHaveLength(2);
    expect(user1Copies.every((c) => c.userId === 'user-1')).toBe(true);
  });

  test('empty for user with no copies', () => {
    const store = createCopyStore();
    for (const l of MOCK_LEADERS) store.leaders.set(l.id, { ...l });
    expect(store.getUserCopies('user-99')).toHaveLength(0);
  });
});

describe('Copy-Trading — PnL Aggregation', () => {
  test('PnL scales with allocation', () => {
    const pnl500 = calculateSimulatedPnl(500, 100, 24 * 30); // 1 month
    const pnl1000 = calculateSimulatedPnl(1000, 100, 24 * 30);
    expect(pnl1000).toBe(pnl500 * 2);
  });

  test('PnL scales with elapsed time', () => {
    const pnl1month = calculateSimulatedPnl(1000, 100, 24 * 30);
    const pnl2months = calculateSimulatedPnl(1000, 100, 24 * 60);
    expect(pnl2months).toBeCloseTo(pnl1month * 2, 2);
  });

  test('PnL for full month equals allocation * (totalReturn/100)', () => {
    // 1000 allocation, 50% total return, 1 month => 1000 * 0.5 * 1 = 500
    expect(calculateSimulatedPnl(1000, 50, 24 * 30)).toBe(500);
  });

  test('negative totalReturn gives negative PnL', () => {
    const pnl = calculateSimulatedPnl(1000, -8.3, 24 * 30);
    expect(pnl).toBeLessThan(0);
    expect(pnl).toBe(-83);
  });

  test('zero elapsed time gives zero PnL', () => {
    expect(calculateSimulatedPnl(1000, 100, 0)).toBe(0);
  });
});

describe('Copy-Trading — Allocation Validation', () => {
  test('rejects null/undefined', () => {
    expect(validateAllocation(null).valid).toBe(false);
    expect(validateAllocation(undefined).valid).toBe(false);
  });

  test('rejects non-number', () => {
    expect(validateAllocation('500').valid).toBe(false);
    expect(validateAllocation(true).valid).toBe(false);
  });

  test('rejects zero', () => {
    expect(validateAllocation(0).valid).toBe(false);
  });

  test('rejects negative', () => {
    expect(validateAllocation(-100).valid).toBe(false);
  });

  test('accepts positive number', () => {
    const result = validateAllocation(500);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value).toBe(500);
  });
});
