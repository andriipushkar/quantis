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
const Settings = lazy(() => import('@/pages/Settings'));
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));

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

          {/* Auth routes (no layout) */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* App routes wrapped in Layout */}
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/chart/:symbol?" element={<Chart />} />
            <Route path="/screener" element={<Screener />} />
            <Route path="/heatmap" element={<Heatmap />} />
            <Route path="/signals" element={<Signals />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </Suspense>
      <ToastContainer />
    </>
  );
};

export default App;
