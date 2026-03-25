/**
 * Sidebar navigation configuration — 8 collapsible groups.
 *
 * Each group contains nav items with optional tier gating.
 * "Core" is always expanded by default; the group containing
 * the current route auto-expands as well.
 */

import {
  LayoutDashboard,
  LineChart,
  Search,
  Grid3X3,
  Bot,
  Signal,
  CircleDollarSign,
  Bell,
  Wallet,
  Settings as SettingsIcon,
  GraduationCap,
  Newspaper,
  Anchor,
  GitCompare,
  Trophy,
  BookOpen,
  LayoutGrid,
  Shield,
  Repeat,
  Calendar,
  Server,
  Percent,
  Layers,
  Activity,
  BarChart3,
  User,
  Users,
  Rewind,
  MessageSquare,
  Crosshair,
  Flame,
  Eye,
  Store,
  Wallet2,
  FileText,
  BarChart2,
  BarChart4,
  BookMarked,
  Code,
  Megaphone,
  PieChart,
  Coins,
  Globe2,
  Network,
  Box,
  CircleDollarSign as BitcoinIcon,
  Gauge,
  ArrowLeftRight,
  FlaskConical,
  Grid2X2,
  ShieldAlert,
} from 'lucide-react';
import type { ElementType } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TierRequirement = 'free' | 'starter' | 'pro' | 'institutional';

export interface NavItem {
  icon: ElementType;
  labelKey: string;
  path: string;
  badge?: boolean;
  /** Minimum tier required — items above user tier show a lock icon */
  tier?: TierRequirement;
}

export interface NavGroup {
  id: string;
  /** i18n key for the group heading */
  labelKey: string;
  items: NavItem[];
  /** If true, always expanded by default (used for "Core") */
  defaultOpen?: boolean;
}

// ---------------------------------------------------------------------------
// Tier hierarchy (for lock icon logic)
// ---------------------------------------------------------------------------

const TIER_ORDER: Record<TierRequirement, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  institutional: 3,
};

export function isItemLocked(itemTier: TierRequirement | undefined, userTier: string): boolean {
  if (!itemTier || itemTier === 'free') return false;
  const userLevel = TIER_ORDER[userTier as TierRequirement] ?? 0;
  return TIER_ORDER[itemTier] > userLevel;
}

// ---------------------------------------------------------------------------
// Navigation groups
// ---------------------------------------------------------------------------

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'core',
    labelKey: 'navGroup.core',
    defaultOpen: true,
    items: [
      { icon: LayoutDashboard, labelKey: 'nav.dashboard', path: '/dashboard' },
      { icon: LineChart, labelKey: 'nav.chart', path: '/chart' },
      { icon: LayoutGrid, labelKey: 'nav.multiChart', path: '/multi-chart' },
      { icon: Search, labelKey: 'nav.screener', path: '/screener' },
    ],
  },
  {
    id: 'analysis',
    labelKey: 'navGroup.analysis',
    items: [
      { icon: Signal, labelKey: 'nav.signals', path: '/signals', badge: true },
      { icon: Grid3X3, labelKey: 'nav.heatmap', path: '/heatmap' },
      { icon: GitCompare, labelKey: 'nav.correlation', path: '/correlation' },
      { icon: Gauge, labelKey: 'nav.regime', path: '/regime' },
      { icon: Calendar, labelKey: 'nav.seasonality', path: '/seasonality' },
      { icon: Activity, labelKey: 'nav.marketBreadth', path: '/market-breadth' },
      { icon: Crosshair, labelKey: 'nav.confluence', path: '/confluence', tier: 'pro' },
      { icon: Eye, labelKey: 'nav.advancedPatterns', path: '/advanced-patterns', tier: 'pro' },
      { icon: BarChart4, labelKey: 'nav.advancedCharts', path: '/advanced-charts', tier: 'institutional' },
      { icon: Globe2, labelKey: 'nav.intermarket', path: '/intermarket', tier: 'pro' },
    ],
  },
  {
    id: 'data',
    labelKey: 'navGroup.data',
    items: [
      { icon: Shield, labelKey: 'nav.tokenScanner', path: '/token-scanner' },
      { icon: BarChart3, labelKey: 'nav.openInterest', path: '/open-interest' },
      { icon: Percent, labelKey: 'nav.fundingRates', path: '/funding-rates' },
      { icon: Anchor, labelKey: 'nav.whaleAlert', path: '/whale-alert' },
      { icon: Flame, labelKey: 'nav.liquidations', path: '/liquidations' },
      { icon: Server, labelKey: 'nav.exchangeHealth', path: '/exchange-health' },
      { icon: Coins, labelKey: 'nav.defi', path: '/defi' },
      { icon: Network, labelKey: 'nav.onChain', path: '/on-chain', tier: 'pro' },
      { icon: PieChart, labelKey: 'nav.tokenomics', path: '/tokenomics', tier: 'pro' },
      { icon: BitcoinIcon, labelKey: 'nav.btcModels', path: '/btc-models' },
    ],
  },
  {
    id: 'trading',
    labelKey: 'navGroup.trading',
    items: [
      { icon: CircleDollarSign, labelKey: 'nav.paperTrading', path: '/paper-trading' },
      { icon: Repeat, labelKey: 'nav.dcaBot', path: '/dca', tier: 'pro' },
      { icon: Grid2X2, labelKey: 'nav.gridBot', path: '/grid-bot', tier: 'pro' },
      { icon: Users, labelKey: 'nav.copyTrading', path: '/copy-trading', tier: 'pro' },
      { icon: ArrowLeftRight, labelKey: 'nav.arbitrage', path: '/arbitrage', tier: 'pro' },
      { icon: ShieldAlert, labelKey: 'nav.antiLiquidation', path: '/anti-liquidation' },
      { icon: Rewind, labelKey: 'nav.chartReplay', path: '/chart-replay' },
    ],
  },
  {
    id: 'ai-tools',
    labelKey: 'navGroup.aiTools',
    items: [
      { icon: Bot, labelKey: 'nav.copilot', path: '/copilot' },
      { icon: FlaskConical, labelKey: 'nav.backtester', path: '/backtester', tier: 'pro' },
      { icon: Code, labelKey: 'nav.scriptEditor', path: '/script-editor', tier: 'pro' },
      { icon: BookMarked, labelKey: 'nav.indicatorLibrary', path: '/indicators' },
      { icon: BarChart2, labelKey: 'nav.options', path: '/options', tier: 'pro' },
    ],
  },
  {
    id: 'account',
    labelKey: 'navGroup.account',
    items: [
      { icon: Wallet, labelKey: 'nav.portfolio', path: '/portfolio' },
      { icon: BookOpen, labelKey: 'nav.journal', path: '/journal' },
      { icon: Bell, labelKey: 'nav.alerts', path: '/alerts' },
      { icon: FileText, labelKey: 'nav.taxReport', path: '/tax-report', tier: 'pro' },
      { icon: Wallet2, labelKey: 'nav.walletTracker', path: '/wallet-tracker', tier: 'pro' },
      { icon: User, labelKey: 'nav.profile', path: '/profile' },
      { icon: SettingsIcon, labelKey: 'nav.settings', path: '/settings' },
    ],
  },
  {
    id: 'community',
    labelKey: 'navGroup.community',
    items: [
      { icon: MessageSquare, labelKey: 'nav.social', path: '/social' },
      { icon: Trophy, labelKey: 'nav.leaderboard', path: '/leaderboard' },
      { icon: Store, labelKey: 'nav.marketplace', path: '/marketplace' },
      { icon: Newspaper, labelKey: 'nav.news', path: '/news' },
      { icon: Megaphone, labelKey: 'nav.socialIntelligence', path: '/social-intelligence' },
    ],
  },
  {
    id: 'learn',
    labelKey: 'navGroup.learn',
    items: [
      { icon: GraduationCap, labelKey: 'nav.academy', path: '/academy' },
    ],
  },
];

// Flat list of all items (used by GlobalSearch, etc.)
export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

// Legacy items removed — narratives & devActivity are now merged into
// SocialIntelligence (/social-intelligence) and OnChain (/on-chain)

// ---------------------------------------------------------------------------
// Favorites persistence
// ---------------------------------------------------------------------------

const FAVORITES_KEY = 'quantis-nav-favorites';
const MAX_FAVORITES = 7;

export function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveFavorites(paths: string[]): void {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(paths.slice(0, MAX_FAVORITES)));
}

export function toggleFavorite(path: string, current: string[]): string[] {
  if (current.includes(path)) {
    return current.filter((p) => p !== path);
  }
  if (current.length >= MAX_FAVORITES) return current;
  return [...current, path];
}

// ---------------------------------------------------------------------------
// Helper: find which group contains a given path
// ---------------------------------------------------------------------------

export function findGroupByPath(path: string): string | null {
  for (const group of NAV_GROUPS) {
    if (group.items.some((item) => path.startsWith(item.path))) {
      return group.id;
    }
  }
  return null;
}
