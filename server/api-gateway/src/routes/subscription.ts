import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { query } from '../config/database.js';
import { env } from '../config/env.js';
import logger from '../config/logger.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// --- Pricing tiers (hardcoded) ---

const PRICING_TIERS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 0,
    annualPrice: 0,
    currency: 'USD',
    interval: 'month',
    features: [
      '5 watchlist coins',
      '10 basic indicators',
      '3 alerts',
      'Paper trading',
      'Basic education',
      'Community access',
    ],
  },
  {
    id: 'trader',
    name: 'Trader',
    price: 19,
    annualPrice: 149, // $12.4/mo — save 35%
    currency: 'USD',
    interval: 'month',
    features: [
      '30 watchlist coins',
      '80+ indicators',
      'All timeframes',
      '30 alerts',
      'Telegram & email alerts',
      'Signal access',
      'Chart replay',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 49,
    annualPrice: 390, // $32.5/mo — save 33%
    currency: 'USD',
    interval: 'month',
    popular: true,
    features: [
      'Unlimited watchlist',
      '200+ indicators',
      'Full backtester',
      'AI Copilot (unlimited)',
      'On-chain data',
      'Derivatives dashboard',
      'Copy trading',
      'Script editor',
    ],
  },
  {
    id: 'institutional',
    name: 'Institutional',
    price: 149,
    annualPrice: 1190, // $99/mo — save 33%
    currency: 'USD',
    interval: 'month',
    features: [
      'Everything in Pro',
      'Unlimited API access',
      'Webhooks & integrations',
      'Custom reports & exports',
      'Priority support 24/7',
      'White-label option',
      'Dedicated account manager',
    ],
  },
];

// GET /pricing - public pricing data (no auth required)
router.get('/pricing', (_req: Request, res: Response) => {
  res.json({ tiers: PRICING_TIERS });
});

// GET / - current subscription status (authenticated)
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Get user tier
    const userResult = await query('SELECT tier FROM users WHERE id = $1', [req.user!.id]);
    const userTier = userResult.rows[0]?.tier || 'starter';

    // Get active subscription
    const result = await query(
      `SELECT s.id, s.tier, s.status, s.started_at, s.expires_at, s.auto_renew
       FROM subscriptions s
       WHERE s.user_id = $1 AND s.status = 'active'
       ORDER BY s.started_at DESC
       LIMIT 1`,
      [req.user!.id]
    );

    if (result.rows.length === 0) {
      res.json({
        tier: userTier === 'starter' ? 'starter' : userTier,
        expiresAt: null,
        autoRenew: false,
      });
      return;
    }

    const sub = result.rows[0];
    res.json({
      tier: sub.tier,
      expiresAt: sub.expires_at,
      autoRenew: sub.auto_renew,
    });
  } catch (err) {
    logger.error('Get subscription error', { error: (err as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /checkout - create payment invoice (authenticated)
router.post('/checkout', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tier, period = 'monthly' } = req.body;

    const validTiers = ['trader', 'pro', 'institutional'];
    const validPeriods = ['monthly', 'yearly'];

    if (!tier || !validTiers.includes(tier)) {
      res.status(400).json({ error: 'Invalid tier', validTiers });
      return;
    }
    if (!validPeriods.includes(period)) {
      res.status(400).json({ error: 'Invalid period', validPeriods });
      return;
    }

    // Look up price from tiers
    const tierData = PRICING_TIERS.find((t) => t.id === tier);
    const amount = period === 'yearly' ? (tierData?.annualPrice ?? 0) : (tierData?.price ?? 0);

    const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    await query(
      `INSERT INTO payment_invoices (user_id, invoice_id, tier, period, status, amount_usd)
       VALUES ($1, $2, $3, $4, 'pending', $5)`,
      [req.user!.id, invoiceId, tier, period, amount]
    );

    const NOWPAYMENTS_API = env.NOWPAYMENTS_SANDBOX
      ? 'https://api-sandbox.nowpayments.io/v1'
      : 'https://api.nowpayments.io/v1';

    if (env.NOWPAYMENTS_API_KEY) {
      const npResponse = await fetch(`${NOWPAYMENTS_API}/invoice`, {
        method: 'POST',
        headers: {
          'x-api-key': env.NOWPAYMENTS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          price_amount: amount,
          price_currency: 'usd',
          order_id: invoiceId,
          order_description: `Quantis ${tier} - ${period}`,
          ipn_callback_url: `${env.APP_URL}/api/v1/subscription/webhook`,
          success_url: `${env.APP_URL}/settings?payment=success`,
          cancel_url: `${env.APP_URL}/pricing?payment=cancelled`,
        }),
      });
      const npData = (await npResponse.json()) as { invoice_url?: string; id?: string };

      if (!npResponse.ok) {
        logger.error('NOWPayments invoice creation failed', { status: npResponse.status, npData });
        res.status(502).json({ error: 'Payment provider error. Please try again later.' });
        return;
      }

      res.status(201).json({
        invoiceId,
        invoiceUrl: npData.invoice_url,
        tier,
        period,
        amount,
        status: 'pending',
      });
    } else {
      // Fallback: return without payment URL (dev mode)
      res.status(201).json({
        invoiceId,
        tier,
        period,
        amount,
        status: 'pending',
        message: 'NOWPayments not configured. Set NOWPAYMENTS_API_KEY to enable crypto payments.',
      });
    }
  } catch (err) {
    logger.error('Checkout error', { error: (err as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /webhook - IPN callback handler (no auth - called by payment provider)
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    // Verify IPN signature from NOWPayments
    if (env.NOWPAYMENTS_IPN_SECRET) {
      const receivedSig = req.headers['x-nowpayments-sig'] as string | undefined;
      if (!receivedSig) {
        logger.warn('Webhook missing IPN signature header');
        res.status(401).json({ error: 'Missing signature' });
        return;
      }

      // NOWPayments requires sorting body keys before hashing
      const sortedBody = JSON.stringify(
        Object.keys(req.body)
          .sort()
          .reduce<Record<string, unknown>>((sorted, key) => {
            sorted[key] = req.body[key];
            return sorted;
          }, {}),
      );

      const expectedSig = crypto
        .createHmac('sha512', env.NOWPAYMENTS_IPN_SECRET)
        .update(sortedBody)
        .digest('hex');

      if (receivedSig !== expectedSig) {
        logger.warn('Webhook IPN signature mismatch');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }
    }

    const { invoice_id, payment_status } = req.body;

    if (!invoice_id || !payment_status) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    logger.info('Payment webhook received', { invoice_id, payment_status });

    // Update invoice status
    await query(
      'UPDATE payment_invoices SET status = $1, updated_at = NOW() WHERE invoice_id = $2',
      [payment_status, invoice_id]
    );

    if (payment_status === 'confirmed' || payment_status === 'finished') {
      // Activate subscription
      const invoiceResult = await query(
        'SELECT user_id, tier, period FROM payment_invoices WHERE invoice_id = $1',
        [invoice_id]
      );

      if (invoiceResult.rows.length > 0) {
        const { user_id, tier, period } = invoiceResult.rows[0];
        const interval = period === 'yearly' ? '1 year' : '1 month';

        await query(
          `INSERT INTO subscriptions (user_id, tier, status, started_at, expires_at, auto_renew)
           VALUES ($1, $2, 'active', NOW(), NOW() + $3::interval, true)`,
          [user_id, tier, interval]
        );

        // Update user tier
        await query('UPDATE users SET tier = $1, updated_at = NOW() WHERE id = $2', [
          tier,
          user_id,
        ]);
      }
    }

    res.json({ status: 'ok' });
  } catch (err) {
    logger.error('Webhook error', { error: (err as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /history - payment history (authenticated)
router.get('/history', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id, invoice_id, tier, period, status, amount_usd, created_at, updated_at
       FROM payment_invoices
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user!.id]
    );

    res.json({ payments: result.rows });
  } catch (err) {
    logger.error('Payment history error', { error: (err as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
