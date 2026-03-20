import { Router, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import logger from '../config/logger.js';

const router = Router();

// --- In-memory XP storage ---
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

const userXPStore = new Map<string, UserGamification>();

// --- Level thresholds ---
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

// --- XP per action ---
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

// --- Achievement definitions ---
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

// --- Helpers ---
function getOrCreateUser(userId: string): UserGamification {
  let data = userXPStore.get(userId);
  if (!data) {
    data = {
      totalXP: 0,
      history: [],
      streakDays: 1,
      lastLoginDate: new Date().toISOString().slice(0, 10),
      actionCounts: {},
    };
    userXPStore.set(userId, data);
  }
  return data;
}

function getLevelInfo(xp: number) {
  let current = LEVEL_THRESHOLDS[0];
  let next = LEVEL_THRESHOLDS[1];
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

// GET /profile — Returns user's XP, level, achievements
router.get('/profile', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const data = getOrCreateUser(userId);
    const levelInfo = getLevelInfo(data.totalXP);

    // Update streak on profile view
    const today = new Date().toISOString().slice(0, 10);
    if (data.lastLoginDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      if (data.lastLoginDate === yesterday) {
        data.streakDays += 1;
      } else {
        data.streakDays = 1;
      }
      data.lastLoginDate = today;
    }

    const earnedAchievements = ACHIEVEMENTS.filter((a) => a.condition(data)).map(
      (a) => a.id
    );

    res.json({
      success: true,
      data: {
        ...levelInfo,
        totalXP: data.totalXP,
        streakDays: data.streakDays,
        achievementsEarned: earnedAchievements.length,
        recentActivity: data.history.slice(-20).reverse(),
      },
    });
  } catch (err) {
    logger.error('Gamification profile error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /award — Award XP for an action
router.post('/award', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { action } = req.body;

    if (!action || !ACTION_XP[action]) {
      res.status(400).json({
        success: false,
        error: 'Invalid action',
        validActions: Object.keys(ACTION_XP),
      });
      return;
    }

    const data = getOrCreateUser(userId);

    // Prevent duplicate awards within same hour for same action
    if (isDuplicateWithinHour(data.history, action)) {
      res.json({
        success: true,
        data: {
          awarded: false,
          reason: 'duplicate_within_hour',
          totalXP: data.totalXP,
        },
      });
      return;
    }

    const xp = ACTION_XP[action];
    data.totalXP += xp;
    data.actionCounts[action] = (data.actionCounts[action] ?? 0) + 1;
    data.history.push({
      action,
      xp,
      timestamp: Date.now(),
    });

    // Keep history trimmed to last 100
    if (data.history.length > 100) {
      data.history = data.history.slice(-100);
    }

    // Check if any new achievements were earned and award bonus XP
    const newAchievements: string[] = [];
    for (const achievement of ACHIEVEMENTS) {
      if (achievement.condition(data)) {
        const alreadyEarned = data.history.some(
          (e) => e.action === `achievement:${achievement.id}`
        );
        if (!alreadyEarned) {
          data.totalXP += achievement.xpReward;
          data.history.push({
            action: `achievement:${achievement.id}`,
            xp: achievement.xpReward,
            timestamp: Date.now(),
          });
          newAchievements.push(achievement.id);
        }
      }
    }

    const levelInfo = getLevelInfo(data.totalXP);

    res.json({
      success: true,
      data: {
        awarded: true,
        action,
        xp,
        totalXP: data.totalXP,
        level: levelInfo,
        newAchievements,
      },
    });
  } catch (err) {
    logger.error('Gamification award error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /achievements — List all achievements with earned status
router.get('/achievements', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const data = getOrCreateUser(userId);

    const achievements = ACHIEVEMENTS.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      xpReward: a.xpReward,
      earned: a.condition(data),
    }));

    res.json({ success: true, data: achievements });
  } catch (err) {
    logger.error('Gamification achievements error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
