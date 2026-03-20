import { Router, Response } from 'express';
import { query } from '../config/database.js';
import logger from '../config/logger.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// POST /connect — Link Telegram account
router.post('/connect', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { chatId } = req.body;

    if (!chatId || typeof chatId !== 'string') {
      res.status(400).json({ success: false, error: 'chatId is required' });
      return;
    }

    // Store telegram chat ID in user_profiles metadata
    await query(
      `UPDATE user_profiles
       SET telegram_chat_id = $1, updated_at = NOW()
       WHERE user_id = $2`,
      [chatId, req.user!.id]
    );

    logger.info('Telegram connected', { userId: req.user!.id, chatId });

    res.json({
      success: true,
      data: {
        connected: true,
        message: "Telegram connected. You'll receive alerts here.",
      },
    });
  } catch (err) {
    logger.error('Telegram connect error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /disconnect — Unlink Telegram account
router.post('/disconnect', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await query(
      `UPDATE user_profiles
       SET telegram_chat_id = NULL, updated_at = NOW()
       WHERE user_id = $1`,
      [req.user!.id]
    );

    res.json({
      success: true,
      data: { connected: false, message: 'Telegram disconnected.' },
    });
  } catch (err) {
    logger.error('Telegram disconnect error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /status — Check connection status
router.get('/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT telegram_chat_id FROM user_profiles WHERE user_id = $1',
      [req.user!.id]
    );

    const chatId = result.rows[0]?.telegram_chat_id || null;

    res.json({
      success: true,
      data: {
        connected: !!chatId,
        chatId,
      },
    });
  } catch (err) {
    logger.error('Telegram status error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /test — Send test message (stub)
router.post('/test', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT telegram_chat_id FROM user_profiles WHERE user_id = $1',
      [req.user!.id]
    );

    const chatId = result.rows[0]?.telegram_chat_id;
    if (!chatId) {
      res.status(400).json({ success: false, error: 'Telegram not connected' });
      return;
    }

    // Stub: in production, this would send via Telegram Bot API
    logger.info('Telegram test message (stub)', { userId: req.user!.id, chatId });

    res.json({
      success: true,
      data: { sent: true, message: 'Test message sent to Telegram.' },
    });
  } catch (err) {
    logger.error('Telegram test error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
