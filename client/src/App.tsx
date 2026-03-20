import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { useAuthStore } from '@/stores/auth';
import { useWebSocket } from '@/hooks/useWebSocket';
import { ToastContainer } from '@/components/common/ToastContainer';

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
const Admin = lazy(() => import('@/pages/Admin'));
const NotFound = lazy(() => import('@/pages/NotFound'));

const PageLoader: React.FC = () => (
  <div className="flex items-center justify-center h-[60vh]">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-gold-gradient flex items-center justify-center animate-pulse">
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

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Connect WebSocket for live ticker updates
  useWebSocket();

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
            <Route path="/admin" element={<Admin />} />
          </Route>

          {/* Catch-all 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <ToastContainer />
    </>
  );
};

export default App;
