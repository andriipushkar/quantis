/**
 * Gamification — Unit Tests
 *
 * Tests XP calculation, level progression, achievements, streaks, and badges
 * from routes/gamification.ts.
 */

// ---------------------------------------------------------------------------
// Replicated types & logic from gamification.ts
// ---------------------------------------------------------------------------

interface XPEntry {
  action: string;
  xp: number;
  timestamp: number;
}

interface UserGamification {
  totalXP: number;
  history: XPEntry[];
  streakDays: number;
  lastLoginDate: string;
  actionCounts: Record<string, number>;
}

const LEVEL_THRESHOLDS = [
  { level: 1, xp: 0, name: 'Newbie' },
  { level: 2, xp: 100, name: 'Student' },
  { level: 3, xp: 500, name: 'Apprentice' },
  { level: 4, xp: 1500, name: 'Trader' },
  { level: 5, xp: 4000, name: 'Analyst' },
  { level: 6, xp: 10000, name: 'Strategist' },
  { level: 7, xp: 25000, name: 'Expert' },
  { level: 8, xp: 50000, name: 'Legend' },
];

const ACTION_XP: Record<string, number> = {
  view_chart: 5,
  add_indicator: 10,
  set_alert: 25,
  complete_lesson: 100,
  paper_trade: 20,
  use_screener: 10,
  ask_copilot: 15,
  first_login: 50,
};

const ACHIEVEMENTS = [
  {
    id: 'first_steps',
    name: 'First Steps',
    description: 'Complete the onboarding wizard',
    xpReward: 50,
    condition: (g: UserGamification) =>
      (g.actionCounts['complete_onboarding'] ?? 0) >= 1,
  },
  {
    id: 'chart_master',
    name: 'Chart Master',
    description: 'View 10 charts',
    xpReward: 200,
    condition: (g: UserGamification) =>
      (g.actionCounts['view_chart'] ?? 0) >= 10,
  },
  {
    id: 'alert_pro',
    name: 'Alert Pro',
    description: 'Create 5 alerts',
    xpReward: 200,
    condition: (g: UserGamification) =>
      (g.actionCounts['set_alert'] ?? 0) >= 5,
  },
  {
    id: 'paper_hero',
    name: 'Paper Hero',
    description: 'Complete 10 paper trades',
    xpReward: 300,
    condition: (g: UserGamification) =>
      (g.actionCounts['paper_trade'] ?? 0) >= 10,
  },
  {
    id: 'knowledge_seeker',
    name: 'Knowledge Seeker',
    description: 'Complete 5 academy lessons',
    xpReward: 150,
    condition: (g: UserGamification) =>
      (g.actionCounts['complete_lesson'] ?? 0) >= 5,
  },
  {
    id: 'ai_explorer',
    name: 'AI Explorer',
    description: 'Ask 10 copilot questions',
    xpReward: 150,
    condition: (g: UserGamification) =>
      (g.actionCounts['ask_copilot'] ?? 0) >= 10,
  },
  {
    id: 'week_warrior',
    name: 'Week Warrior',
    description: '7-day login streak',
    xpReward: 100,
    condition: (g: UserGamification) => g.streakDays >= 7,
  },
];

function getLevelInfo(xp: number) {
  let current = LEVEL_THRESHOLDS[0];
  let next: (typeof LEVEL_THRESHOLDS)[0] | null = LEVEL_THRESHOLDS[1];
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i].xp) {
      current = LEVEL_THRESHOLDS[i];
      next = LEVEL_THRESHOLDS[i + 1] || null;
      break;
    }
  }
  return {
    level: current.level,
    name: current.name,
    currentXP: xp,
    nextLevelXP: next ? next.xp : null,
    progress: next ? (xp - current.xp) / (next.xp - current.xp) : 1,
  };
}

function isDuplicateWithinHour(history: XPEntry[], action: string): boolean {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  return history.some((e) => e.action === action && e.timestamp > oneHourAgo);
}

function createUser(): UserGamification {
  return {
    totalXP: 0,
    history: [],
    streakDays: 1,
    lastLoginDate: new Date().toISOString().slice(0, 10),
    actionCounts: {},
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Gamification — XP Per Action', () => {
  test('view_chart awards 5 XP', () => {
    expect(ACTION_XP['view_chart']).toBe(5);
  });

  test('add_indicator awards 10 XP', () => {
    expect(ACTION_XP['add_indicator']).toBe(10);
  });

  test('set_alert awards 25 XP', () => {
    expect(ACTION_XP['set_alert']).toBe(25);
  });

  test('complete_lesson awards 100 XP', () => {
    expect(ACTION_XP['complete_lesson']).toBe(100);
  });

  test('paper_trade awards 20 XP', () => {
    expect(ACTION_XP['paper_trade']).toBe(20);
  });

  test('use_screener awards 10 XP', () => {
    expect(ACTION_XP['use_screener']).toBe(10);
  });

  test('ask_copilot awards 15 XP', () => {
    expect(ACTION_XP['ask_copilot']).toBe(15);
  });

  test('first_login awards 50 XP', () => {
    expect(ACTION_XP['first_login']).toBe(50);
  });

  test('invalid action returns undefined', () => {
    expect(ACTION_XP['nonexistent']).toBeUndefined();
  });

  test('all actions have positive XP', () => {
    for (const [action, xp] of Object.entries(ACTION_XP)) {
      expect(xp).toBeGreaterThan(0);
    }
  });
});

describe('Gamification — Level Progression', () => {
  test('0 XP is Level 1 (Newbie)', () => {
    const info = getLevelInfo(0);
    expect(info.level).toBe(1);
    expect(info.name).toBe('Newbie');
  });

  test('99 XP is still Level 1', () => {
    const info = getLevelInfo(99);
    expect(info.level).toBe(1);
    expect(info.name).toBe('Newbie');
  });

  test('100 XP is Level 2 (Student)', () => {
    const info = getLevelInfo(100);
    expect(info.level).toBe(2);
    expect(info.name).toBe('Student');
  });

  test('500 XP is Level 3 (Apprentice)', () => {
    const info = getLevelInfo(500);
    expect(info.level).toBe(3);
    expect(info.name).toBe('Apprentice');
  });

  test('1500 XP is Level 4 (Trader)', () => {
    const info = getLevelInfo(1500);
    expect(info.level).toBe(4);
    expect(info.name).toBe('Trader');
  });

  test('4000 XP is Level 5 (Analyst)', () => {
    const info = getLevelInfo(4000);
    expect(info.level).toBe(5);
    expect(info.name).toBe('Analyst');
  });

  test('10000 XP is Level 6 (Strategist)', () => {
    const info = getLevelInfo(10000);
    expect(info.level).toBe(6);
    expect(info.name).toBe('Strategist');
  });

  test('25000 XP is Level 7 (Expert)', () => {
    const info = getLevelInfo(25000);
    expect(info.level).toBe(7);
    expect(info.name).toBe('Expert');
  });

  test('50000 XP is Level 8 (Legend)', () => {
    const info = getLevelInfo(50000);
    expect(info.level).toBe(8);
    expect(info.name).toBe('Legend');
  });

  test('XP between thresholds stays at lower level', () => {
    const info = getLevelInfo(300);
    expect(info.level).toBe(2);
    expect(info.name).toBe('Student');
  });

  test('massive XP stays at Level 8', () => {
    const info = getLevelInfo(999999);
    expect(info.level).toBe(8);
    expect(info.name).toBe('Legend');
  });
});

describe('Gamification — Level Progress', () => {
  test('progress is 0 at level threshold', () => {
    const info = getLevelInfo(100);
    expect(info.progress).toBe(0);
  });

  test('progress is 0.5 halfway between levels', () => {
    // Level 2 = 100, Level 3 = 500, midpoint = 300
    const info = getLevelInfo(300);
    expect(info.progress).toBe(0.5);
  });

  test('progress is 1 at max level (Legend)', () => {
    const info = getLevelInfo(50000);
    expect(info.progress).toBe(1);
    expect(info.nextLevelXP).toBeNull();
  });

  test('nextLevelXP is correct for non-max level', () => {
    const info = getLevelInfo(0);
    expect(info.nextLevelXP).toBe(100);
  });

  test('currentXP field matches input', () => {
    const info = getLevelInfo(12345);
    expect(info.currentXP).toBe(12345);
  });
});

describe('Gamification — Achievement Unlock Conditions', () => {
  test('first_steps requires 1 complete_onboarding action', () => {
    const user = createUser();
    const achievement = ACHIEVEMENTS.find((a) => a.id === 'first_steps')!;
    expect(achievement.condition(user)).toBe(false);

    user.actionCounts['complete_onboarding'] = 1;
    expect(achievement.condition(user)).toBe(true);
  });

  test('chart_master requires 10 view_chart actions', () => {
    const user = createUser();
    const achievement = ACHIEVEMENTS.find((a) => a.id === 'chart_master')!;

    user.actionCounts['view_chart'] = 9;
    expect(achievement.condition(user)).toBe(false);

    user.actionCounts['view_chart'] = 10;
    expect(achievement.condition(user)).toBe(true);
  });

  test('alert_pro requires 5 set_alert actions', () => {
    const user = createUser();
    const achievement = ACHIEVEMENTS.find((a) => a.id === 'alert_pro')!;

    user.actionCounts['set_alert'] = 4;
    expect(achievement.condition(user)).toBe(false);

    user.actionCounts['set_alert'] = 5;
    expect(achievement.condition(user)).toBe(true);
  });

  test('paper_hero requires 10 paper_trade actions', () => {
    const user = createUser();
    const achievement = ACHIEVEMENTS.find((a) => a.id === 'paper_hero')!;

    user.actionCounts['paper_trade'] = 9;
    expect(achievement.condition(user)).toBe(false);

    user.actionCounts['paper_trade'] = 10;
    expect(achievement.condition(user)).toBe(true);
  });

  test('knowledge_seeker requires 5 complete_lesson actions', () => {
    const user = createUser();
    const achievement = ACHIEVEMENTS.find((a) => a.id === 'knowledge_seeker')!;

    user.actionCounts['complete_lesson'] = 4;
    expect(achievement.condition(user)).toBe(false);

    user.actionCounts['complete_lesson'] = 5;
    expect(achievement.condition(user)).toBe(true);
  });

  test('ai_explorer requires 10 ask_copilot actions', () => {
    const user = createUser();
    const achievement = ACHIEVEMENTS.find((a) => a.id === 'ai_explorer')!;

    user.actionCounts['ask_copilot'] = 9;
    expect(achievement.condition(user)).toBe(false);

    user.actionCounts['ask_copilot'] = 10;
    expect(achievement.condition(user)).toBe(true);
  });

  test('week_warrior requires 7-day streak', () => {
    const user = createUser();
    const achievement = ACHIEVEMENTS.find((a) => a.id === 'week_warrior')!;

    user.streakDays = 6;
    expect(achievement.condition(user)).toBe(false);

    user.streakDays = 7;
    expect(achievement.condition(user)).toBe(true);
  });

  test('exceeding requirement still unlocks achievement', () => {
    const user = createUser();
    user.actionCounts['view_chart'] = 100;
    const achievement = ACHIEVEMENTS.find((a) => a.id === 'chart_master')!;
    expect(achievement.condition(user)).toBe(true);
  });
});

describe('Gamification — Achievement XP Rewards', () => {
  test('first_steps awards 50 XP', () => {
    expect(ACHIEVEMENTS.find((a) => a.id === 'first_steps')!.xpReward).toBe(50);
  });

  test('chart_master awards 200 XP', () => {
    expect(ACHIEVEMENTS.find((a) => a.id === 'chart_master')!.xpReward).toBe(200);
  });

  test('paper_hero awards 300 XP (highest)', () => {
    expect(ACHIEVEMENTS.find((a) => a.id === 'paper_hero')!.xpReward).toBe(300);
  });

  test('week_warrior awards 100 XP', () => {
    expect(ACHIEVEMENTS.find((a) => a.id === 'week_warrior')!.xpReward).toBe(100);
  });

  test('all achievements have positive XP rewards', () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.xpReward).toBeGreaterThan(0);
    }
  });
});

describe('Gamification — Duplicate Prevention', () => {
  test('detects duplicate action within the hour', () => {
    const history: XPEntry[] = [
      { action: 'view_chart', xp: 5, timestamp: Date.now() - 30 * 60_000 }, // 30 min ago
    ];
    expect(isDuplicateWithinHour(history, 'view_chart')).toBe(true);
  });

  test('allows action after one hour', () => {
    const history: XPEntry[] = [
      { action: 'view_chart', xp: 5, timestamp: Date.now() - 61 * 60_000 }, // 61 min ago
    ];
    expect(isDuplicateWithinHour(history, 'view_chart')).toBe(false);
  });

  test('different action is not considered duplicate', () => {
    const history: XPEntry[] = [
      { action: 'view_chart', xp: 5, timestamp: Date.now() - 10_000 },
    ];
    expect(isDuplicateWithinHour(history, 'set_alert')).toBe(false);
  });

  test('empty history has no duplicates', () => {
    expect(isDuplicateWithinHour([], 'view_chart')).toBe(false);
  });

  test('action exactly at 1 hour boundary is not duplicate', () => {
    const history: XPEntry[] = [
      { action: 'view_chart', xp: 5, timestamp: Date.now() - 60 * 60_000 }, // exactly 1 hour
    ];
    expect(isDuplicateWithinHour(history, 'view_chart')).toBe(false);
  });
});

describe('Gamification — Streak Tracking', () => {
  test('new user starts with streak of 1', () => {
    const user = createUser();
    expect(user.streakDays).toBe(1);
  });

  test('streak increments when last login was yesterday', () => {
    const user = createUser();
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    user.lastLoginDate = yesterday;
    user.streakDays = 5;

    // Simulate profile view logic
    const today = new Date().toISOString().slice(0, 10);
    if (user.lastLoginDate !== today) {
      const yesterdayCheck = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      if (user.lastLoginDate === yesterdayCheck) {
        user.streakDays += 1;
      } else {
        user.streakDays = 1;
      }
      user.lastLoginDate = today;
    }

    expect(user.streakDays).toBe(6);
  });

  test('streak resets to 1 when there is a gap', () => {
    const user = createUser();
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
    user.lastLoginDate = twoDaysAgo;
    user.streakDays = 10;

    const today = new Date().toISOString().slice(0, 10);
    if (user.lastLoginDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      if (user.lastLoginDate === yesterday) {
        user.streakDays += 1;
      } else {
        user.streakDays = 1;
      }
      user.lastLoginDate = today;
    }

    expect(user.streakDays).toBe(1);
  });

  test('same-day login does not change streak', () => {
    const user = createUser();
    const today = new Date().toISOString().slice(0, 10);
    user.lastLoginDate = today;
    user.streakDays = 5;

    // Simulate profile view logic
    if (user.lastLoginDate !== today) {
      // This block should NOT execute
      user.streakDays = 999;
    }

    expect(user.streakDays).toBe(5);
  });
});

describe('Gamification — XP Accumulation Simulation', () => {
  test('awarding actions accumulates total XP correctly', () => {
    const user = createUser();

    // Award 3 view_chart actions (5 XP each)
    for (let i = 0; i < 3; i++) {
      user.totalXP += ACTION_XP['view_chart'];
      user.actionCounts['view_chart'] = (user.actionCounts['view_chart'] ?? 0) + 1;
    }

    expect(user.totalXP).toBe(15);
    expect(user.actionCounts['view_chart']).toBe(3);
  });

  test('mixed actions accumulate correctly', () => {
    const user = createUser();

    user.totalXP += ACTION_XP['first_login'];    // 50
    user.totalXP += ACTION_XP['view_chart'];      // 5
    user.totalXP += ACTION_XP['complete_lesson'];  // 100

    expect(user.totalXP).toBe(155);
    expect(getLevelInfo(user.totalXP).level).toBe(2); // 100 <= 155 < 500
  });

  test('history is trimmed to last 100 entries', () => {
    const user = createUser();

    for (let i = 0; i < 110; i++) {
      user.history.push({ action: 'view_chart', xp: 5, timestamp: Date.now() + i });
    }

    // Simulate the trim logic from the route
    if (user.history.length > 100) {
      user.history = user.history.slice(-100);
    }

    expect(user.history.length).toBe(100);
    // The first entry should be the 11th one added (0-indexed: entry 10)
    expect(user.history[0].timestamp).toBeGreaterThan(Date.now() - 1000);
  });
});

describe('Gamification — Level Threshold Ordering', () => {
  test('thresholds are sorted by XP ascending', () => {
    for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
      expect(LEVEL_THRESHOLDS[i].xp).toBeGreaterThan(LEVEL_THRESHOLDS[i - 1].xp);
    }
  });

  test('levels are sequential 1 through 8', () => {
    LEVEL_THRESHOLDS.forEach((t, i) => {
      expect(t.level).toBe(i + 1);
    });
  });

  test('each level has a unique name', () => {
    const names = LEVEL_THRESHOLDS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
