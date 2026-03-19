import React, { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  LineChart,
  Search,
  Signal,
  Bell,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

const mobileNavItems = [
  { icon: LayoutDashboard, labelKey: 'nav.dashboard', path: '/' },
  { icon: LineChart, labelKey: 'nav.chart', path: '/chart' },
  { icon: Search, labelKey: 'nav.screener', path: '/screener' },
  { icon: Signal, labelKey: 'nav.signals', path: '/signals' },
  { icon: Bell, labelKey: 'nav.alerts', path: '/alerts' },
];

export const Layout: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { t } = useTranslation();

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
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{t(item.labelKey)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
};
