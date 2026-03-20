/**
 * API Gateway Integration Tests
 *
 * These tests require a running API Gateway instance.
 * Start the server first:  npm run dev -w server/api-gateway
 *
 * Then run:  npm test -w server/api-gateway
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3001';

async function fetchJSON(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const { status, body } = await fetchJSON('/health');
    expect(status).toBe(200);
    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('uptime');
    expect(body).toHaveProperty('timestamp');
  });
});

// ---------------------------------------------------------------------------
// Market ticker
// ---------------------------------------------------------------------------
describe('GET /api/v1/market/ticker', () => {
  it('returns 200', async () => {
    const { status } = await fetchJSON('/api/v1/market/ticker');
    expect(status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Auth — register
// ---------------------------------------------------------------------------
describe('POST /api/v1/auth/register', () => {
  const uniqueEmail = `test_${Date.now()}@quantis.dev`;

  it('returns 201 for valid registration data', async () => {
    const { status } = await fetchJSON('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: uniqueEmail,
        password: 'SecureP@ss1!',
        username: `tester_${Date.now()}`,
      }),
    });
    // 201 Created or 200 OK depending on implementation
    expect([200, 201]).toContain(status);
  });
});

// ---------------------------------------------------------------------------
// Auth — login with wrong password
// ---------------------------------------------------------------------------
describe('POST /api/v1/auth/login', () => {
  it('returns 401 for incorrect credentials', async () => {
    const { status } = await fetchJSON('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'nonexistent@quantis.dev',
        password: 'WrongPassword123!',
      }),
    });
    expect([400, 401, 404]).toContain(status);
  });
});
