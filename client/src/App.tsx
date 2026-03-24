import React, { Suspense, lazy, useEffect, useState, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { useAuthStore } from '@/stores/auth';
import { useWebSocket } from '@/hooks/useWebSocket';
import { ToastContainer } from '@/components/common/ToastContainer';
import { GlobalSearch } from '@/components/common/GlobalSearch';

const Landing = lazy(() => import('@/pages/Landing'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Chart = lazy(() => import('@/pages/Chart'));
const Screener = lazy(() => import('@/pages/Screener'));
const Heatmap = lazy(() => import('@/pages/Heatmap'));
const Signals = lazy(() => import('@/pages/Signals'));
const Alerts = lazy(() => import('@/pages/Alerts'));
const Portfolio = lazy(() => import('@/pages/Portfolio'));
const Copilot = lazy(() => import('@/pages/Copilot'));
const PaperTrading = lazy(() => import('@/pages/PaperTrading'));
const Settings = lazy(() => import('@/pages/Settings'));
const Academy = lazy(() => import('@/pages/Academy'));
const News = lazy(() => import('@/pages/News'));
const WhaleAlert = lazy(() => import('@/pages/WhaleAlert'));
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const Pricing = lazy(() => import('@/pages/Pricing'));
const Referral = lazy(() => import('@/pages/Referral'));
const Correlation = lazy(() => import('@/pages/Correlation'));
const Leaderboard = lazy(() => import('@/pages/Leaderboard'));
const Journal = lazy(() => import('@/pages/Journal'));
const MultiChart = lazy(() => import('@/pages/MultiChart'));
const TokenScanner = lazy(() => import('@/pages/TokenScanner'));
const DCABot = lazy(() => import('@/pages/DCABot'));
const Seasonality = lazy(() => import('@/pages/Seasonality'));
const ExchangeHealth = lazy(() => import('@/pages/ExchangeHealth'));
const FundingRates = lazy(() => import('@/pages/FundingRates'));
const Narratives = lazy(() => import('@/pages/Narratives'));
const MarketBreadth = lazy(() => import('@/pages/MarketBreadth'));
const OpenInterest = lazy(() => import('@/pages/OpenInterest'));
const Profile = lazy(() => import('@/pages/Profile'));
const ChartReplay = lazy(() => import('@/pages/ChartReplay'));
const CopyTrading = lazy(() => import('@/pages/CopyTrading'));
const SocialFeed = lazy(() => import('@/pages/SocialFeed'));
const Confluence = lazy(() => import('@/pages/Confluence'));
const Liquidations = lazy(() => import('@/pages/Liquidations'));
const AntiLiquidation = lazy(() => import('@/pages/AntiLiquidation'));
const ElliottWave = lazy(() => import('@/pages/ElliottWave'));
const HarmonicPatterns = lazy(() => import('@/pages/HarmonicPatterns'));
const WyckoffPhase = lazy(() => import('@/pages/WyckoffPhase'));
const OrderFlow = lazy(() => import('@/pages/OrderFlow'));
const PatternScanner = lazy(() => import('@/pages/PatternScanner'));
const Marketplace = lazy(() => import('@/pages/Marketplace'));
const WalletTracker = lazy(() => import('@/pages/WalletTracker'));
const TaxReport = lazy(() => import('@/pages/TaxReport'));
const Admin = lazy(() => import('@/pages/Admin'));
const Options = lazy(() => import('@/pages/Options'));
const IntermarketAnalysis = lazy(() => import('@/pages/IntermarketAnalysis'));
const DevActivity = lazy(() => import('@/pages/DevActivity'));
const NetworkMetrics = lazy(() => import('@/pages/NetworkMetrics'));
const RenkoChart = lazy(() => import('@/pages/RenkoChart'));
const BitcoinModels = lazy(() => import('@/pages/BitcoinModels'));
const IndicatorLibrary = lazy(() => import('@/pages/IndicatorLibrary'));
const ScriptEditor = lazy(() => import('@/pages/ScriptEditor'));
const Status = lazy(() => import('@/pages/Status'));
const Terms = lazy(() => import('@/pages/Terms'));
const Privacy = lazy(() => import('@/pages/Privacy'));
const InfluencerTracker = lazy(() => import('@/pages/InfluencerTracker'));
const Tokenomics = lazy(() => import('@/pages/Tokenomics'));
const DeFi = lazy(() => import('@/pages/DeFi'));
const MarketProfile = lazy(() => import('@/pages/MarketProfile'));
const MarketRegime = lazy(() => import('@/pages/MarketRegime'));
const APIDocs = lazy(() => import('@/pages/APIDocs'));
const NotFound = lazy(() => import('@/pages/NotFound'));

const PageLoader: React.FC = () => (
  <div className="flex items-center justify-center h-[60vh]">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-gold-bronze-gradient flex items-center justify-center animate-pulse">
        <span className="text-black font-bold text-lg">Q</span>
      </div>
      <span className="text-muted-foreground text-sm">Loading...</span>
    </div>
  </div>
);

/** Show Landing for guests, redirect authenticated users to /dashboard */
const HomeGate: React.FC = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Landing />;
};

const App: React.FC = () => {
  const loadUser = useAuthStore((s) => s.loadUser);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Ctrl+K / Cmd+K to open global search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  // Connect WebSocket for live ticker updates
  useWebSocket();

  // Expose openSearch on window for Header to call
  useEffect(() => {
    (window as any).__quantisOpenSearch = openSearch;
    return () => { delete (window as any).__quantisOpenSearch; };
  }, [openSearch]);

  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public landing for guests; authenticated users redirect to dashboard */}
          <Route path="/" element={<HomeGate />} />

          {/* Public routes (no layout) */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/status" element={<Status />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/api-docs" element={<APIDocs />} />

          {/* App routes wrapped in Layout */}
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/chart/:symbol?" element={<Chart />} />
            <Route path="/screener" element={<Screener />} />
            <Route path="/heatmap" element={<Heatmap />} />
            <Route path="/correlation" element={<Correlation />} />
            <Route path="/copilot" element={<Copilot />} />
            <Route path="/signals" element={<Signals />} />
            <Route path="/paper-trading" element={<PaperTrading />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/multi-chart" element={<MultiChart />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/academy" element={<Academy />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/news" element={<News />} />
            <Route path="/whale-alert" element={<WhaleAlert />} />
            <Route path="/referral" element={<Referral />} />
            <Route path="/token-scanner" element={<TokenScanner />} />
            <Route path="/dca" element={<DCABot />} />
            <Route path="/seasonality" element={<Seasonality />} />
            <Route path="/exchange-health" element={<ExchangeHealth />} />
            <Route path="/funding-rates" element={<FundingRates />} />
            <Route path="/narratives" element={<Narratives />} />
            <Route path="/market-breadth" element={<MarketBreadth />} />
            <Route path="/open-interest" element={<OpenInterest />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/chart-replay" element={<ChartReplay />} />
            <Route path="/copy-trading" element={<CopyTrading />} />
            <Route path="/social" element={<SocialFeed />} />
            <Route path="/confluence" element={<Confluence />} />
            <Route path="/liquidations" element={<Liquidations />} />
            <Route path="/anti-liquidation" element={<AntiLiquidation />} />
            <Route path="/elliott-wave" element={<ElliottWave />} />
            <Route path="/harmonic-patterns" element={<HarmonicPatterns />} />
            <Route path="/wyckoff" element={<WyckoffPhase />} />
            <Route path="/order-flow" element={<OrderFlow />} />
            <Route path="/pattern-scanner" element={<PatternScanner />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/wallet-tracker" element={<WalletTracker />} />
            <Route path="/tax-report" element={<TaxReport />} />
            <Route path="/options" element={<Options />} />
            <Route path="/intermarket" element={<IntermarketAnalysis />} />
            <Route path="/dev-activity" element={<DevActivity />} />
            <Route path="/network-metrics" element={<NetworkMetrics />} />
            <Route path="/renko" element={<RenkoChart />} />
            <Route path="/btc-models" element={<BitcoinModels />} />
            <Route path="/indicators" element={<IndicatorLibrary />} />
            <Route path="/script-editor" element={<ScriptEditor />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/influencers" element={<InfluencerTracker />} />
            <Route path="/tokenomics" element={<Tokenomics />} />
            <Route path="/defi" element={<DeFi />} />
            <Route path="/market-profile" element={<MarketProfile />} />
            <Route path="/regime" element={<MarketRegime />} />
          </Route>

          {/* Catch-all 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <ToastContainer />
      <GlobalSearch isOpen={searchOpen} onClose={closeSearch} />
    </>
  );
};

export default App;
