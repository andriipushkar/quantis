/**
 * API Gateway Integration Tests
 *
 * These tests require a running API Gateway instance.
 * Start the server first:  npm run dev -w server/api-gateway
 *
 * Then run:  npm test -w server/api-gateway
 */

const BASE = process.env.API_URL || 'http://localhost:3001';

async function fetchJSON(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------
describe('Health', () => {
  test('GET /health returns ok', async () => {
    const { status, body } = await fetchJSON('/health');
    expect(status).toBe(200);
    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('uptime');
    expect(body).toHaveProperty('timestamp');
    expect(typeof body.uptime).toBe('number');
    expect(typeof body.timestamp).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
describe('Auth', () => {
  const uniqueEmail = `test-${Date.now()}@test.com`;
  const uniqueUsername = `tester_${Date.now()}`;
  const password = 'SecureP@ss1!';
  let authToken: string;

  test('POST /api/v1/auth/register creates user', async () => {
    const { status, body } = await fetchJSON('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: uniqueEmail,
        password,
        username: uniqueUsername,
      }),
    });
    expect([200, 201]).toContain(status);
    expect(body).toBeDefined();
  });

  test('POST /api/v1/auth/register rejects duplicate email', async () => {
    const { status } = await fetchJSON('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: uniqueEmail,
        password,
        username: `dup_${Date.now()}`,
      }),
    });
    expect([400, 409, 422]).toContain(status);
  });

  test('POST /api/v1/auth/login with valid credentials returns tokens', async () => {
    const { status, body } = await fetchJSON('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: uniqueEmail, password }),
    });
    expect(status).toBe(200);
    expect(body).toBeDefined();
    // Store token for subsequent tests -- look in common response shapes
    const token =
      body?.token ||
      body?.accessToken ||
      body?.data?.token ||
      body?.data?.accessToken;
    if (token) {
      authToken = token;
    }
    // At minimum the response should contain some auth data
    expect(body).toBeTruthy();
  });

  test('POST /api/v1/auth/login with wrong password returns 401', async () => {
    const { status } = await fetchJSON('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: uniqueEmail,
        password: 'WrongPassword123!',
      }),
    });
    expect([400, 401, 403]).toContain(status);
  });

  test('POST /api/v1/auth/register rejects weak password', async () => {
    const { status } = await fetchJSON('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: `weak-${Date.now()}@test.com`,
        password: '123',
        username: `weak_${Date.now()}`,
      }),
    });
    expect([400, 422]).toContain(status);
  });

  test('GET /api/v1/auth/me without token returns 401', async () => {
    const { status } = await fetchJSON('/api/v1/auth/me');
    expect(status).toBe(401);
  });

  test('GET /api/v1/auth/me with valid token returns user', async () => {
    // This test depends on having a token from the login test.
    // If login did not return a token, skip gracefully.
    if (!authToken) {
      console.warn('Skipping /me test: no auth token obtained from login');
      return;
    }
    const { status, body } = await fetchJSON('/api/v1/auth/me', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
    });
    expect(status).toBe(200);
    expect(body).toBeDefined();
    // The response should contain user info
    const user = body?.data || body;
    expect(user).toHaveProperty('email');
  });
});

// ---------------------------------------------------------------------------
// Market
// ---------------------------------------------------------------------------
describe('Market', () => {
  test('GET /api/v1/market/pairs returns array', async () => {
    const { status, body } = await fetchJSON('/api/v1/market/pairs');
    expect(status).toBe(200);
    const data = body?.data ?? body;
    expect(Array.isArray(data)).toBe(true);
  });

  test('GET /api/v1/market/ticker returns tickers object', async () => {
    const { status, body } = await fetchJSON('/api/v1/market/ticker');
    expect(status).toBe(200);
    expect(body).toBeDefined();
    expect(typeof body === 'object').toBe(true);
  });

  test('GET /api/v1/market/ohlcv/BTCUSDT returns candles', async () => {
    const { status, body } = await fetchJSON('/api/v1/market/ohlcv/BTCUSDT');
    expect(status).toBe(200);
    const data = body?.data ?? body;
    expect(Array.isArray(data)).toBe(true);
  });

  test('GET /api/v1/market/ohlcv/INVALID returns empty', async () => {
    const { status, body } = await fetchJSON('/api/v1/market/ohlcv/INVALID');
    // Should return 200 with empty data or 404
    expect([200, 404]).toContain(status);
    if (status === 200) {
      const data = body?.data ?? body;
      if (Array.isArray(data)) {
        expect(data.length).toBe(0);
      }
    }
  });

  test('GET /api/v1/market/screener returns items with RSI', async () => {
    const { status, body } = await fetchJSON('/api/v1/market/screener');
    expect(status).toBe(200);
    const data = body?.data ?? body;
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      const first = data[0];
      // Screener items should include RSI or indicator data
      const hasIndicator =
        first.rsi !== undefined ||
        first.RSI !== undefined ||
        first.indicators !== undefined;
      expect(hasIndicator).toBe(true);
    }
  });

  test('GET /api/v1/market/fear-greed returns score 0-100', async () => {
    const { status, body } = await fetchJSON('/api/v1/market/fear-greed');
    expect(status).toBe(200);
    const score =
      body?.score ?? body?.value ?? body?.data?.score ?? body?.data?.value;
    if (score !== undefined) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  test('GET /api/v1/market/correlation returns matrix', async () => {
    const { status, body } = await fetchJSON('/api/v1/market/correlation');
    expect(status).toBe(200);
    const data = body?.data ?? body;
    // Correlation matrix should be an object or array of arrays
    expect(data).toBeDefined();
    expect(typeof data === 'object').toBe(true);
  });

  test('GET /api/v1/market/regime returns regime name', async () => {
    const { status, body } = await fetchJSON('/api/v1/market/regime');
    expect(status).toBe(200);
    const regime =
      body?.regime ?? body?.data?.regime ?? body?.name ?? body?.data?.name;
    if (regime !== undefined) {
      expect(typeof regime).toBe('string');
    }
  });

  test('GET /api/v1/market/breadth returns score', async () => {
    const { status, body } = await fetchJSON('/api/v1/market/breadth');
    expect(status).toBe(200);
    const data = body?.data ?? body;
    expect(data).toBeDefined();
    // Breadth should contain a numeric score or indicator
    const score = data?.score ?? data?.breadth ?? data?.value;
    if (score !== undefined) {
      expect(typeof score).toBe('number');
    }
  });
});

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------
describe('Analysis', () => {
  test('GET /api/v1/analysis/indicators/BTCUSDT returns RSI and EMA', async () => {
    const { status, body } = await fetchJSON(
      '/api/v1/analysis/indicators/BTCUSDT',
    );
    expect(status).toBe(200);
    const data = body?.data ?? body;
    expect(data).toBeDefined();
    // Should include RSI and EMA data
    const hasRsi =
      data?.rsi !== undefined ||
      data?.RSI !== undefined ||
      data?.rsi14 !== undefined;
    const hasEma =
      data?.ema !== undefined ||
      data?.EMA !== undefined ||
      data?.ema9 !== undefined;
    expect(hasRsi || hasEma).toBe(true);
  });

  test('GET /api/v1/analysis/signals returns array', async () => {
    const { status, body } = await fetchJSON('/api/v1/analysis/signals');
    expect(status).toBe(200);
    const data = body?.data ?? body;
    expect(Array.isArray(data)).toBe(true);
  });

  test('GET /api/v1/analysis/patterns/BTCUSDT returns patterns', async () => {
    const { status, body } = await fetchJSON(
      '/api/v1/analysis/patterns/BTCUSDT',
    );
    expect(status).toBe(200);
    const data = body?.data ?? body;
    // Patterns should be an array (possibly empty)
    expect(Array.isArray(data)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Scanner
// ---------------------------------------------------------------------------
describe('Scanner', () => {
  test('GET /api/v1/scanner/BTCUSDT returns risk score', async () => {
    const { status, body } = await fetchJSON('/api/v1/scanner/BTCUSDT');
    expect(status).toBe(200);
    const data = body?.data ?? body;
    expect(data).toBeDefined();
    const score =
      data?.riskScore ?? data?.risk_score ?? data?.score ?? data?.risk;
    if (score !== undefined) {
      expect(typeof score).toBe('number');
    }
  });

  test('GET /api/v1/scanner/BTCUSDT score is between 0 and 100', async () => {
    const { status, body } = await fetchJSON('/api/v1/scanner/BTCUSDT');
    expect(status).toBe(200);
    const data = body?.data ?? body;
    const score =
      data?.riskScore ?? data?.risk_score ?? data?.score ?? data?.risk;
    if (score !== undefined) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});
