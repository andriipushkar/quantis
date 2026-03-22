import { Router, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';
import logger from '../config/logger.js';

const router = Router();

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
    conditionKey: 'complete_onboarding',
    conditionCount: 1,
    conditionType: 'action' as const,
  },
  {
    id: 'chart_master',
    name: 'Chart Master',
    description: 'View 10 charts',
    xpReward: 200,
    conditionKey: 'view_chart',
    conditionCount: 10,
    conditionType: 'action' as const,
  },
  {
    id: 'alert_pro',
    name: 'Alert Pro',
    description: 'Create 5 alerts',
    xpReward: 200,
    conditionKey: 'set_alert',
    conditionCount: 5,
    conditionType: 'action' as const,
  },
  {
    id: 'paper_hero',
    name: 'Paper Hero',
    description: 'Complete 10 paper trades',
    xpReward: 300,
    conditionKey: 'paper_trade',
    conditionCount: 10,
    conditionType: 'action' as const,
  },
  {
    id: 'knowledge_seeker',
    name: 'Knowledge Seeker',
    description: 'Complete 5 academy lessons',
    xpReward: 150,
    conditionKey: 'complete_lesson',
    conditionCount: 5,
    conditionType: 'action' as const,
  },
  {
    id: 'ai_explorer',
    name: 'AI Explorer',
    description: 'Ask 10 copilot questions',
    xpReward: 150,
    conditionKey: 'ask_copilot',
    conditionCount: 10,
    conditionType: 'action' as const,
  },
  {
    id: 'week_warrior',
    name: 'Week Warrior',
    description: '7-day login streak',
    xpReward: 100,
    conditionKey: 'streak',
    conditionCount: 7,
    conditionType: 'streak' as const,
  },
];

// --- Helpers ---
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

async function getOrCreateUser(userId: string) {
  const result = await query(
    `INSERT INTO user_gamification (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET user_id = $1
     RETURNING *`,
    [userId]
  );
  return result.rows[0];
}

function checkAchievement(
  achievement: (typeof ACHIEVEMENTS)[0],
  actionCounts: Record<string, number>,
  streakDays: number
): boolean {
  if (achievement.conditionType === 'streak') {
    return streakDays >= achievement.conditionCount;
  }
  return (actionCounts[achievement.conditionKey] ?? 0) >= achievement.conditionCount;
}

// GET /profile — Returns user's XP, level, achievements
router.get('/profile', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const userData = await getOrCreateUser(userId);
    const actionCounts = userData.action_counts || {};
    let totalXP = userData.total_xp;
    let streakDays = userData.streak_days;

    // Update streak on profile view
    const today = new Date().toISOString().slice(0, 10);
    const lastLogin = userData.last_login_date instanceof Date
      ? userData.last_login_date.toISOString().slice(0, 10)
      : String(userData.last_login_date);

    if (lastLogin !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      if (lastLogin === yesterday) {
        streakDays += 1;
      } else {
        streakDays = 1;
      }
      await query(
        `UPDATE user_gamification SET streak_days = $1, last_login_date = $2 WHERE user_id = $3`,
        [streakDays, today, userId]
      );
    }

    const levelInfo = getLevelInfo(totalXP);

    const earnedAchievements = ACHIEVEMENTS.filter((a) =>
      checkAchievement(a, actionCounts, streakDays)
    ).map((a) => a.id);

    // Recent activity from gamification_history
    const historyResult = await query(
      `SELECT action, xp, created_at AS timestamp FROM gamification_history
       WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [userId]
    );
    const recentActivity = historyResult.rows.map((r: Record<string, unknown>) => ({
      action: r.action as string,
      xp: r.xp as number,
      timestamp: new Date(r.timestamp as string).getTime(),
    }));

    res.json({
      success: true,
      data: {
        ...levelInfo,
        totalXP,
        streakDays,
        achievementsEarned: earnedAchievements.length,
        recentActivity,
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

    const userData = await getOrCreateUser(userId);
    const actionCounts = userData.action_counts || {};

    // Prevent duplicate awards within same hour for same action
    const dupeCheck = await query(
      `SELECT 1 FROM gamification_history
       WHERE user_id = $1 AND action = $2 AND created_at > NOW() - INTERVAL '1 hour'
       LIMIT 1`,
      [userId, action]
    );

    if (dupeCheck.rows.length > 0) {
      res.json({
        success: true,
        data: {
          awarded: false,
          reason: 'duplicate_within_hour',
          totalXP: userData.total_xp,
        },
      });
      return;
    }

    const xp = ACTION_XP[action];
    const newActionCounts = { ...actionCounts, [action]: (actionCounts[action] ?? 0) + 1 };
    let newTotalXP = userData.total_xp + xp;

    // Record in history
    await query(
      `INSERT INTO gamification_history (user_id, action, xp) VALUES ($1, $2, $3)`,
      [userId, action, xp]
    );

    // Check if any new achievements were earned and award bonus XP
    const newAchievements: string[] = [];
    for (const achievement of ACHIEVEMENTS) {
      if (checkAchievement(achievement, newActionCounts, userData.streak_days)) {
        // Check if already earned
        const alreadyEarned = await query(
          `SELECT 1 FROM gamification_history
           WHERE user_id = $1 AND action = $2 LIMIT 1`,
          [userId, `achievement:${achievement.id}`]
        );
        if (alreadyEarned.rows.length === 0) {
          newTotalXP += achievement.xpReward;
          await query(
            `INSERT INTO gamification_history (user_id, action, xp) VALUES ($1, $2, $3)`,
            [userId, `achievement:${achievement.id}`, achievement.xpReward]
          );
          newAchievements.push(achievement.id);
        }
      }
    }

    // Update user gamification
    await query(
      `UPDATE user_gamification SET total_xp = $1, action_counts = $2 WHERE user_id = $3`,
      [newTotalXP, JSON.stringify(newActionCounts), userId]
    );

    const levelInfo = getLevelInfo(newTotalXP);

    res.json({
      success: true,
      data: {
        awarded: true,
        action,
        xp,
        totalXP: newTotalXP,
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
    const userData = await getOrCreateUser(userId);
    const actionCounts = userData.action_counts || {};

    const achievements = ACHIEVEMENTS.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      xpReward: a.xpReward,
      earned: checkAchievement(a, actionCounts, userData.streak_days),
    }));

    res.json({ success: true, data: achievements });
  } catch (err) {
    logger.error('Gamification achievements error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
