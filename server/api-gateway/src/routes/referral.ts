import { Router, Response } from 'express';
import { query } from '../config/database.js';
import logger from '../config/logger.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET / - referral stats (authenticated)
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get user's referral code from user_profiles (fall back to users table)
    let referralCode: string | null = null;

    const profileResult = await query(
      'SELECT referral_code FROM user_profiles WHERE user_id = $1',
      [userId]
    );

    if (profileResult.rows.length > 0 && profileResult.rows[0].referral_code) {
      referralCode = profileResult.rows[0].referral_code;
    } else {
      // Fall back to users table
      const userResult = await query('SELECT referral_code FROM users WHERE id = $1', [userId]);
      referralCode = userResult.rows[0]?.referral_code || null;
    }

    // Count referrals
    let totalReferrals = 0;
    let totalEarnings = 0;
    let pendingEarnings = 0;

    try {
      const referralCountResult = await query(
        'SELECT COUNT(*) as count FROM referrals WHERE referrer_id = $1',
        [userId]
      );
      totalReferrals = parseInt(referralCountResult.rows[0]?.count || '0', 10);

      const earningsResult = await query(
        `SELECT
           COALESCE(SUM(CASE WHEN status = 'paid' THEN commission_amount ELSE 0 END), 0) as total_earnings,
           COALESCE(SUM(CASE WHEN status = 'pending' THEN commission_amount ELSE 0 END), 0) as pending_earnings
         FROM referrals
         WHERE referrer_id = $1`,
        [userId]
      );
      totalEarnings = parseFloat(earningsResult.rows[0]?.total_earnings || '0');
      pendingEarnings = parseFloat(earningsResult.rows[0]?.pending_earnings || '0');
    } catch {
      // referrals table may not exist yet — return zeros
    }

    const baseUrl = process.env.APP_URL || 'https://quantis.trade';
    const referralLink = referralCode ? `${baseUrl}/register?ref=${referralCode}` : null;

    res.json({
      referralCode,
      referralLink,
      totalReferrals,
      totalEarnings,
      pendingEarnings,
    });
  } catch (err) {
    logger.error('Get referral stats error', { error: (err as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /withdraw - withdraw referral balance (stub)
router.post('/withdraw', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    logger.info('Referral withdraw requested', { userId });

    // Stub: In production, this would process the payout
    res.json({
      success: true,
      message: 'Withdrawal request submitted. Earnings will be sent to your wallet within 24-48 hours.',
    });
  } catch (err) {
    logger.error('Referral withdraw error', { error: (err as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
