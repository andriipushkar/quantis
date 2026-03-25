import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronRight as ChevronRightSmall,
  Zap,
  Lock,
  Star,
  StarOff,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import {
  NAV_GROUPS,
  findGroupByPath,
  isItemLocked,
  loadFavorites,
  saveFavorites,
  toggleFavorite,
  ALL_NAV_ITEMS,
  type NavItem,
  type NavGroup,
} from '@/config/navigation';
import { useAuthStore } from '@/stores/auth';

// ---------------------------------------------------------------------------
// Signal count hook
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const signalCount = useSignalCount();
  const user = useAuthStore((s) => s.user);
  const userTier = user?.tier ?? 'free';

  // -- Expanded groups state -------------------------------------------------
  const activeGroupId = useMemo(
    () => findGroupByPath(location.pathname),
    [location.pathname]
  );

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    // Core is always open by default
    initial.add('core');
    // Auto-expand the group containing current route
    if (activeGroupId) initial.add(activeGroupId);
    return initial;
  });

  // Auto-expand group when route changes
  useEffect(() => {
    if (activeGroupId && !expandedGroups.has(activeGroupId)) {
      setExpandedGroups((prev) => new Set([...prev, activeGroupId]));
    }
     
  }, [activeGroupId]);

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  // -- Favorites state -------------------------------------------------------
  const [favorites, setFavorites] = useState<string[]>(loadFavorites);

  const handleToggleFavorite = useCallback(
    (path: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const updated = toggleFavorite(path, favorites);
      setFavorites(updated);
      saveFavorites(updated);
    },
    [favorites]
  );

  const favoriteItems = useMemo(
    () =>
      favorites
        .map((path) => ALL_NAV_ITEMS.find((item) => item.path === path))
        .filter(Boolean) as NavItem[],
    [favorites]
  );

  // -- Render helpers --------------------------------------------------------

  const renderNavItem = (item: NavItem, showFavoriteStar = true) => {
    const locked = isItemLocked(item.tier, userTier);
    return (
      <NavLink
        key={item.path}
        to={locked ? '#' : item.path}
        onClick={locked ? (e: React.MouseEvent) => e.preventDefault() : undefined}
        end={item.path === '/'}
        className={({ isActive }) =>
          cn(
            'group/item flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
            collapsed && 'justify-center px-0',
            locked && 'opacity-50 cursor-not-allowed',
            isActive && !locked
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
        {!collapsed && (
          <>
            <span className="flex-1 truncate">{t(item.labelKey)}</span>
            {locked && <Lock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
            {!locked && showFavoriteStar && (
              <button
                onClick={(e) => handleToggleFavorite(item.path, e)}
                className="opacity-0 group-hover/item:opacity-100 transition-opacity flex-shrink-0"
                title={favorites.includes(item.path) ? 'Remove from favorites' : 'Add to favorites'}
              >
                {favorites.includes(item.path) ? (
                  <Star className="w-3.5 h-3.5 text-primary fill-primary" />
                ) : (
                  <StarOff className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
                )}
              </button>
            )}
          </>
        )}
      </NavLink>
    );
  };

  const renderGroup = (group: NavGroup) => {
    const isExpanded = expandedGroups.has(group.id);
    const itemCount = group.items.length;

    return (
      <div key={group.id} data-testid={`nav-group-${group.id}`}>
        {/* Group header */}
        {collapsed ? (
          // In collapsed mode, show a thin divider between groups
          <div className="mx-3 my-2 border-t border-border" />
        ) : (
          <button
            onClick={() => toggleGroup(group.id)}
            className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
            data-testid={`nav-group-toggle-${group.id}`}
          >
            <span>{t(group.labelKey)}</span>
            <span className="flex items-center gap-1.5">
              {!isExpanded && (
                <span className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground/60">
                  {itemCount}
                </span>
              )}
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRightSmall className="w-3.5 h-3.5" />
              )}
            </span>
          </button>
        )}

        {/* Group items */}
        {(collapsed || isExpanded) && (
          <div className="space-y-0.5">
            {group.items.map((item) => renderNavItem(item))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col h-screen bg-background border-r border-border transition-all duration-300 fixed left-0 top-0 z-40',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <NavLink
        to="/"
        className="flex items-center h-14 px-4 border-b border-border hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gold-bronze-gradient shadow-bronze-sm flex items-center justify-center flex-shrink-0">
            <span className="text-black font-bold text-sm">Q</span>
          </div>
          {!collapsed && (
            <span className="text-primary font-bold text-lg tracking-wide truncate">
              Quantis
            </span>
          )}
        </div>
      </NavLink>

      {/* Navigation */}
      <nav className="flex-1 py-2 px-2 overflow-y-auto scrollbar-thin" data-testid="sidebar-nav">
        {/* Favorites section */}
        {!collapsed && favoriteItems.length > 0 && (
          <div className="mb-1" data-testid="nav-favorites">
            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Star className="w-3 h-3 text-primary fill-primary" />
              <span>{t('navGroup.favorites', 'Favorites')}</span>
            </div>
            <div className="space-y-0.5">
              {favoriteItems.map((item) => renderNavItem(item, false))}
            </div>
            <div className="mx-3 my-2 border-t border-border" />
          </div>
        )}

        {/* Grouped navigation */}
        {NAV_GROUPS.map(renderGroup)}
      </nav>

      {/* Upgrade button */}
      <Link
        to="/pricing"
        className={cn(
          'flex items-center gap-2 mx-2 mb-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 hover:bg-primary/10',
          collapsed && 'justify-center px-0'
        )}
      >
        <Zap
          className="w-4 h-4 flex-shrink-0 text-primary"
          style={{ filter: 'drop-shadow(0 0 3px hsl(var(--primary) / 0.5))' }}
        />
        {!collapsed && (
          <span className="bg-gold-gradient bg-clip-text text-transparent">Upgrade</span>
        )}
      </Link>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="flex items-center justify-center h-12 border-t border-border text-muted-foreground hover:text-foreground transition-colors"
        data-testid="sidebar-collapse-toggle"
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>
    </aside>
  );
};
