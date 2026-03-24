import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart, Signal, Search, BarChart3, Brain, Wallet,
  ArrowRight, TrendingUp, Check, Sun, Moon, Globe,
  Zap, Shield, Users, Activity, ChevronDown, ChevronUp,
  Twitter, MessageCircle, Send,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '@/stores/theme';
import { cn } from '@/utils/cn';

/* ── Live ticker strip hook ─────────────────────────────────────── */

interface TickerItem { symbol: string; price: number; change: number }

function useLiveTickers() {
  const [tickers, setTickers] = useState<TickerItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/v1/market/ticker');
        const json = await res.json();
        if (cancelled || !json?.success) return;
        const data = json.data;
        const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT'];
        const items: TickerItem[] = [];
        for (const sym of symbols) {
          const t = typeof data?.get === 'function' ? data.get(sym) : data[sym];
          if (t) items.push({ symbol: sym.replace('USDT', ''), price: t.price, change: t.change24h ?? 0 });
        }
        if (items.length > 0) setTickers(items);
      } catch { /* */ }
    }
    load();
    const id = setInterval(load, 15_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return tickers;
}

/* ── FAQ data ───────────────────────────────────────────────────── */

const faqKeys = [
  { q: 'Is it free to start?', a: 'Yes! The Starter tier is completely free with no credit card required. Upgrade only when you need more power.' },
  { q: 'What crypto can I pay with?', a: 'We accept BTC, ETH, USDT, USDC, and 100+ other cryptocurrencies via NOWPayments.' },
  { q: 'Can I cancel anytime?', a: 'Yes. Cancel from Settings anytime. Access continues until the end of your billing period.' },
  { q: 'How are signals generated?', a: 'Our AI engine analyzes 200+ indicators across multiple timeframes every 60 seconds and generates signals with backtested confidence scores.' },
];

/* ── Pricing tiers ──────────────────────────────────────────────── */

const tiers = [
  { name: 'Starter', price: 'Free', period: '', features: ['5 watchlist coins', '10 indicators', '3 alerts', 'Paper trading', 'Community access'], cta: 'getStarted', highlighted: false },
  { name: 'Trader', price: '$19', period: '/mo', features: ['80+ indicators', '30 coins', 'All timeframes', '30 alerts + Telegram', 'Signal access', 'Chart replay'], cta: 'startTrial', highlighted: false },
  { name: 'Pro', price: '$49', period: '/mo', features: ['200+ indicators + scripts', 'Unlimited watchlists', 'AI Copilot (unlimited)', 'Derivatives dashboard', 'Copy trading', 'On-chain data'], cta: 'startTrial', highlighted: true },
  { name: 'Institutional', price: '$149', period: '/mo', features: ['Everything in Pro', 'Unlimited API', 'Webhooks', 'Priority 24/7 support', 'White-label', 'Dedicated manager'], cta: 'contactSales', highlighted: false },
];

/* ── Feature data ───────────────────────────────────────────────── */

const features = [
  { icon: LineChart, color: 'text-blue-400 bg-blue-500/10', key: 'feat1', large: true },
  { icon: Signal,    color: 'text-green-400 bg-green-500/10', key: 'feat2', large: false },
  { icon: Brain,     color: 'text-purple-400 bg-purple-500/10', key: 'feat5', large: false },
  { icon: Search,    color: 'text-orange-400 bg-orange-500/10', key: 'feat3', large: true },
  { icon: BarChart3, color: 'text-red-400 bg-red-500/10', key: 'feat4', large: false },
  { icon: Wallet,    color: 'text-cyan-400 bg-cyan-500/10', key: 'feat6', large: false },
];

/* ── Stats ──────────────────────────────────────────────────────── */

const stats = [
  { icon: Activity, value: '15,000+', label: 'Signals generated' },
  { icon: BarChart3, value: '200+', label: 'Indicators' },
  { icon: Zap, value: '3', label: 'Exchanges connected' },
  { icon: Users, value: '1,200+', label: 'Active traders' },
];

/* ── Language config ────────────────────────────────────────────── */

const LANGS = ['en', 'uk', 'de', 'es'] as const;
const LANG_LABELS: Record<string, string> = { en: 'EN', uk: 'UA', de: 'DE', es: 'ES' };

/* ═══════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════ */

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useThemeStore();
  const tickers = useLiveTickers();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleLanguage = () => {
    const idx = LANGS.indexOf(i18n.language as typeof LANGS[number]);
    i18n.changeLanguage(LANGS[(idx + 1) % LANGS.length]);
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ═══ HEADER ═══════════════════════════════════════════════ */}
      <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-md bg-background/80 border-b border-border/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 h-16">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gold-bronze-gradient shadow-bronze-sm flex items-center justify-center">
              <span className="text-black font-bold text-base">Q</span>
            </div>
            <span className="text-primary font-bold text-xl tracking-wide hidden sm:inline">QUANTIS</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={toggleTheme} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all" title="Theme">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button onClick={toggleLanguage} className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all text-xs font-medium" title="Language">
              <Globe className="w-4 h-4" />
              <span>{LANG_LABELS[i18n.language] || 'EN'}</span>
            </button>
            <button onClick={() => navigate('/login')} className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
              {t('auth.signIn')}
            </button>
            <Button size="sm" className="px-5" onClick={() => navigate('/register')}>
              {t('auth.signUp')}
            </Button>
          </div>
        </div>
      </header>

      {/* ═══ LIVE TICKER STRIP ════════════════════════════════════ */}
      {tickers.length > 0 && (
        <div className="fixed top-16 inset-x-0 z-40 bg-card/80 backdrop-blur border-b border-border/30">
          <div className="max-w-7xl mx-auto flex items-center gap-6 px-4 h-8 overflow-x-auto no-scrollbar text-xs">
            {tickers.map((t) => (
              <div key={t.symbol} className="flex items-center gap-2 shrink-0">
                <span className="font-semibold text-foreground">{t.symbol}</span>
                <span className="font-mono text-muted-foreground">${t.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                <span className={cn('font-medium', t.change >= 0 ? 'text-success' : 'text-danger')}>
                  {t.change >= 0 ? '+' : ''}{t.change.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ HERO ═════════════════════════════════════════════════ */}
      <section className={cn('relative px-6', tickers.length > 0 ? 'pt-36' : 'pt-28', 'pb-12')}>
        {/* Background effects */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/8 rounded-full blur-[120px]" />

        <div className="relative max-w-4xl mx-auto text-center space-y-6">
          {/* Trust badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-foreground font-medium">Trusted by 1,200+ traders worldwide</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.1]">
            {t('landing.heroTitle1')}
            <br />
            <span className="bg-gold-bronze-gradient bg-clip-text text-transparent">
              {t('landing.heroTitle2')}
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('landing.heroSubtitle')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button size="lg" className="px-8 text-base" onClick={() => navigate('/register')}>
              {t('landing.getStarted')}
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button variant="outline" size="lg" className="px-8 text-base" onClick={() => navigate('/dashboard')}>
              Explore Dashboard
            </Button>
          </div>

          {/* ── Product mockup ── */}
          <div className="relative mt-10 mx-auto max-w-5xl">
            <div className="rounded-xl border border-border bg-card shadow-2xl shadow-primary/5 overflow-hidden">
              {/* Fake browser chrome */}
              <div className="flex items-center gap-2 px-4 py-2.5 bg-secondary/60 border-b border-border">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-danger/60" />
                  <div className="w-3 h-3 rounded-full bg-primary/40" />
                  <div className="w-3 h-3 rounded-full bg-success/60" />
                </div>
                <div className="flex-1 mx-4 h-6 rounded-md bg-background/50 flex items-center justify-center">
                  <span className="text-[10px] text-muted-foreground">quantis.app/dashboard</span>
                </div>
              </div>
              {/* Dashboard content preview */}
              <div className="p-4 sm:p-6 space-y-4 bg-background">
                {/* Top stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'BTC', val: '$97,450', ch: '+2.3%', color: 'text-success' },
                    { label: 'ETH', val: '$3,640', ch: '+1.8%', color: 'text-success' },
                    { label: 'SOL', val: '$185', ch: '-0.5%', color: 'text-danger' },
                    { label: 'Portfolio', val: '$12,847', ch: '+$340', color: 'text-success' },
                  ].map((s) => (
                    <div key={s.label} className="bg-card border border-border rounded-lg p-3">
                      <p className="text-[10px] text-muted-foreground">{s.label}</p>
                      <p className="text-sm font-bold text-foreground font-mono">{s.val}</p>
                      <p className={cn('text-[10px] font-medium', s.color)}>{s.ch}</p>
                    </div>
                  ))}
                </div>
                {/* Fake chart */}
                <div className="bg-card border border-border rounded-lg p-4 h-40 sm:h-56 flex items-end gap-[2px]">
                  {Array.from({ length: 60 }, (_, i) => {
                    const h = 20 + Math.sin(i * 0.3) * 15 + Math.random() * 20 + (i / 60) * 30;
                    const green = Math.sin(i * 0.3 + 1) > 0;
                    return <div key={i} className={cn('flex-1 rounded-sm min-w-[2px]', green ? 'bg-success/70' : 'bg-danger/60')} style={{ height: `${h}%` }} />;
                  })}
                </div>
              </div>
            </div>
            {/* Subtle reflection/glow under mockup */}
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-16 bg-primary/10 rounded-full blur-2xl" />
          </div>
        </div>
      </section>

      {/* ═══ STATS STRIP ══════════════════════════════════════════ */}
      <section className="py-10 px-6 border-y border-border/50">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <s.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ BENTO FEATURES ═══════════════════════════════════════ */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-3">{t('landing.featuresTitle')}</h2>
          <p className="text-muted-foreground text-center mb-10 max-w-xl mx-auto">{t('landing.featuresSubtitle')}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-fr">
            {features.map((f) => (
              <div
                key={f.key}
                className={cn(
                  'group bg-card border border-border rounded-xl p-6 transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5',
                  f.large && 'lg:col-span-2'
                )}
              >
                <div className={cn('w-11 h-11 rounded-lg flex items-center justify-center mb-4', f.color)}>
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="text-foreground font-semibold text-lg mb-2">{t(`landing.${f.key}Title`)}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{t(`landing.${f.key}Desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ EXCHANGE LOGOS ════════════════════════════════════════ */}
      <section className="py-10 px-6 border-y border-border/30 bg-card/20">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-6">Connected Exchanges</p>
          <div className="flex items-center justify-center gap-10 sm:gap-16 opacity-60">
            {['Binance', 'Bybit', 'OKX'].map((ex) => (
              <span key={ex} className="text-foreground font-bold text-lg sm:text-xl tracking-wider">{ex}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PRICING ══════════════════════════════════════════════ */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-3">{t('landing.pricingTitle')}</h2>
          <p className="text-muted-foreground text-center mb-10 max-w-xl mx-auto">{t('landing.pricingSubtitle')}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={cn(
                  'relative bg-card border rounded-xl p-6 flex flex-col transition-all duration-200 hover:shadow-lg',
                  tier.highlighted
                    ? 'border-primary/60 shadow-gold-md lg:scale-105 lg:-my-3 z-10 ring-1 ring-primary/20'
                    : 'border-border hover:border-primary/30'
                )}
              >
                {tier.highlighted && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-bronze-gradient text-black text-xs font-bold px-4 py-1 rounded-full shadow-bronze-sm">
                    {t('landing.mostPopular')}
                  </div>
                )}
                <h3 className="text-foreground font-semibold text-lg">{tier.name}</h3>
                <div className="mt-3 mb-5">
                  <span className="text-4xl font-extrabold text-foreground">{tier.price}</span>
                  {tier.period && <span className="text-muted-foreground text-sm">{tier.period}</span>}
                </div>
                <ul className="space-y-2.5 mb-6 flex-1">
                  {tier.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  variant={tier.highlighted ? 'default' : 'outline'}
                  className={cn('w-full', tier.highlighted && 'shadow-gold-sm')}
                  onClick={() => navigate('/register')}
                >
                  {tier.cta === 'getStarted' ? t('landing.getStarted') : tier.cta === 'contactSales' ? 'Contact Sales' : 'Start Free Trial'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══════════════════════════════════════════════════ */}
      <section className="py-16 px-6 bg-card/30">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">FAQ</h2>
          <div className="space-y-3">
            {faqKeys.map((faq, i) => (
              <div key={i} className="border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-secondary/30 transition-colors"
                >
                  <span className="text-sm font-medium text-foreground">{faq.q}</span>
                  {openFaq === i ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ════════════════════════════════════════════ */}
      <section className="py-20 px-6 text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-3xl sm:text-4xl font-bold">Ready to level up your trading?</h2>
          <p className="text-muted-foreground text-lg">Join thousands of traders using Quantis to find better entries, manage risk, and grow their portfolio.</p>
          <Button size="lg" className="px-10 text-base" onClick={() => navigate('/register')}>
            {t('landing.getStarted')}
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </section>

      {/* ═══ FOOTER ═══════════════════════════════════════════════ */}
      <footer className="border-t border-border py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
            {/* Brand */}
            <div className="col-span-2 sm:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-gold-bronze-gradient flex items-center justify-center">
                  <span className="text-black font-bold text-sm">Q</span>
                </div>
                <span className="text-primary font-bold text-lg">Quantis</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">Professional crypto analytics for every trader.</p>
              <div className="flex items-center gap-3 mt-4">
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors"><Twitter className="w-4 h-4" /></a>
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors"><MessageCircle className="w-4 h-4" /></a>
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors"><Send className="w-4 h-4" /></a>
              </div>
            </div>
            {/* Product */}
            <div>
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">Product</h4>
              <div className="space-y-2">
                {['Dashboard', 'Screener', 'Signals', 'AI Copilot', 'Paper Trading'].map((l) => (
                  <button key={l} onClick={() => navigate('/register')} className="block text-sm text-muted-foreground hover:text-foreground transition-colors">{l}</button>
                ))}
              </div>
            </div>
            {/* Resources */}
            <div>
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">Resources</h4>
              <div className="space-y-2">
                {[['Academy', '/academy'], ['API Docs', '/api-docs'], ['Status', '/status']].map(([l, p]) => (
                  <button key={l} onClick={() => navigate(p)} className="block text-sm text-muted-foreground hover:text-foreground transition-colors">{l}</button>
                ))}
              </div>
            </div>
            {/* Legal */}
            <div>
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">Legal</h4>
              <div className="space-y-2">
                <button onClick={() => navigate('/terms')} className="block text-sm text-muted-foreground hover:text-foreground transition-colors">{t('landing.terms')}</button>
                <button onClick={() => navigate('/privacy')} className="block text-sm text-muted-foreground hover:text-foreground transition-colors">{t('landing.privacy')}</button>
              </div>
            </div>
          </div>
          <div className="border-t border-border pt-6 text-center">
            <span className="text-xs text-muted-foreground">{t('landing.footer')}</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
