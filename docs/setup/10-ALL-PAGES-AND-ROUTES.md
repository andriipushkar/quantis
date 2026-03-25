# All Pages & Routes

## Public Pages (no auth required)

| Route | Page | Description |
|---|---|---|
| `/` | Landing | Hero, features, pricing, live BTC price |
| `/pricing` | Pricing | 4 tiers, annual toggle, FAQ |
| `/login` | Login | Email + password, JWT auth |
| `/register` | Register | Registration + onboarding wizard |
| `/status` | Status | Service health monitoring |
| `/terms` | Terms | Terms of Service |
| `/privacy` | Privacy | Privacy Policy |
| `/api-docs` | APIDocs | API endpoint listing + examples |
| `*` | NotFound | 404 page |

## Authenticated Pages (inside Layout)

### Analysis & Charts
| Route | Page | Description |
|---|---|---|
| `/dashboard` | Dashboard | Watchlist, Fear&Greed, Gainers/Losers, BTC chart, Regime |
| `/chart/:symbol?` | Chart | TradingView + EMA/BB/RSI + drawing tools |
| `/multi-chart` | MultiChart | 2x2 independent chart grid |
| `/screener` | Screener | 7-column table, RSI, trend, filters, presets |
| `/heatmap` | Heatmap | Treemap grid colored by change/RSI |
| `/correlation` | Correlation | 20x20 Pearson correlation matrix |
| `/confluence` | Confluence | Cross-signal price zones |
| `/seasonality` | Seasonality | Hourly + day-of-week analysis |
| `/market-breadth` | MarketBreadth | A/D line, % above SMA, score |
| `/indicators` | IndicatorLibrary | 32 indicators catalog |
| `/pattern-scanner` | PatternScanner | 8 pattern types detection |
| `/advanced-patterns` | AdvancedPatterns | Elliott Wave + Harmonic + Wyckoff (tabs) |
| `/advanced-charts` | AdvancedCharts | Renko + Market Profile + Order Flow (tabs) |
| `/intermarket` | IntermarketAnalysis | TradFi + BTC correlations |
| `/btc-models` | BitcoinModels | S2F, Rainbow, Pi Cycle, MVRV |
| `/token-scanner` | TokenScanner | 6-factor risk scoring |

### Trading
| Route | Page | Description |
|---|---|---|
| `/signals` | Signals | Live trading signals |
| `/arbitrage` | ArbitrageScanner | Cross-exchange, funding rate, triangular arbitrage |
| `/backtester` | StrategyBacktester | Strategy backtesting with equity curve + stats |
| `/grid-bot` | GridBot | Grid trading bot (symbol, price range, levels) |
| `/paper-trading` | PaperTrading | Virtual $10,000 account |
| `/copy-trading` | CopyTrading | Follow lead traders |
| `/dca` | DCABot | Smart DCA with 3 strategies |
| `/alerts` | Alerts | 5-step builder + alert chains |
| `/chart-replay` | ChartReplay | Historical bar-by-bar replay |
| `/liquidations` | Liquidations | Liquidation heatmap |
| `/anti-liquidation` | AntiLiquidation | Position distance monitoring |
| `/funding-rates` | FundingRates | Perpetual funding rates |
| `/open-interest` | OpenInterest | OI data + divergence |
| `/options` | Options | Options chain, Max Pain, IV smile |

### Portfolio & Journal
| Route | Page | Description |
|---|---|---|
| `/portfolio` | Portfolio | Holdings, allocation, CSV, rebalancing |
| `/journal` | Journal | Trade log with emotions, P&L, stats |
| `/tax-report` | TaxReport | FIFO calculation, CSV export |
| `/wallet-tracker` | WalletTracker | Web3 wallet monitoring |

### Data & News
| Route | Page | Description |
|---|---|---|
| `/news` | News | 12 articles with sentiment |
| `/whale-alert` | WhaleAlert | Volume spike alerts |
| `/social-intelligence` | SocialIntelligence | Narratives + Influencer Tracker (tabs) |
| `/exchange-health` | ExchangeHealth | 3 exchanges monitored |
| `/tokenomics` | Tokenomics | Supply, inflation, scores |
| `/defi` | DeFi | 10 protocols, TVL, APY |
| `/on-chain` | OnChainAnalytics | Dev Activity + Network Metrics (tabs) |

### Community
| Route | Page | Description |
|---|---|---|
| `/social` | SocialFeed | Posts, likes, trending |
| `/academy` | Academy | 15-chapter course |
| `/leaderboard` | Leaderboard | Paper trading + signal rankings |
| `/marketplace` | Marketplace | 8 strategy listings |
| `/script-editor` | ScriptEditor | Quantis Script IDE |
| `/copilot` | Copilot | AI market analysis chat |

### Account
| Route | Page | Description |
|---|---|---|
| `/profile` | Profile | XP, level, achievements |
| `/settings` | Settings | Profile, 2FA, Telegram, theme |
| `/referral` | Referral | Referral link, stats, earnings |
| `/admin` | Admin | Admin panel (restricted) |

**Total: 60 routes / 60 page components**

---

### Legacy Redirects

Old individual routes still work and redirect to the merged pages:

| Old Route | Redirects To |
|---|---|
| `/elliott-wave` | `/advanced-patterns?tab=elliott` |
| `/harmonic-patterns` | `/advanced-patterns?tab=harmonic` |
| `/wyckoff` | `/advanced-patterns?tab=wyckoff` |
| `/renko` | `/advanced-charts?tab=renko` |
| `/market-profile` | `/advanced-charts?tab=market-profile` |
| `/order-flow` | `/advanced-charts?tab=order-flow` |
| `/dev-activity` | `/on-chain?tab=dev-activity` |
| `/network-metrics` | `/on-chain?tab=network-metrics` |
| `/narratives` | `/social-intelligence?tab=narratives` |
| `/influencers` | `/social-intelligence?tab=influencers` |
