/**
 * Email templates — unit tests
 *
 * Tests the 5 email template functions to ensure they produce valid HTML
 * containing the expected dynamic content.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// 1. Mocks
// ---------------------------------------------------------------------------

jest.mock('../config/env.js', () => ({
  __esModule: true,
  env: { APP_URL: 'https://quantis.app' },
}));

// ---------------------------------------------------------------------------
// 2. Imports
// ---------------------------------------------------------------------------

import {
  welcomeEmail,
  signalAlertEmail,
  weeklyReportEmail,
  passwordResetEmail,
  paymentConfirmEmail,
} from '../utils/email-templates.js';

// ---------------------------------------------------------------------------
// 3. Tests
// ---------------------------------------------------------------------------

describe('Email Templates', () => {
  describe('welcomeEmail', () => {
    it('returns an HTML string', () => {
      const html = welcomeEmail('Alice');
      expect(typeof html).toBe('string');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('</html>');
    });

    it('contains the user name', () => {
      const html = welcomeEmail('Bob');
      expect(html).toContain('Bob');
    });

    it('contains Welcome to Quantis title', () => {
      const html = welcomeEmail('TestUser');
      expect(html).toContain('Welcome to Quantis');
    });

    it('contains the 3 setup steps', () => {
      const html = welcomeEmail('User');
      expect(html).toContain('Step 1');
      expect(html).toContain('Step 2');
      expect(html).toContain('Step 3');
    });

    it('contains the dashboard CTA', () => {
      const html = welcomeEmail('User');
      expect(html).toContain('Go to Dashboard');
    });

    it('includes QUANTIS branding', () => {
      const html = welcomeEmail('User');
      expect(html).toContain('QUANTIS');
    });

    it('handles special characters in username', () => {
      const html = welcomeEmail('O\'Brien');
      expect(html).toContain('O\'Brien');
    });
  });

  describe('signalAlertEmail', () => {
    const buySignal = { pair: 'BTC/USDT', type: 'buy', entry: 65000, confidence: 87 };
    const sellSignal = { pair: 'ETH/USDT', type: 'sell', entry: 3200, confidence: 72 };

    it('returns an HTML string', () => {
      const html = signalAlertEmail(buySignal);
      expect(typeof html).toBe('string');
      expect(html).toContain('<!DOCTYPE html>');
    });

    it('contains the trading pair', () => {
      const html = signalAlertEmail(buySignal);
      expect(html).toContain('BTC/USDT');
    });

    it('contains the signal type in uppercase', () => {
      const html = signalAlertEmail(buySignal);
      expect(html).toContain('BUY');
    });

    it('contains the confidence value', () => {
      const html = signalAlertEmail(buySignal);
      expect(html).toContain('87%');
    });

    it('uses green color for buy signals', () => {
      const html = signalAlertEmail(buySignal);
      expect(html).toContain('#34D399'); // TEXT_GREEN
    });

    it('uses red color for sell signals', () => {
      const html = signalAlertEmail(sellSignal);
      expect(html).toContain('#F87171'); // TEXT_RED
    });

    it('contains SELL type for sell signals', () => {
      const html = signalAlertEmail(sellSignal);
      expect(html).toContain('SELL');
      expect(html).toContain('ETH/USDT');
    });

    it('includes entry price', () => {
      const html = signalAlertEmail(buySignal);
      expect(html).toContain('65');
      expect(html).toContain('000');
    });

    it('includes title with pair and type', () => {
      const html = signalAlertEmail(buySignal);
      expect(html).toContain('New BUY Signal - BTC/USDT');
    });

    it('includes disclaimer about financial advice', () => {
      const html = signalAlertEmail(buySignal);
      expect(html).toContain('not financial advice');
    });
  });

  describe('weeklyReportEmail', () => {
    const positiveData = { topMover: 'BTC', signalCount: 42, portfolioChange: 5.3 };
    const negativeData = { topMover: 'ETH', signalCount: 18, portfolioChange: -2.7 };

    it('returns an HTML string', () => {
      const html = weeklyReportEmail(positiveData);
      expect(typeof html).toBe('string');
      expect(html).toContain('<!DOCTYPE html>');
    });

    it('contains the top mover', () => {
      const html = weeklyReportEmail(positiveData);
      expect(html).toContain('BTC');
    });

    it('contains the signal count', () => {
      const html = weeklyReportEmail(positiveData);
      expect(html).toContain('42');
    });

    it('shows positive portfolio change with + sign', () => {
      const html = weeklyReportEmail(positiveData);
      expect(html).toContain('+5.3%');
    });

    it('shows negative portfolio change without + sign', () => {
      const html = weeklyReportEmail(negativeData);
      expect(html).toContain('-2.7%');
    });

    it('uses green color for positive change', () => {
      const html = weeklyReportEmail(positiveData);
      expect(html).toContain('#34D399');
    });

    it('uses red color for negative change', () => {
      const html = weeklyReportEmail(negativeData);
      expect(html).toContain('#F87171');
    });

    it('contains Weekly Summary heading', () => {
      const html = weeklyReportEmail(positiveData);
      expect(html).toContain('Weekly Summary');
    });

    it('contains View Full Report CTA', () => {
      const html = weeklyReportEmail(positiveData);
      expect(html).toContain('View Full Report');
    });

    it('handles zero portfolio change as positive', () => {
      const zeroData = { topMover: 'SOL', signalCount: 5, portfolioChange: 0 };
      const html = weeklyReportEmail(zeroData);
      expect(html).toContain('+0%');
    });
  });

  describe('passwordResetEmail', () => {
    const resetLink = 'https://quantis.app/reset?token=abc123';

    it('returns an HTML string', () => {
      const html = passwordResetEmail(resetLink);
      expect(typeof html).toBe('string');
      expect(html).toContain('<!DOCTYPE html>');
    });

    it('contains the reset link', () => {
      const html = passwordResetEmail(resetLink);
      expect(html).toContain(resetLink);
    });

    it('contains the reset link in both button href and plain text', () => {
      const html = passwordResetEmail(resetLink);
      // The link appears in the button href and as plain text
      const occurrences = html.split(resetLink).length - 1;
      expect(occurrences).toBeGreaterThanOrEqual(2);
    });

    it('contains Reset Your Password heading', () => {
      const html = passwordResetEmail(resetLink);
      expect(html).toContain('Reset Your Password');
    });

    it('mentions expiration time', () => {
      const html = passwordResetEmail(resetLink);
      expect(html).toContain('expire in 1 hour');
    });

    it('includes QUANTIS branding', () => {
      const html = passwordResetEmail(resetLink);
      expect(html).toContain('QUANTIS');
    });

    it('contains Reset Password button text', () => {
      const html = passwordResetEmail(resetLink);
      expect(html).toContain('Reset Password');
    });
  });

  describe('paymentConfirmEmail', () => {
    const paymentData = {
      tier: 'Pro',
      amount: 49.99,
      txHash: '0xabc123def456',
    };

    it('returns an HTML string', () => {
      const html = paymentConfirmEmail(paymentData);
      expect(typeof html).toBe('string');
      expect(html).toContain('<!DOCTYPE html>');
    });

    it('contains the tier name', () => {
      const html = paymentConfirmEmail(paymentData);
      expect(html).toContain('Pro');
    });

    it('contains the formatted amount', () => {
      const html = paymentConfirmEmail(paymentData);
      expect(html).toContain('$49.99');
    });

    it('contains the transaction hash', () => {
      const html = paymentConfirmEmail(paymentData);
      expect(html).toContain('0xabc123def456');
    });

    it('contains Payment Confirmed heading', () => {
      const html = paymentConfirmEmail(paymentData);
      expect(html).toContain('Payment Confirmed');
    });

    it('shows active plan confirmation', () => {
      const html = paymentConfirmEmail(paymentData);
      expect(html).toContain('Pro plan is now active');
    });

    it('contains Explore Premium Features CTA', () => {
      const html = paymentConfirmEmail(paymentData);
      expect(html).toContain('Explore Premium Features');
    });

    it('formats amount with two decimal places', () => {
      const wholeAmount = { tier: 'Basic', amount: 10, txHash: '0x111' };
      const html = paymentConfirmEmail(wholeAmount);
      expect(html).toContain('$10.00');
    });

    it('includes QUANTIS branding', () => {
      const html = paymentConfirmEmail(paymentData);
      expect(html).toContain('QUANTIS');
    });
  });
});
