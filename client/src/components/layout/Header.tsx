import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, Globe, Moon, Search, Sun, User } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useMarketStore } from '@/stores/market';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';

export const Header: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { selectedPair, tickers } = useMarketStore();
  const { isAuthenticated, user } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const ticker = tickers.get(selectedPair);

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'en' ? 'es' : 'en';
    i18n.changeLanguage(nextLang);
  };

  return (
    <header className="h-14 bg-background border-b border-border sticky top-0 z-30 flex items-center justify-between px-4 gap-4">
      {/* Left: Pair selector */}
      <div className="flex items-center gap-3 min-w-0">
        <Link
          to={`/chart/${selectedPair}`}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <span className="text-foreground font-semibold text-sm">
            {selectedPair.replace('USDT', '/USDT')}
          </span>
          {ticker && (
            <>
              <span className="text-foreground font-mono text-sm">
                ${ticker.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span
                className={cn(
                  'text-xs font-medium',
                  ticker.change24h >= 0 ? 'text-success' : 'text-danger'
                )}
              >
                {ticker.change24h >= 0 ? '+' : ''}
                {ticker.change24h.toFixed(2)}%
              </span>
            </>
          )}
        </Link>
      </div>

      {/* Center: Search */}
      <div className="hidden md:flex flex-1 max-w-md mx-4">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('common.search')}
            className="w-full h-9 pl-9 pr-4 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring focus:border-primary transition-all"
          />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          onClick={toggleLanguage}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
          title="Switch language"
        >
          <Globe className="w-4 h-4" />
        </button>

        <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-danger rounded-full" />
        </button>

        {isAuthenticated ? (
          <div className="flex items-center gap-2 pl-2 border-l border-border">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-primary text-xs font-semibold">
                {user?.display_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
          </div>
        ) : (
          <Link
            to="/login"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-all border border-primary/25"
          >
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">{t('auth.login')}</span>
          </Link>
        )}
      </div>
    </header>
  );
};
