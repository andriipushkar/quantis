import React, { useState, useCallback, useMemo } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  LineChart,
  Search,
  Bot,
  Signal,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Lock,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import {
  NAV_GROUPS,
  findGroupByPath,
  isItemLocked,
  type NavGroup,
} from '@/config/navigation';
import { useAuthStore } from '@/stores/auth';

// ---------------------------------------------------------------------------
// Mobile bottom tab items (always visible)
// ---------------------------------------------------------------------------

const mobileNavItems = [
  { icon: LayoutDashboard, labelKey: 'nav.dashboard', path: '/dashboard' },
  { icon: LineChart, labelKey: 'nav.chart', path: '/chart' },
  { icon: Search, labelKey: 'nav.screener', path: '/screener' },
  { icon: Bot, labelKey: 'nav.copilot', path: '/copilot' },
  { icon: Signal, labelKey: 'nav.signals', path: '/signals' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const Layout: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const userTier = user?.tier ?? 'free';

  // Mobile expanded groups — auto-expand group with active route
  const activeGroupId = useMemo(
    () => findGroupByPath(location.pathname),
    [location.pathname]
  );

  const [mobileExpandedGroups, setMobileExpandedGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>(['core']);
    if (activeGroupId) initial.add(activeGroupId);
    return initial;
  });

  const toggleMobileGroup = useCallback((groupId: string) => {
    setMobileExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const renderMobileGroup = (group: NavGroup) => {
    const isExpanded = mobileExpandedGroups.has(group.id);
    const itemCount = group.items.length;

    return (
      <div key={group.id} data-testid={`mobile-nav-group-${group.id}`}>
        {/* Group header */}
        <button
          onClick={() => toggleMobileGroup(group.id)}
          className="flex items-center justify-between w-full px-4 py-3 text-sm font-semibold text-foreground"
          data-testid={`mobile-group-toggle-${group.id}`}
        >
          <span>{t(group.labelKey)}</span>
          <span className="flex items-center gap-2">
            {!isExpanded && (
              <span className="text-xs font-normal text-muted-foreground">
                {itemCount}
              </span>
            )}
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </span>
        </button>

        {/* Items grid */}
        {isExpanded && (
          <div className="grid grid-cols-3 gap-2 px-4 pb-4">
            {group.items.map((item) => {
              const locked = isItemLocked(item.tier, userTier);
              const isActive = location.pathname.startsWith(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    if (!locked) {
                      navigate(item.path);
                      setMoreOpen(false);
                    }
                  }}
                  className={cn(
                    'relative flex flex-col items-center gap-2 p-3 rounded-xl border transition-all',
                    locked
                      ? 'opacity-50 cursor-not-allowed bg-card border-border'
                      : isActive
                        ? 'bg-primary/10 border-primary/50'
                        : 'bg-card border-border hover:border-primary/50 hover:bg-secondary'
                  )}
                >
                  <item.icon className={cn('w-5 h-5', isActive ? 'text-primary' : 'text-primary')} />
                  <span className="text-[11px] font-medium text-foreground text-center leading-tight">
                    {t(item.labelKey)}
                  </span>
                  {locked && (
                    <Lock className="absolute top-1.5 right-1.5 w-3 h-3 text-muted-foreground" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

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
          data-testid="mobile-more-button"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-medium">{t('common.next', 'More')}</span>
        </button>
      </nav>

      {/* Mobile "More" fullscreen menu with collapsible groups */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-[60] bg-background overflow-y-auto" data-testid="mobile-more-menu">
          {/* Header */}
          <div className="sticky top-0 bg-background border-b border-border flex items-center justify-between px-4 h-14 z-10">
            <span className="text-foreground font-semibold">{t('common.next', 'More')}</span>
            <button
              onClick={() => setMoreOpen(false)}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Grouped sections */}
          <div className="py-2 pb-20 divide-y divide-border">
            {NAV_GROUPS.map(renderMobileGroup)}
          </div>
        </div>
      )}
    </div>
  );
};
