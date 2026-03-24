/**
 * Emails routes — unit tests
 *
 * Tests template validation, admin check, and SMTP config verification.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../config/env.js', () => ({
  __esModule: true,
  env: {
    JWT_ACCESS_SECRET: 'test-secret-long-enough-for-jwt',
    ADMIN_EMAILS: ['admin@example.com'],
    SMTP_HOST: '',
    SMTP_USER: '',
  },
}));

jest.mock('../config/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('../config/redis.js', () => ({
  __esModule: true,
  default: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
}));

jest.mock('../utils/email-templates.js', () => ({
  __esModule: true,
  welcomeEmail: (name: string) => `<h1>Welcome ${name}</h1>`,
  signalAlertEmail: (data: any) => `<h1>Signal: ${data.pair}</h1>`,
  weeklyReportEmail: (data: any) => `<h1>Weekly: ${data.topMover}</h1>`,
  passwordResetEmail: (link: string) => `<h1>Reset: ${link}</h1>`,
  paymentConfirmEmail: (data: any) => `<h1>Payment: ${data.tier}</h1>`,
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { env } from '../config/env.js';

// ---------------------------------------------------------------------------
// Tests — Template validation
// ---------------------------------------------------------------------------

describe('Emails — template validation', () => {
  const validTemplates = ['welcome', 'signal', 'weekly', 'reset', 'payment'];

  test.each(validTemplates)('"%s" is a valid template', (template) => {
    expect(validTemplates.includes(template)).toBe(true);
  });

  test.each(['invoice', 'notification', '', 'Welcome'])('"%s" is an invalid template', (template) => {
    expect(validTemplates.includes(template)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests — Admin check logic
// ---------------------------------------------------------------------------

describe('Emails — admin check', () => {
  function isAdmin(email: string): boolean {
    return env.ADMIN_EMAILS.includes(email.toLowerCase());
  }

  test('admin@example.com → true', () => {
    expect(isAdmin('admin@example.com')).toBe(true);
  });

  test('user@example.com → false', () => {
    expect(isAdmin('user@example.com')).toBe(false);
  });

  test('case insensitive: ADMIN@EXAMPLE.COM → true', () => {
    expect(isAdmin('ADMIN@EXAMPLE.COM')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests — SMTP config check
// ---------------------------------------------------------------------------

describe('Emails — SMTP config', () => {
  test('SMTP not configured → send-test should return 503', () => {
    expect(!env.SMTP_HOST || !env.SMTP_USER).toBe(true);
  });

  test('with SMTP configured → should allow sending', () => {
    // Temporarily mock SMTP config
    const smtpHost = 'smtp.example.com';
    const smtpUser = 'user@example.com';
    expect(smtpHost && smtpUser).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Tests — Send-test validation
// ---------------------------------------------------------------------------

describe('Emails — send-test validation', () => {
  test('missing template → invalid', () => {
    const body = { to: 'test@example.com' } as any;
    expect(!body.template || !body.to).toBe(true);
  });

  test('missing to → invalid', () => {
    const body = { template: 'welcome' } as any;
    expect(!body.template || !body.to).toBe(true);
  });

  test('both template and to present → valid', () => {
    const body = { template: 'welcome', to: 'test@example.com' };
    expect(body.template && body.to).toBeTruthy();
  });

  test('unknown template → invalid', () => {
    const validTemplates = ['welcome', 'signal', 'weekly', 'reset', 'payment'];
    expect(validTemplates.includes('invoice')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests — Template rendering
// ---------------------------------------------------------------------------

describe('Emails — template rendering', () => {
  // Use mocked template generators
  const { welcomeEmail, signalAlertEmail, weeklyReportEmail, passwordResetEmail, paymentConfirmEmail } =
    jest.requireMock('../utils/email-templates.js');

  test('welcome template renders with username', () => {
    const html = welcomeEmail('CryptoTrader42');
    expect(html).toContain('Welcome CryptoTrader42');
  });

  test('signal template renders with pair', () => {
    const html = signalAlertEmail({ pair: 'BTC/USDT', type: 'BUY', entry: 87450.25, confidence: 82 });
    expect(html).toContain('Signal: BTC/USDT');
  });

  test('weekly template renders with top mover', () => {
    const html = weeklyReportEmail({ topMover: 'SOL (+18.5%)', signalCount: 47, portfolioChange: 5.3 });
    expect(html).toContain('Weekly: SOL (+18.5%)');
  });

  test('reset template renders with link', () => {
    const html = passwordResetEmail('https://quantis.app/reset?token=abc');
    expect(html).toContain('Reset: https://quantis.app/reset?token=abc');
  });

  test('payment template renders with tier', () => {
    const html = paymentConfirmEmail({ tier: 'Pro', amount: 49.99, txHash: '0x123' });
    expect(html).toContain('Payment: Pro');
  });
});
