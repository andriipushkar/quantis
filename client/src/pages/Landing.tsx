import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart, Signal, Search, BarChart3, Brain, Wallet,
  ArrowRight, Check, Sun, Moon, Globe,
  Shield, Users, Activity, ChevronDown, ChevronUp,
  Twitter, MessageCircle, Send, Zap,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '@/stores/theme';
import { cn } from '@/utils/cn';

/* ── Live ticker hook ───────────────────────────────────────────── */

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
        const syms = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','DOGEUSDT','ADAUSDT','AVAXUSDT'];
        const items: TickerItem[] = [];
        for (const s of syms) { const t = data[s]; if (t) items.push({ symbol: s.replace('USDT',''), price: t.price, change: t.change24h ?? 0 }); }
        if (items.length) setTickers(items);
      } catch { /* */ }
    }
    load(); const id = setInterval(load, 15_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);
  return tickers;
}

/* ── FAQ ─────────────────────────────────────────────────────────── */

const faqs = [
  { q: 'Is it free to start?', a: 'Yes! Starter is free forever, no credit card. Upgrade when you need more.' },
  { q: 'What crypto can I pay with?', a: 'BTC, ETH, USDT, USDC and 100+ coins via NOWPayments.' },
  { q: 'Can I cancel anytime?', a: 'Yes. Cancel from Settings, access continues until end of billing period.' },
  { q: 'How are signals generated?', a: 'AI analyzes 200+ indicators across multiple timeframes every 60 seconds with backtested confidence scores.' },
];

/* ── Pricing ─────────────────────────────────────────────────────── */

const pricingData = [
  { name: 'Starter', monthly: 0, yearly: 0, features: ['5 watchlist coins','10 indicators','3 alerts','Paper trading','Community access'], ctaKey: 'getStarted', highlighted: false },
  { name: 'Trader', monthly: 19, yearly: 149, features: ['80+ indicators','30 coins','All timeframes','30 alerts + Telegram','Signal access','Chart replay'], ctaKey: 'startTrial', highlighted: false },
  { name: 'Pro', monthly: 49, yearly: 390, features: ['200+ indicators + scripts','Unlimited watchlists','AI Copilot (unlimited)','Derivatives dashboard','Copy trading','On-chain data'], ctaKey: 'startTrial', highlighted: true },
  { name: 'Institutional', monthly: 149, yearly: 1190, features: ['Everything in Pro','Unlimited API','Webhooks','24/7 priority support','White-label','Dedicated manager'], ctaKey: 'contactSales', highlighted: false },
];

/* ── Features (bento layout) ─────────────────────────────────────── */

const features = [
  { icon: LineChart, color: 'text-blue-400 bg-blue-500/10', key: 'feat1', wide: true },
  { icon: Signal,    color: 'text-green-400 bg-green-500/10', key: 'feat2', wide: false },
  { icon: Brain,     color: 'text-purple-400 bg-purple-500/10', key: 'feat5', wide: false },
  { icon: Search,    color: 'text-orange-400 bg-orange-500/10', key: 'feat3', wide: true },
  { icon: BarChart3, color: 'text-red-400 bg-red-500/10', key: 'feat4', wide: false },
  { icon: Wallet,    color: 'text-cyan-400 bg-cyan-500/10', key: 'feat6', wide: false },
];

/* ── Stats ────────────────────────────────────────────────────────── */

const statsData = [
  { icon: Activity, value: '15,000+', key: 'stat1' },
  { icon: BarChart3, value: '200+', key: 'stat2' },
  { icon: Zap, value: '50+', key: 'stat3' },
  { icon: Users, value: '1,200+', key: 'stat4' },
];

/* ── Language ─────────────────────────────────────────────────────── */

const LANGS = ['en','uk','de','es'] as const;
const LL: Record<string,string> = { en:'EN', uk:'UA', de:'DE', es:'ES' };

/* ══════════════════════════════════════════════════════════════════
   Component
   ══════════════════════════════════════════════════════════════════ */

const Landing: React.FC = () => {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useThemeStore();
  const tickers = useLiveTickers();
  const [openFaq, setOpenFaq] = useState<number|null>(null);
  const [annual, setAnnual] = useState(false);

  const toggleLang = () => { const i = LANGS.indexOf(i18n.language as any); i18n.changeLanguage(LANGS[(i+1)%LANGS.length]); };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ═══ HEADER ═══════════════════════════════════════════════ */}
      <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border/40">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 h-16">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gold-bronze-gradient shadow-bronze-sm flex items-center justify-center">
              <span className="text-black font-bold text-base">Q</span>
            </div>
            <span className="text-primary font-bold text-xl tracking-wide hidden sm:inline">QUANTIS</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={toggleTheme} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-all">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button onClick={toggleLang} className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-all text-xs font-medium">
              <Globe className="w-4 h-4" /><span>{LL[i18n.language]||'EN'}</span>
            </button>
            <button onClick={() => nav('/login')} className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block">{t('auth.signIn')}</button>
            <Button size="sm" className="px-5" onClick={() => nav('/register')}>{t('auth.signUp')}</Button>
          </div>
        </div>
      </header>

      {/* ═══ TICKER STRIP ═════════════════════════════════════════ */}
      {tickers.length > 0 && (
        <div className="fixed top-16 inset-x-0 z-40 bg-card/60 backdrop-blur-lg border-b border-border/20">
          <div className="flex items-center gap-6 px-4 h-8 overflow-x-auto no-scrollbar text-xs animate-[scroll_30s_linear_infinite] sm:animate-none sm:justify-center">
            {tickers.map((tk) => (
              <div key={tk.symbol} className="flex items-center gap-2 shrink-0">
                <span className="font-semibold text-foreground">{tk.symbol}</span>
                <span className="font-mono text-muted-foreground">${tk.price.toLocaleString(undefined,{maximumFractionDigits:2})}</span>
                <span className={cn('font-medium', tk.change >= 0 ? 'text-success' : 'text-danger')}>{tk.change >= 0 ? '+' : ''}{tk.change.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ HERO ═════════════════════════════════════════════════ */}
      <section className={cn('relative px-4 sm:px-6', tickers.length ? 'pt-36' : 'pt-28', 'pb-8')}>
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-primary/8 rounded-full blur-[140px]" />

        <div className="relative max-w-5xl mx-auto text-center space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-foreground font-medium">{t('landing.trustBadge')}</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.08]">
            {t('landing.heroTitle1')}<br />
            <span className="bg-gold-bronze-gradient bg-clip-text text-transparent">{t('landing.heroTitle2')}</span>
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">{t('landing.heroSubtitle')}</p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
            <Button size="lg" className="px-8 text-base" onClick={() => nav('/register')}>
              {t('landing.getStarted')}<ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button variant="secondary" size="lg" className="px-8 text-base" onClick={() => nav('/dashboard')}>
              {t('landing.exploreDashboard')}
            </Button>
          </div>

          {/* ── Realistic dashboard mockup ── */}
          <div className="relative mt-8 mx-auto max-w-5xl">
            <div className="rounded-xl border border-border bg-card shadow-2xl shadow-black/20 overflow-hidden">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-4 py-2 bg-secondary/50 border-b border-border">
                <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-danger/60"/><div className="w-3 h-3 rounded-full bg-primary/40"/><div className="w-3 h-3 rounded-full bg-success/60"/></div>
                <div className="flex-1 mx-4 h-6 rounded-md bg-background/60 flex items-center justify-center"><span className="text-[10px] text-muted-foreground">quantis.app/dashboard</span></div>
              </div>
              {/* Dashboard layout */}
              <div className="flex bg-background">
                {/* Sidebar mini */}
                <div className="hidden sm:flex flex-col w-14 border-r border-border bg-card/50 py-3 gap-3 items-center">
                  <div className="w-7 h-7 rounded bg-primary/20 flex items-center justify-center"><span className="text-primary text-[8px] font-bold">Q</span></div>
                  {[BarChart3,LineChart,Search,Signal,Brain,Wallet].map((Icon,i) => (
                    <div key={i} className={cn('w-7 h-7 rounded flex items-center justify-center', i===1 ? 'bg-primary/15' : 'hover:bg-secondary')}><Icon className={cn('w-3.5 h-3.5', i===1 ? 'text-primary' : 'text-muted-foreground')}/></div>
                  ))}
                </div>
                {/* Main content */}
                <div className="flex-1 p-3 sm:p-4 space-y-3">
                  {/* Ticker row */}
                  <div className="flex gap-2 overflow-hidden">
                    {[{s:'BTC',p:'$97,450',c:'+2.3%',g:true},{s:'ETH',p:'$3,640',c:'+1.8%',g:true},{s:'SOL',p:'$185',c:'-0.5%',g:false},{s:'BNB',p:'$620',c:'+0.9%',g:true}].map(d=>(
                      <div key={d.s} className="flex-1 min-w-0 bg-card border border-border rounded-lg p-2 sm:p-2.5">
                        <p className="text-[9px] text-muted-foreground">{d.s}/USDT</p>
                        <p className="text-xs sm:text-sm font-bold text-foreground font-mono truncate">{d.p}</p>
                        <p className={cn('text-[9px] font-medium', d.g?'text-success':'text-danger')}>{d.c}</p>
                      </div>
                    ))}
                  </div>
                  {/* Candlestick chart mock */}
                  <div className="bg-card border border-border rounded-lg p-2 sm:p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">BTCUSDT</span>
                        <span className="text-[10px] text-muted-foreground">1H</span>
                      </div>
                      <div className="flex gap-1">{['EMA','BB','RSI'].map(i=><span key={i} className="text-[8px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{i}</span>)}</div>
                    </div>
                    {/* Candlesticks */}
                    <div className="h-28 sm:h-44 flex items-end gap-[1.5px] sm:gap-[2px]">
                      {Array.from({length:80},(_,i)=>{
                        const trend = Math.sin(i*0.12)*20 + (i/80)*40;
                        const bodyH = 3 + Math.random()*8;
                        const wickH = bodyH + 2 + Math.random()*4;
                        const bottom = 15 + trend + Math.random()*10;
                        const green = Math.sin(i*0.15+0.5)>-0.2;
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center justify-end min-w-[1px]" style={{height:'100%'}}>
                            <div className={cn('w-[1px]',green?'bg-success/50':'bg-danger/50')} style={{height:`${wickH}%`}}/>
                            <div className={cn('w-full rounded-[0.5px] min-h-[2px]',green?'bg-success':'bg-danger')} style={{height:`${bodyH}%`,marginBottom:`${bottom}%`}}/>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {/* Bottom panels row */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-card border border-border rounded-lg p-2">
                      <p className="text-[9px] text-muted-foreground mb-1">Fear & Greed</p>
                      <div className="flex items-center gap-2"><span className="text-sm font-bold text-primary">72</span><span className="text-[9px] text-success">Greed</span></div>
                    </div>
                    <div className="bg-card border border-border rounded-lg p-2">
                      <p className="text-[9px] text-muted-foreground mb-1">Top Signal</p>
                      <div className="flex items-center gap-2"><span className="text-[9px] px-1 py-0.5 rounded bg-success/15 text-success font-bold">LONG</span><span className="text-xs font-bold text-foreground">BTC 85%</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-2/3 h-12 bg-primary/8 rounded-full blur-2xl"/>
          </div>
        </div>
      </section>

      {/* ═══ STATS ════════════════════════════════════════════════ */}
      <section className="py-8 px-6 border-y border-border/40">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          {statsData.map((s) => (
            <div key={s.key} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><s.icon className="w-5 h-5 text-primary"/></div>
              <div><p className="text-xl font-bold text-foreground">{s.value}</p><p className="text-xs text-muted-foreground">{t(`landing.${s.key}`)}</p></div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ BENTO FEATURES ═══════════════════════════════════════ */}
      <section className="py-14 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-3">{t('landing.featuresTitle')}</h2>
          <p className="text-muted-foreground text-center mb-10 max-w-xl mx-auto">{t('landing.featuresSubtitle')}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-fr">
            {features.map((f) => (
              <div key={f.key} className={cn('group bg-card border border-border rounded-xl p-5 transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5', f.wide && 'lg:col-span-2')}>
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center mb-3', f.color)}><f.icon className="w-5 h-5"/></div>
                <h3 className="text-foreground font-semibold text-base mb-1.5">{t(`landing.${f.key}Title`)}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{t(`landing.${f.key}Desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ EXCHANGES ════════════════════════════════════════════ */}
      <section className="py-8 px-6 border-y border-border/30 bg-card/20">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-4">{t('landing.exchanges')}</p>
          <div className="flex items-center justify-center gap-10 sm:gap-16 opacity-50">
            {['Binance','Bybit','OKX'].map(e=><span key={e} className="text-foreground font-bold text-lg sm:text-xl tracking-wider">{e}</span>)}
          </div>
        </div>
      </section>

      {/* ═══ PRICING ══════════════════════════════════════════════ */}
      <section className="py-14 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-3">{t('landing.pricingTitle')}</h2>
          <p className="text-muted-foreground text-center mb-6 max-w-xl mx-auto">{t('landing.pricingSubtitle')}</p>

          {/* Monthly / Yearly toggle */}
          <div className="flex items-center justify-center gap-3 mb-10">
            <span className={cn('text-sm font-medium', !annual ? 'text-foreground' : 'text-muted-foreground')}>{t('landing.monthly')}</span>
            <button onClick={() => setAnnual(!annual)} className={cn('relative w-14 h-7 rounded-full transition-colors', annual ? 'bg-primary' : 'bg-secondary border border-border')}>
              <div className={cn('absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform', annual ? 'translate-x-8' : 'translate-x-1')}/>
            </button>
            <span className={cn('text-sm font-medium', annual ? 'text-foreground' : 'text-muted-foreground')}>{t('landing.yearly')}</span>
            {annual && <span className="text-xs font-bold text-success bg-success/10 px-2 py-0.5 rounded-full">{t('landing.savePercent')}</span>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
            {pricingData.map((tier) => {
              const price = tier.monthly === 0 ? 'Free' : annual ? `$${Math.round(tier.yearly/12)}` : `$${tier.monthly}`;
              const period = tier.monthly === 0 ? '' : '/mo';
              const yearlyNote = tier.monthly > 0 && annual ? `$${tier.yearly}/yr` : null;
              return (
                <div key={tier.name} className={cn('relative bg-card border rounded-xl p-6 flex flex-col transition-all duration-200', tier.highlighted ? 'border-primary/50 shadow-gold-md lg:scale-[1.03] lg:-my-2 z-10 ring-1 ring-primary/20' : 'border-border hover:border-primary/30 hover:shadow-lg')}>
                  {tier.highlighted && <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-bronze-gradient text-black text-xs font-bold px-4 py-1 rounded-full shadow-bronze-sm">{t('landing.mostPopular')}</div>}
                  <h3 className="text-foreground font-semibold text-lg">{tier.name}</h3>
                  <div className="mt-2 mb-1">
                    <span className="text-4xl font-extrabold text-foreground">{price}</span>
                    {period && <span className="text-muted-foreground text-sm">{period}</span>}
                  </div>
                  {yearlyNote && <p className="text-xs text-muted-foreground mb-3">{yearlyNote}</p>}
                  {!yearlyNote && <div className="mb-3"/>}
                  <ul className="space-y-2 mb-6 flex-1">
                    {tier.features.map(f=><li key={f} className="flex items-start gap-2 text-sm text-muted-foreground"><Check className="w-4 h-4 text-primary mt-0.5 shrink-0"/><span>{f}</span></li>)}
                  </ul>
                  <Button variant={tier.highlighted ? 'default' : 'outline'} className={cn('w-full', tier.highlighted && 'shadow-gold-sm')} onClick={() => nav('/register')}>
                    {t(`landing.${tier.ctaKey}`)}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══════════════════════════════════════════════════ */}
      <section className="py-14 px-4 sm:px-6 bg-card/30">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">{t('landing.faqTitle')}</h2>
          <div className="space-y-2">
            {faqs.map((faq,i)=>(
              <div key={i} className="border border-border rounded-xl overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq===i?null:i)} className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-secondary/30 transition-colors">
                  <span className="text-sm font-medium text-foreground">{faq.q}</span>
                  {openFaq===i?<ChevronUp className="w-4 h-4 text-muted-foreground shrink-0"/>:<ChevronDown className="w-4 h-4 text-muted-foreground shrink-0"/>}
                </button>
                {openFaq===i && <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">{faq.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ════════════════════════════════════════════ */}
      <section className="py-16 px-6 text-center">
        <div className="max-w-2xl mx-auto space-y-5">
          <h2 className="text-3xl sm:text-4xl font-bold">{t('landing.ctaTitle')}</h2>
          <p className="text-muted-foreground text-lg">{t('landing.ctaSubtitle')}</p>
          <Button size="lg" className="px-10 text-base" onClick={() => nav('/register')}>{t('landing.getStarted')}<ArrowRight className="ml-2 w-5 h-5"/></Button>
        </div>
      </section>

      {/* ═══ FOOTER ═══════════════════════════════════════════════ */}
      <footer className="border-t border-border py-10 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-8">
            <div className="col-span-2 sm:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-gold-bronze-gradient flex items-center justify-center"><span className="text-black font-bold text-sm">Q</span></div>
                <span className="text-primary font-bold text-lg">Quantis</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">Professional crypto analytics for every trader.</p>
              <div className="flex items-center gap-4">
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors"><Twitter className="w-5 h-5"/></a>
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors"><MessageCircle className="w-5 h-5"/></a>
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors"><Send className="w-5 h-5"/></a>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">Product</h4>
              <div className="space-y-2">{['Dashboard','Screener','Signals','AI Copilot','Paper Trading'].map(l=><button key={l} onClick={()=>nav('/register')} className="block text-sm text-muted-foreground hover:text-foreground transition-colors">{l}</button>)}</div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">Resources</h4>
              <div className="space-y-2">{[['Academy','/academy'],['API Docs','/api-docs'],['Status','/status']].map(([l,p])=><button key={l} onClick={()=>nav(p)} className="block text-sm text-muted-foreground hover:text-foreground transition-colors">{l}</button>)}</div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">Legal</h4>
              <div className="space-y-2">
                <button onClick={()=>nav('/terms')} className="block text-sm text-muted-foreground hover:text-foreground transition-colors">{t('landing.terms')}</button>
                <button onClick={()=>nav('/privacy')} className="block text-sm text-muted-foreground hover:text-foreground transition-colors">{t('landing.privacy')}</button>
              </div>
            </div>
          </div>
          <div className="border-t border-border pt-6 text-center"><span className="text-xs text-muted-foreground">{t('landing.footer')}</span></div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
