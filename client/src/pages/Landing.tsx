import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart,
  Signal,
  Search,
  BarChart3,
  Brain,
  Wallet,
  ArrowRight,
  TrendingUp,
  Check,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '@/stores/theme';
import { Sun, Moon, Globe } from 'lucide-react';

/* ---------- BTC price hook ---------- */
function useBtcPrice() {
  const [price, setPrice] = useState<number | null>(null);
  const [change, setChange] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/v1/market/ticker/BTCUSDT');
        const json = await res.json();
        if (!cancelled && json?.data) {
          setPrice(json.data.price);
          setChange(json.data.change24h);
        }
      } catch {
        /* silently ignore on landing page */
      }
    }
    load();
    const id = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return { price, change };
}

/* ---------- Feature icons ---------- */
const featureIcons = [LineChart, Signal, Search, BarChart3, Brain, Wallet];
const featureKeys = ['feat1', 'feat2', 'feat3', 'feat4', 'feat5', 'feat6'];

/* ---------- Pricing data ---------- */
const tiers = [
  {
    name: 'Starter',
    price: 'Free',
    period: '',
    features: [
      'Basic charting (15 indicators)',
      '1 watchlist (10 coins)',
      'Delayed screener',
      'Community signals only',
      '5 AI Copilot queries / day',
    ],
    cta: 'Get Started',
    highlighted: false,
  },
  {
    name: 'Trader',
    price: '$29',
    period: '/mo',
    features: [
      '80+ indicators & drawing tools',
      '5 watchlists (50 coins each)',
      'Real-time screener',
      'All signal strategies',
      '50 AI Copilot queries / day',
      'Basic alerts (email)',
    ],
    cta: 'Start Free Trial',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$79',
    period: '/mo',
    features: [
      '200+ indicators & custom scripts',
      'Unlimited watchlists',
      'Derivatives dashboard',
      'Portfolio tracker',
      'Unlimited AI Copilot',
      'Alerts (email, Telegram, Discord)',
    ],
    cta: 'Start Free Trial',
    highlighted: true,
  },
  {
    name: 'Institutional',
    price: '$249',
    period: '/mo',
    features: [
      'Everything in Pro',
      'API access (REST + WS)',
      'On-chain analytics',
      'Custom signal models',
      'Priority support & SLA',
      'Team seats (up to 10)',
    ],
    cta: 'Contact Sales',
    highlighted: false,
  },
];

/* ---------- Component ---------- */
const LANGS = ['en', 'uk', 'de', 'es'] as const;
const LANG_LABELS: Record<string, string> = { en: 'EN', uk: 'UA', de: 'DE', es: 'ES' };

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { price, change } = useBtcPrice();
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useThemeStore();

  const toggleLanguage = () => {
    const idx = LANGS.indexOf(i18n.language as typeof LANGS[number]);
    const nextLang = LANGS[(idx + 1) % LANGS.length];
    i18n.changeLanguage(nextLang);
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ===== Navbar ===== */}
      <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-md bg-background/80 border-b border-border/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gold-gradient flex items-center justify-center">
              <span className="text-black font-bold text-base">Q</span>
            </div>
            <span className="text-primary font-bold text-xl tracking-wide">QUANTIS</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all text-xs font-medium"
              title="Switch language"
            >
              <Globe className="w-4 h-4" />
              <span>{LANG_LABELS[i18n.language] || 'EN'}</span>
            </button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
              {t('auth.signIn')}
            </Button>
            <Button size="sm" onClick={() => navigate('/register')}>
              {t('auth.signUp')}
            </Button>
          </div>
        </div>
      </header>

      {/* ===== Hero ===== */}
      <section className="relative pt-32 pb-24 px-6">
        {/* Grid pattern overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        {/* Gradient glow */}
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/10 rounded-full blur-[120px]" />

        <div className="relative max-w-4xl mx-auto text-center space-y-8">
          {/* Live BTC badge */}
          {price !== null && (
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 backdrop-blur px-4 py-1.5 text-sm">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-foreground font-semibold">
                BTC ${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
              {change !== null && (
                <span
                  className={
                    change >= 0 ? 'text-success font-medium' : 'text-danger font-medium'
                  }
                >
                  {change >= 0 ? '+' : ''}
                  {change.toFixed(2)}%
                </span>
              )}
            </div>
          )}

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-tight">
            {t('landing.heroTitle1')}{' '}
            <span className="bg-gold-bronze-gradient bg-clip-text text-transparent">
              {t('landing.heroTitle2')}
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('landing.heroSubtitle')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" onClick={() => navigate('/register')}>
              {t('landing.getStarted')}
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate('/chart/BTCUSDT')}
            >
              {t('landing.viewDemo')}
            </Button>
          </div>
        </div>
      </section>

      {/* ===== Features ===== */}
      <section className="py-24 px-6 bg-card/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">
            {t('landing.featuresTitle')}
          </h2>
          <p className="text-muted-foreground text-center mb-14 max-w-xl mx-auto">
            {t('landing.featuresSubtitle')}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featureKeys.map((key, i) => {
              const Icon = featureIcons[i];
              return (
                <div
                  key={key}
                  className="bg-card border border-border rounded-xl p-6 transition-all duration-200 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
                >
                  <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-foreground font-semibold text-lg mb-2">{t(`landing.${key}Title`)}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{t(`landing.${key}Desc`)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== Pricing ===== */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">
            {t('landing.pricingTitle')}
          </h2>
          <p className="text-muted-foreground text-center mb-14 max-w-xl mx-auto">
            {t('landing.pricingSubtitle')}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`relative bg-card border rounded-xl p-6 flex flex-col transition-all duration-200 hover:shadow-lg ${
                  tier.highlighted
                    ? 'border-primary shadow-gold-md'
                    : 'border-border hover:border-primary/50 hover:shadow-primary/5'
                }`}
              >
                {tier.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold-gradient text-black text-xs font-bold px-3 py-1 rounded-full">
                    {t('landing.mostPopular')}
                  </div>
                )}
                <h3 className="text-foreground font-semibold text-lg">{tier.name}</h3>
                <div className="mt-3 mb-6">
                  <span className="text-3xl font-extrabold text-foreground">
                    {tier.price}
                  </span>
                  {tier.period && (
                    <span className="text-muted-foreground text-sm">{tier.period}</span>
                  )}
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {tier.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  variant={tier.highlighted ? 'default' : 'outline'}
                  className="w-full"
                  onClick={() => navigate('/register')}
                >
                  {tier.cta}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm text-muted-foreground">
            {t('landing.footer')}
          </span>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <button className="hover:text-foreground transition-colors" onClick={() => navigate('/terms')}>{t('landing.terms')}</button>
            <button className="hover:text-foreground transition-colors" onClick={() => navigate('/privacy')}>{t('landing.privacy')}</button>
            <button className="hover:text-foreground transition-colors">{t('landing.contact')}</button>
            <button className="hover:text-foreground transition-colors" onClick={() => navigate('/status')}>{t('landing.status')}</button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
