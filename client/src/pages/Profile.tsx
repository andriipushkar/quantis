import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  User,
  Star,
  Trophy,
  Flame,
  Lock,
  Zap,
  BookOpen,
  LineChart,
  Bell,
  CircleDollarSign,
  GraduationCap,
  Bot,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { useAuthStore } from '@/stores/auth';
import { cn } from '@/utils/cn';

interface LevelInfo {
  level: number;
  name: string;
  currentXP: number;
  nextLevelXP: number | null;
  progress: number;
}

interface ProfileData {
  totalXP: number;
  streakDays: number;
  achievementsEarned: number;
  level: number;
  name: string;
  currentXP: number;
  nextLevelXP: number | null;
  progress: number;
  recentActivity: Array<{ action: string; xp: number; timestamp: number }>;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  xpReward: number;
  earned: boolean;
}

const ACHIEVEMENT_ICONS: Record<string, React.ElementType> = {
  first_steps: Star,
  chart_master: LineChart,
  alert_pro: Bell,
  paper_hero: CircleDollarSign,
  knowledge_seeker: GraduationCap,
  ai_explorer: Bot,
  week_warrior: Calendar,
};

const LEVEL_BADGES: Record<string, string> = {
  Newbie: 'bg-muted text-muted-foreground',
  Student: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  Apprentice: 'bg-green-500/15 text-green-400 border-green-500/25',
  Trader: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
  Analyst: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  Strategist: 'bg-red-500/15 text-red-400 border-red-500/25',
  Expert: 'bg-primary/15 text-primary border-primary/25',
  Legend: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
};

function formatAction(action: string): string {
  if (action.startsWith('achievement:')) {
    return `Achievement: ${action.replace('achievement:', '').replace(/_/g, ' ')}`;
  }
  return action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const Profile: React.FC = () => {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('quantis_token');
      const headers = { Authorization: `Bearer ${token}` };

      const [profileRes, achievementsRes] = await Promise.all([
        fetch('/api/v1/gamification/profile', { headers }),
        fetch('/api/v1/gamification/achievements', { headers }),
      ]);

      if (profileRes.ok) {
        const pData = await profileRes.json();
        setProfile(pData.data);
      }
      if (achievementsRes.ok) {
        const aData = await achievementsRes.json();
        setAchievements(aData.data);
      }
    } catch {
      // silently ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gold-gradient flex items-center justify-center animate-pulse">
            <span className="text-black font-bold text-lg">Q</span>
          </div>
          <span className="text-muted-foreground text-sm">{t('common.loading')}</span>
        </div>
      </div>
    );
  }

  const levelName = profile?.name ?? 'Newbie';
  const levelProgress = profile?.progress ?? 0;
  const totalXP = profile?.totalXP ?? 0;
  const currentLevel = profile?.level ?? 1;
  const streakDays = profile?.streakDays ?? 0;
  const earnedCount = profile?.achievementsEarned ?? 0;
  const recentActivity = profile?.recentActivity ?? [];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center">
          <User className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {user?.email?.split('@')[0] || t('profile.title')}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge
              className={cn(
                'text-xs border',
                LEVEL_BADGES[levelName] || LEVEL_BADGES['Newbie']
              )}
            >
              Lv.{currentLevel} {levelName}
            </Badge>
            {streakDays > 0 && (
              <Badge variant="warning" className="text-xs">
                <Flame className="w-3 h-3 mr-1" />
                {streakDays} {t('profile.dayStreak')}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* XP Progress Bar */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">
              {t('profile.xpProgress')}
            </span>
            <span className="text-sm text-muted-foreground">
              {totalXP.toLocaleString()} XP
              {profile?.nextLevelXP && (
                <span> / {profile.nextLevelXP.toLocaleString()} XP</span>
              )}
            </span>
          </div>
          <div className="w-full h-3 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-gold-gradient rounded-full transition-all duration-500"
              style={{ width: `${Math.min(levelProgress * 100, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>Lv.{currentLevel} {levelName}</span>
            {profile?.nextLevelXP && (
              <span>
                {(profile.nextLevelXP - totalXP).toLocaleString()} XP {t('profile.toNextLevel')}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Zap className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">{totalXP.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{t('profile.totalXP')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Star className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">{currentLevel}</p>
            <p className="text-xs text-muted-foreground">{t('profile.currentLevel')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Trophy className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">{earnedCount}</p>
            <p className="text-xs text-muted-foreground">{t('profile.achievementsEarned')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Flame className="w-6 h-6 text-warning mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">{streakDays}</p>
            <p className="text-xs text-muted-foreground">{t('profile.streakDays')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Achievements Grid */}
      <Card>
        <CardHeader>
          <CardTitle>{t('profile.achievements')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {achievements.map((achievement) => {
              const Icon = ACHIEVEMENT_ICONS[achievement.id] || Trophy;
              return (
                <div
                  key={achievement.id}
                  className={cn(
                    'flex items-start gap-3 p-4 rounded-xl border transition-all duration-200',
                    achievement.earned
                      ? 'bg-primary/5 border-primary/20'
                      : 'bg-muted/30 border-border opacity-60'
                  )}
                >
                  <div
                    className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                      achievement.earned
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {achievement.earned ? (
                      <Icon className="w-5 h-5" />
                    ) : (
                      <Lock className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-foreground">{achievement.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {achievement.description}
                    </p>
                    <p className="text-xs text-primary mt-1">+{achievement.xpReward} XP</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>{t('profile.recentActivity')}</CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('profile.noActivity')}
            </p>
          ) : (
            <div className="space-y-2">
              {recentActivity.map((entry, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-sm text-foreground">
                      {formatAction(entry.action)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="success" className="text-xs">
                      +{entry.xp} XP
                    </Badge>
                    <span className="text-xs text-muted-foreground min-w-[60px] text-right">
                      {formatTimeAgo(entry.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;
