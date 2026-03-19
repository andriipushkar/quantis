import { Router, Request, Response } from 'express';
import { query } from '../config/database.js';
import logger from '../config/logger.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET / - current subscription status (authenticated)
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
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
        subscription: null,
        tier: 'starter',
        message: 'No active subscription. Using free starter tier.',
      });
      return;
    }

    res.json({ subscription: result.rows[0] });
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

    // Stub: In production, this would call NOWPayments API
    const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    await query(
      `INSERT INTO payment_invoices (user_id, invoice_id, tier, period, status, amount_usd)
       VALUES ($1, $2, $3, $4, 'pending', $5)`,
      [req.user!.id, invoiceId, tier, period, 0] // amount would come from pricing config
    );

    res.status(201).json({
      invoiceId,
      tier,
      period,
      status: 'pending',
      message: 'Payment invoice created. Integrate with NOWPayments for crypto payment processing.',
      // paymentUrl would be returned from NOWPayments
    });
  } catch (err) {
    logger.error('Checkout error', { error: (err as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /webhook - IPN callback handler (no auth - called by payment provider)
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    // Stub: In production, verify IPN signature from NOWPayments
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
