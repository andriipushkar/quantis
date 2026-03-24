/**
 * App.tsx coverage tests
 *
 * Tests HomeGate behaviour, keyboard shortcut (Ctrl+K), and route rendering.
 * All lazy-loaded pages and heavy dependencies are mocked.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Mock auth store ─────────────────────────────────────────────────

let mockIsAuthenticated = false;
const mockLoadUser = vi.fn();

vi.mock('@/stores/auth', () => ({
  useAuthStore: (selector: (s: any) => any) => {
    const state = {
      isAuthenticated: mockIsAuthenticated,
      loadUser: mockLoadUser,
    };
    return selector(state);
  },
}));

// ── Mock WebSocket hook ─────────────────────────────────────────────

vi.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: vi.fn(),
}));

// ── Mock layout & common components ─────────────────────────────────

vi.mock('@/components/layout/Layout', () => {
  const { Outlet } = require('react-router-dom');
  return {
    Layout: () => <div data-testid="layout"><Outlet /></div>,
  };
});

vi.mock('@/components/common/ToastContainer', () => ({
  ToastContainer: () => <div data-testid="toast-container" />,
}));

vi.mock('@/components/common/GlobalSearch', () => ({
  GlobalSearch: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? <div data-testid="global-search"><button onClick={onClose}>close</button></div> : null,
}));

// ── Mock ALL lazy-loaded pages ──────────────────────────────────────

vi.mock('@/pages/Landing', () => ({ default: () => <div data-testid="landing-page" /> }));
vi.mock('@/pages/Dashboard', () => ({ default: () => <div data-testid="dashboard-page" /> }));
vi.mock('@/pages/Chart', () => ({ default: () => <div data-testid="chart-page" /> }));
vi.mock('@/pages/Screener', () => ({ default: () => <div data-testid="screener-page" /> }));
vi.mock('@/pages/Heatmap', () => ({ default: () => <div data-testid="heatmap-page" /> }));
vi.mock('@/pages/Signals', () => ({ default: () => <div data-testid="signals-page" /> }));
vi.mock('@/pages/Alerts', () => ({ default: () => <div data-testid="alerts-page" /> }));
vi.mock('@/pages/Portfolio', () => ({ default: () => <div data-testid="portfolio-page" /> }));
vi.mock('@/pages/Copilot', () => ({ default: () => <div data-testid="copilot-page" /> }));
vi.mock('@/pages/PaperTrading', () => ({ default: () => <div data-testid="paper-trading-page" /> }));
vi.mock('@/pages/Settings', () => ({ default: () => <div data-testid="settings-page" /> }));
vi.mock('@/pages/Academy', () => ({ default: () => <div data-testid="academy-page" /> }));
vi.mock('@/pages/News', () => ({ default: () => <div data-testid="news-page" /> }));
vi.mock('@/pages/WhaleAlert', () => ({ default: () => <div data-testid="whale-alert-page" /> }));
vi.mock('@/pages/Login', () => ({ default: () => <div data-testid="login-page" /> }));
vi.mock('@/pages/Register', () => ({ default: () => <div data-testid="register-page" /> }));
vi.mock('@/pages/Pricing', () => ({ default: () => <div data-testid="pricing-page" /> }));
vi.mock('@/pages/Referral', () => ({ default: () => <div data-testid="referral-page" /> }));
vi.mock('@/pages/Correlation', () => ({ default: () => <div data-testid="correlation-page" /> }));
vi.mock('@/pages/Leaderboard', () => ({ default: () => <div data-testid="leaderboard-page" /> }));
vi.mock('@/pages/Journal', () => ({ default: () => <div data-testid="journal-page" /> }));
vi.mock('@/pages/MultiChart', () => ({ default: () => <div data-testid="multi-chart-page" /> }));
vi.mock('@/pages/TokenScanner', () => ({ default: () => <div data-testid="token-scanner-page" /> }));
vi.mock('@/pages/DCABot', () => ({ default: () => <div data-testid="dca-bot-page" /> }));
vi.mock('@/pages/Seasonality', () => ({ default: () => <div data-testid="seasonality-page" /> }));
vi.mock('@/pages/ExchangeHealth', () => ({ default: () => <div data-testid="exchange-health-page" /> }));
vi.mock('@/pages/FundingRates', () => ({ default: () => <div data-testid="funding-rates-page" /> }));
vi.mock('@/pages/Narratives', () => ({ default: () => <div data-testid="narratives-page" /> }));
vi.mock('@/pages/MarketBreadth', () => ({ default: () => <div data-testid="market-breadth-page" /> }));
vi.mock('@/pages/OpenInterest', () => ({ default: () => <div data-testid="open-interest-page" /> }));
vi.mock('@/pages/Profile', () => ({ default: () => <div data-testid="profile-page" /> }));
vi.mock('@/pages/ChartReplay', () => ({ default: () => <div data-testid="chart-replay-page" /> }));
vi.mock('@/pages/CopyTrading', () => ({ default: () => <div data-testid="copy-trading-page" /> }));
vi.mock('@/pages/SocialFeed', () => ({ default: () => <div data-testid="social-feed-page" /> }));
vi.mock('@/pages/Confluence', () => ({ default: () => <div data-testid="confluence-page" /> }));
vi.mock('@/pages/Liquidations', () => ({ default: () => <div data-testid="liquidations-page" /> }));
vi.mock('@/pages/AntiLiquidation', () => ({ default: () => <div data-testid="anti-liquidation-page" /> }));
vi.mock('@/pages/ElliottWave', () => ({ default: () => <div data-testid="elliott-wave-page" /> }));
vi.mock('@/pages/HarmonicPatterns', () => ({ default: () => <div data-testid="harmonic-patterns-page" /> }));
vi.mock('@/pages/WyckoffPhase', () => ({ default: () => <div data-testid="wyckoff-phase-page" /> }));
vi.mock('@/pages/OrderFlow', () => ({ default: () => <div data-testid="order-flow-page" /> }));
vi.mock('@/pages/PatternScanner', () => ({ default: () => <div data-testid="pattern-scanner-page" /> }));
vi.mock('@/pages/Marketplace', () => ({ default: () => <div data-testid="marketplace-page" /> }));
vi.mock('@/pages/WalletTracker', () => ({ default: () => <div data-testid="wallet-tracker-page" /> }));
vi.mock('@/pages/TaxReport', () => ({ default: () => <div data-testid="tax-report-page" /> }));
vi.mock('@/pages/Admin', () => ({ default: () => <div data-testid="admin-page" /> }));
vi.mock('@/pages/Options', () => ({ default: () => <div data-testid="options-page" /> }));
vi.mock('@/pages/IntermarketAnalysis', () => ({ default: () => <div data-testid="intermarket-page" /> }));
vi.mock('@/pages/DevActivity', () => ({ default: () => <div data-testid="dev-activity-page" /> }));
vi.mock('@/pages/NetworkMetrics', () => ({ default: () => <div data-testid="network-metrics-page" /> }));
vi.mock('@/pages/RenkoChart', () => ({ default: () => <div data-testid="renko-chart-page" /> }));
vi.mock('@/pages/BitcoinModels', () => ({ default: () => <div data-testid="bitcoin-models-page" /> }));
vi.mock('@/pages/IndicatorLibrary', () => ({ default: () => <div data-testid="indicator-library-page" /> }));
vi.mock('@/pages/ScriptEditor', () => ({ default: () => <div data-testid="script-editor-page" /> }));
vi.mock('@/pages/Status', () => ({ default: () => <div data-testid="status-page" /> }));
vi.mock('@/pages/Terms', () => ({ default: () => <div data-testid="terms-page" /> }));
vi.mock('@/pages/Privacy', () => ({ default: () => <div data-testid="privacy-page" /> }));
vi.mock('@/pages/InfluencerTracker', () => ({ default: () => <div data-testid="influencer-tracker-page" /> }));
vi.mock('@/pages/Tokenomics', () => ({ default: () => <div data-testid="tokenomics-page" /> }));
vi.mock('@/pages/DeFi', () => ({ default: () => <div data-testid="defi-page" /> }));
vi.mock('@/pages/MarketProfile', () => ({ default: () => <div data-testid="market-profile-page" /> }));
vi.mock('@/pages/MarketRegime', () => ({ default: () => <div data-testid="market-regime-page" /> }));
vi.mock('@/pages/APIDocs', () => ({ default: () => <div data-testid="api-docs-page" /> }));
vi.mock('@/pages/NotFound', () => ({ default: () => <div data-testid="not-found-page" /> }));
vi.mock('react-helmet-async', () => ({ Helmet: ({ children }: any) => null, HelmetProvider: ({ children }: any) => children }));


// ── Import App after all mocks ──────────────────────────────────────

import App from '../App';

// ── Helper ──────────────────────────────────────────────────────────

function renderApp(route: string = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  );
}

// ── Tests ───────────────────────────────────────────────────────────

beforeEach(() => {
  mockIsAuthenticated = false;
  mockLoadUser.mockReset();
});

describe('HomeGate', () => {
  it('shows Landing page for unauthenticated users', async () => {
    mockIsAuthenticated = false;
    renderApp('/');
    expect(await screen.findByTestId('landing-page')).toBeDefined();
  });

  it('redirects authenticated users to /dashboard', async () => {
    mockIsAuthenticated = true;
    renderApp('/');
    expect(await screen.findByTestId('dashboard-page')).toBeDefined();
  });
});

describe('Ctrl+K opens GlobalSearch', () => {
  it('toggles GlobalSearch on Ctrl+K', async () => {
    renderApp('/');
    // Initially search is not visible
    expect(screen.queryByTestId('global-search')).toBeNull();

    // Press Ctrl+K
    await act(async () => {
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    });
    expect(await screen.findByTestId('global-search')).toBeDefined();

    // Press Ctrl+K again to close
    await act(async () => {
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    });
    expect(screen.queryByTestId('global-search')).toBeNull();
  });

  it('opens GlobalSearch on Meta+K (macOS)', async () => {
    renderApp('/');
    await act(async () => {
      fireEvent.keyDown(window, { key: 'k', metaKey: true });
    });
    expect(await screen.findByTestId('global-search')).toBeDefined();
  });
});

describe('Public routes (no layout)', () => {
  it('renders Login page at /login', async () => {
    renderApp('/login');
    expect(await screen.findByTestId('login-page')).toBeDefined();
  });

  it('renders Register page at /register', async () => {
    renderApp('/register');
    expect(await screen.findByTestId('register-page')).toBeDefined();
  });

  it('renders Pricing page at /pricing', async () => {
    renderApp('/pricing');
    expect(await screen.findByTestId('pricing-page')).toBeDefined();
  });

  it('renders Status page at /status', async () => {
    renderApp('/status');
    expect(await screen.findByTestId('status-page')).toBeDefined();
  });

  it('renders Terms page at /terms', async () => {
    renderApp('/terms');
    expect(await screen.findByTestId('terms-page')).toBeDefined();
  });

  it('renders Privacy page at /privacy', async () => {
    renderApp('/privacy');
    expect(await screen.findByTestId('privacy-page')).toBeDefined();
  });
});

describe('App routes wrapped in Layout', () => {
  it('renders Dashboard at /dashboard inside Layout', async () => {
    renderApp('/dashboard');
    expect(await screen.findByTestId('layout')).toBeDefined();
    expect(await screen.findByTestId('dashboard-page')).toBeDefined();
  });

  it('renders Screener at /screener', async () => {
    renderApp('/screener');
    expect(await screen.findByTestId('screener-page')).toBeDefined();
  });

  it('renders Signals at /signals', async () => {
    renderApp('/signals');
    expect(await screen.findByTestId('signals-page')).toBeDefined();
  });

  it('renders Alerts at /alerts', async () => {
    renderApp('/alerts');
    expect(await screen.findByTestId('alerts-page')).toBeDefined();
  });

  it('renders Admin at /admin', async () => {
    renderApp('/admin');
    expect(await screen.findByTestId('admin-page')).toBeDefined();
  });
});

describe('Catch-all 404', () => {
  it('renders NotFound for unknown routes', async () => {
    renderApp('/some-random-path-that-does-not-exist');
    expect(await screen.findByTestId('not-found-page')).toBeDefined();
  });
});

describe('App initialization', () => {
  it('calls loadUser on mount', () => {
    renderApp('/');
    expect(mockLoadUser).toHaveBeenCalled();
  });

  it('renders ToastContainer', async () => {
    renderApp('/');
    expect(await screen.findByTestId('toast-container')).toBeDefined();
  });
});
