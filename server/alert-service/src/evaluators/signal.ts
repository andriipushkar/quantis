import { query } from '../config/database.js';
import logger from '../config/logger.js';
import { alertDeliveryQueue } from '../index.js';

interface Signal {
  id: string;
  pair: string;
  strategy: string;
  direction: string;
  strength: number;
  confidence: number;
  timestamp: string;
}

interface SignalAlertRow {
  id: string;
  user_id: string;
  name: string;
  conditions_json: string;
  cooldown_minutes: number;
  last_triggered_at: string | null;
}

export class SignalAlertEvaluator {
  async evaluate(signal: Signal): Promise<void> {
    try {
      // Find users who have active signal alerts
      const result = await query(
        `SELECT id, user_id, name, conditions_json, cooldown_minutes, last_triggered_at
         FROM alerts
         WHERE is_active = true
           AND alert_type = 'signal'
           AND (expires_at IS NULL OR expires_at > NOW())`,
        []
      );

      if (result.rows.length === 0) return;

      logger.debug(`Evaluating ${result.rows.length} signal alerts for ${signal.pair} / ${signal.strategy}`);

      for (const alert of result.rows as SignalAlertRow[]) {
        await this.evaluateAlert(alert, signal);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Error evaluating signal alerts', { signal: signal.id, error: message });
    }
  }

  private async evaluateAlert(alert: SignalAlertRow, signal: Signal): Promise<void> {
    try {
      const conditions = JSON.parse(alert.conditions_json);

      // Check cooldown
      if (alert.last_triggered_at) {
        const lastTriggered = new Date(alert.last_triggered_at);
        const cooldownMs = (alert.cooldown_minutes || 0) * 60 * 1000;
        if (Date.now() - lastTriggered.getTime() < cooldownMs) {
          logger.debug(`Signal alert ${alert.id} is in cooldown, skipping`);
          return;
        }
      }

      // Match conditions against the signal
      let matches = true;
      let triggeredCondition = '';

      if (conditions.pair && conditions.pair !== signal.pair) {
        matches = false;
      }

      if (conditions.strategy && conditions.strategy !== signal.strategy) {
        matches = false;
      }

      if (conditions.direction && conditions.direction !== signal.direction) {
        matches = false;
      }

      if (conditions.min_strength && signal.strength < conditions.min_strength) {
        matches = false;
      }

      if (conditions.min_confidence && signal.confidence < conditions.min_confidence) {
        matches = false;
      }

      if (!matches) return;

      triggeredCondition = `Signal match: ${signal.pair} ${signal.strategy} ${signal.direction} (strength: ${signal.strength}, confidence: ${signal.confidence})`;

      logger.info(`Signal alert triggered: ${alert.name} (${alert.id})`, {
        alertId: alert.id,
        signalId: signal.id,
        pair: signal.pair,
        strategy: signal.strategy,
      });

      const snapshot = {
        signal,
        triggeredCondition,
        timestamp: new Date().toISOString(),
      };

      // Insert into alert_history
      await query(
        `INSERT INTO alert_history (alert_id, user_id, triggered_condition, snapshot_json, triggered_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [alert.id, alert.user_id, triggeredCondition, JSON.stringify(snapshot)]
      );

      // Update last_triggered_at
      await query(
        `UPDATE alerts SET last_triggered_at = NOW() WHERE id = $1`,
        [alert.id]
      );

      // Enqueue delivery job
      await alertDeliveryQueue.add('deliver', {
        alertId: alert.id,
        userId: alert.user_id,
        snapshot,
      }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Error evaluating individual signal alert', { alertId: alert.id, error: message });
    }
  }
}

export default new SignalAlertEvaluator();
