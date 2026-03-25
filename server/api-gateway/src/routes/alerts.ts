import { Router, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database.js';
import logger from '../config/logger.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { validateBody, alertCreateSchema } from '../validators/index.js';

const router = Router();


const updateAlertSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  conditions: z.record(z.unknown()).optional(),
  channels: z.array(z.enum(['email', 'push', 'webhook', 'telegram'])).min(1).optional(),
  is_active: z.boolean().optional(),
});

// All routes require authentication
router.use(authenticate);

// GET / - list user's alerts
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id, name, conditions, channels, is_active, created_at, updated_at
       FROM alerts
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user!.id]
    );

    res.json({ alerts: result.rows });
  } catch (err) {
    logger.error('List alerts error', { error: (err as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / - create alert
router.post('/', validateBody(alertCreateSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, conditions, channels } = req.body;

    const result = await query(
      `INSERT INTO alerts (user_id, name, conditions, channels)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, conditions, channels, is_active, created_at`,
      [req.user!.id, name, JSON.stringify(conditions), JSON.stringify(channels)]
    );

    res.status(201).json({ alert: result.rows[0] });
  } catch (err) {
    logger.error('Create alert error', { error: (err as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id - update alert
router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validation = updateAlertSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: validation.error.issues });
      return;
    }

    // Verify ownership
    const existing = await query(
      'SELECT id FROM alerts WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user!.id]
    );
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    const { name, conditions, channels, is_active } = validation.data;

    const result = await query(
      `UPDATE alerts
       SET name = COALESCE($1, name),
           conditions = COALESCE($2, conditions),
           channels = COALESCE($3, channels),
           is_active = COALESCE($4, is_active),
           updated_at = NOW()
       WHERE id = $5 AND user_id = $6
       RETURNING id, name, conditions, channels, is_active, updated_at`,
      [
        name,
        conditions ? JSON.stringify(conditions) : null,
        channels ? JSON.stringify(channels) : null,
        is_active,
        req.params.id,
        req.user!.id,
      ]
    );

    res.json({ alert: result.rows[0] });
  } catch (err) {
    logger.error('Update alert error', { error: (err as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id - delete alert
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      'DELETE FROM alerts WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user!.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    res.json({ message: 'Alert deleted' });
  } catch (err) {
    logger.error('Delete alert error', { error: (err as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /history - triggered alert history
router.get('/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT ah.id, ah.alert_id, ah.triggered_at, ah.conditions_snapshot, ah.notification_sent,
              a.name as alert_name
       FROM alert_history ah
       JOIN alerts a ON a.id = ah.alert_id
       WHERE a.user_id = $1
       ORDER BY ah.triggered_at DESC
       LIMIT 100`,
      [req.user!.id]
    );

    res.json({ history: result.rows });
  } catch (err) {
    logger.error('Alert history error', { error: (err as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
