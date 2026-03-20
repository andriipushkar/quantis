import React, { useState, useEffect } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Newspaper,
  Anchor,
  Zap,
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
} from 'lucide-react';
import { cn } from '@/utils/cn';

function useSignalCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchCount = async () => {
      try {
        const res = await fetch('/api/v1/analysis/signals');
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setCount(Array.isArray(data) ? data.length : (data.count ?? 0));
          }
        }
      } catch {
        // silently ignore
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return count;
}

interface NavItem {
  icon: React.ElementType;
  labelKey: string;
  path: string;
  badge?: boolean;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, labelKey: 'nav.dashboard', path: '/dashboard' },
  { icon: LineChart, labelKey: 'nav.chart', path: '/chart' },
  { icon: LayoutGrid, labelKey: 'nav.multiChart', path: '/multi-chart' },
  { icon: Search, labelKey: 'nav.screener', path: '/screener' },
  { icon: Shield, labelKey: 'nav.tokenScanner', path: '/token-scanner' },
  { icon: Grid3X3, labelKey: 'nav.heatmap', path: '/heatmap' },
  { icon: GitCompare, labelKey: 'nav.correlation', path: '/correlation' },
  { icon: Calendar, labelKey: 'nav.seasonality', path: '/seasonality' },
  { icon: Server, labelKey: 'nav.exchangeHealth', path: '/exchange-health' },
  { icon: Percent, labelKey: 'nav.fundingRates', path: '/funding-rates' },
  { icon: Layers, labelKey: 'nav.narratives', path: '/narratives' },
  { icon: Activity, labelKey: 'nav.marketBreadth', path: '/market-breadth' },
  { icon: BarChart3, labelKey: 'nav.openInterest', path: '/open-interest' },
  { icon: Bot, labelKey: 'nav.copilot', path: '/copilot' },
  { icon: Signal, labelKey: 'nav.signals', path: '/signals', badge: true },
  { icon: CircleDollarSign, labelKey: 'nav.paperTrading', path: '/paper-trading' },
  { icon: Repeat, labelKey: 'nav.dcaBot', path: '/dca' },
  { icon: Newspaper, labelKey: 'nav.news', path: '/news' },
  { icon: Anchor, labelKey: 'nav.whaleAlert', path: '/whale-alert' },
  { icon: GraduationCap, labelKey: 'nav.academy', path: '/academy' },
  { icon: Trophy, labelKey: 'nav.leaderboard', path: '/leaderboard' },
  { icon: Bell, labelKey: 'nav.alerts', path: '/alerts' },
  { icon: BookOpen, labelKey: 'nav.journal', path: '/journal' },
  { icon: Wallet, labelKey: 'nav.portfolio', path: '/portfolio' },
  { icon: Users, labelKey: 'nav.copyTrading', path: '/copy-trading' },
  { icon: MessageSquare, labelKey: 'nav.social', path: '/social' },
  { icon: Crosshair, labelKey: 'nav.confluence', path: '/confluence' },
  { icon: Flame, labelKey: 'nav.liquidations', path: '/liquidations' },
  { icon: Eye, labelKey: 'nav.patternScanner', path: '/pattern-scanner' },
  { icon: User, labelKey: 'nav.profile', path: '/profile' },
  { icon: Rewind, labelKey: 'nav.chartReplay', path: '/chart-replay' },
  { icon: SettingsIcon, labelKey: 'nav.settings', path: '/settings' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const { t } = useTranslation();
  const signalCount = useSignalCount();

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col h-screen bg-background border-r border-border transition-all duration-300 fixed left-0 top-0 z-40',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-14 px-4 border-b border-border">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gold-gradient flex items-center justify-center flex-shrink-0">
            <span className="text-black font-bold text-sm">Q</span>
          </div>
          {!collapsed && (
            <span className="text-primary font-bold text-lg tracking-wide truncate">
              Quantis
            </span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                collapsed && 'justify-center px-0',
                isActive
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )
            }
          >
            <span className="relative flex-shrink-0">
              <item.icon className="w-5 h-5" />
              {item.badge && signalCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none px-1">
                  {signalCount > 99 ? '99+' : signalCount}
                </span>
              )}
            </span>
            {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Upgrade button */}
      <Link
        to="/pricing"
        className={cn(
          'flex items-center gap-2 mx-2 mb-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 hover:bg-primary/10',
          collapsed && 'justify-center px-0'
        )}
      >
        <Zap className="w-4 h-4 flex-shrink-0 text-primary" style={{ filter: 'drop-shadow(0 0 3px hsl(var(--primary) / 0.5))' }} />
        {!collapsed && (
          <span className="bg-gold-gradient bg-clip-text text-transparent">
            Upgrade
          </span>
        )}
      </Link>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="flex items-center justify-center h-12 border-t border-border text-muted-foreground hover:text-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
};
