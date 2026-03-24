import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  LineChart,
  Search,
  Bot,
  Signal,
  Menu,
  X,
  Bell,
  Briefcase,
  Settings,
  BookOpen,
  Newspaper,
  Trophy,
  Wallet,
  FileText,
  Users,
  TrendingUp,
  BarChart3,
  Layers,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

const mobileNavItems = [
  { icon: LayoutDashboard, labelKey: 'nav.dashboard', path: '/dashboard' },
  { icon: LineChart, labelKey: 'nav.chart', path: '/chart' },
  { icon: Search, labelKey: 'nav.screener', path: '/screener' },
  { icon: Bot, labelKey: 'nav.copilot', path: '/copilot' },
  { icon: Signal, labelKey: 'nav.signals', path: '/signals' },
];

const moreMenuSections = [
  {
    title: 'Trading',
    items: [
      { icon: Bell, labelKey: 'nav.alerts', path: '/alerts' },
      { icon: Briefcase, labelKey: 'nav.portfolio', path: '/portfolio' },
      { icon: TrendingUp, labelKey: 'nav.paperTrading', path: '/paper-trading' },
      { icon: FileText, labelKey: 'nav.journal', path: '/journal' },
      { icon: Users, labelKey: 'nav.copyTrading', path: '/copy-trading' },
    ],
  },
  {
    title: 'Analysis',
    items: [
      { icon: BarChart3, labelKey: 'nav.multiChart', path: '/multi-chart' },
      { icon: Layers, labelKey: 'nav.confluence', path: '/confluence' },
      { icon: TrendingUp, labelKey: 'nav.marketBreadth', path: '/market-breadth' },
      { icon: BarChart3, labelKey: 'nav.openInterest', path: '/open-interest' },
      { icon: LineChart, labelKey: 'nav.fundingRates', path: '/funding-rates' },
      { icon: Search, labelKey: 'nav.tokenScanner', path: '/token-scanner' },
    ],
  },
  {
    title: 'Social',
    items: [
      { icon: Users, labelKey: 'nav.social', path: '/social' },
      { icon: Trophy, labelKey: 'nav.leaderboard', path: '/leaderboard' },
      { icon: Newspaper, labelKey: 'nav.news', path: '/news' },
      { icon: Wallet, labelKey: 'nav.whaleAlert', path: '/whale-alert' },
    ],
  },
  {
    title: 'More',
    items: [
      { icon: BookOpen, labelKey: 'nav.academy', path: '/academy' },
      { icon: Settings, labelKey: 'nav.settings', path: '/settings' },
      { icon: Users, labelKey: 'nav.profile', path: '/profile' },
    ],
  },
];

export const Layout: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main content area */}
      <div
        className={cn(
          'transition-all duration-300',
          'md:ml-16',
          !sidebarCollapsed && 'md:ml-64'
        )}
      >
        <Header />
        <main className="p-4 md:p-6 pb-20 md:pb-6 min-h-[calc(100vh-3.5rem)] overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-background border-t border-border flex items-center justify-around z-50">
        {mobileNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{t(item.labelKey)}</span>
          </NavLink>
        ))}
        {/* More button */}
        <button
          onClick={() => setMoreOpen(!moreOpen)}
          className={cn(
            'flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-colors',
            moreOpen ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-medium">{t('common.next', 'More')}</span>
        </button>
      </nav>

      {/* Mobile "More" fullscreen menu */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-[60] bg-background overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-background border-b border-border flex items-center justify-between px-4 h-14">
            <span className="text-foreground font-semibold">{t('common.next', 'More')}</span>
            <button
              onClick={() => setMoreOpen(false)}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Menu sections */}
          <div className="p-4 space-y-6 pb-20">
            {moreMenuSections.map((section) => (
              <div key={section.title}>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">
                  {section.title}
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {section.items.map((item) => (
                    <button
                      key={item.path}
                      onClick={() => { navigate(item.path); setMoreOpen(false); }}
                      className="flex flex-col items-center gap-2 p-3 rounded-xl bg-card border border-border hover:border-primary/50 hover:bg-secondary transition-all"
                    >
                      <item.icon className="w-5 h-5 text-primary" />
                      <span className="text-[11px] font-medium text-foreground text-center leading-tight">
                        {t(item.labelKey)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
