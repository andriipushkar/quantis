import { query } from '../config/database.js';
import logger from '../config/logger.js';
import { alertDeliveryQueue } from '../index.js';

interface PriceCondition {
  type: 'price_above' | 'price_below' | 'price_change_percent';
  value: number;
  reference_price?: number;
}

interface AlertRow {
  id: string;
  user_id: string;
  name: string;
  conditions_json: string;
  cooldown_minutes: number;
  last_triggered_at: string | null;
}

export class PriceAlertEvaluator {
  async evaluate(symbol: string, currentPrice: number): Promise<void> {
    try {
      // Fetch all active alerts that have price conditions for this symbol
      const result = await query(
        `SELECT id, user_id, name, conditions_json, cooldown_minutes, last_triggered_at
         FROM alerts
         WHERE is_active = true
           AND conditions_json::text LIKE $1
           AND (expires_at IS NULL OR expires_at > NOW())`,
        [`%${symbol}%`]
      );

      if (result.rows.length === 0) return;

      logger.debug(`Evaluating ${result.rows.length} price alerts for ${symbol} at $${currentPrice}`);

      for (const alert of result.rows as AlertRow[]) {
        await this.evaluateAlert(alert, symbol, currentPrice);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Error evaluating price alerts', { symbol, currentPrice, error: message });
    }
  }

  private async evaluateAlert(alert: AlertRow, symbol: string, currentPrice: number): Promise<void> {
    try {
      const conditions: PriceCondition[] = JSON.parse(alert.conditions_json);

      // Check if cooldown has elapsed
      if (alert.last_triggered_at) {
        const lastTriggered = new Date(alert.last_triggered_at);
        const cooldownMs = (alert.cooldown_minutes || 0) * 60 * 1000;
        if (Date.now() - lastTriggered.getTime() < cooldownMs) {
          logger.debug(`Alert ${alert.id} is in cooldown, skipping`);
          return;
        }
      }

      // Evaluate all conditions
      let conditionMet = false;
      let triggeredCondition: string | null = null;

      for (const condition of conditions) {
        switch (condition.type) {
          case 'price_above':
            if (currentPrice > condition.value) {
              conditionMet = true;
              triggeredCondition = `Price above ${condition.value}`;
            }
            break;

          case 'price_below':
            if (currentPrice < condition.value) {
              conditionMet = true;
              triggeredCondition = `Price below ${condition.value}`;
            }
            break;

          case 'price_change_percent': {
            const refPrice = condition.reference_price;
            if (refPrice && refPrice > 0) {
              const changePercent = ((currentPrice - refPrice) / refPrice) * 100;
              if (Math.abs(changePercent) >= Math.abs(condition.value)) {
                conditionMet = true;
                triggeredCondition = `Price changed ${changePercent.toFixed(2)}% (threshold: ${condition.value}%)`;
              }
            }
            break;
          }
        }

        if (conditionMet) break;
      }

      if (!conditionMet) return;

      logger.info(`Alert triggered: ${alert.name} (${alert.id}) - ${triggeredCondition}`, {
        alertId: alert.id,
        symbol,
        currentPrice,
      });

      const snapshot = {
        symbol,
        currentPrice,
        triggeredCondition,
        timestamp: new Date().toISOString(),
      };

      // Insert into alert_history
      await query(
        `INSERT INTO alert_history (alert_id, user_id, triggered_condition, snapshot_json, triggered_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [alert.id, alert.user_id, triggeredCondition, JSON.stringify(snapshot)]
      );

      // Update last_triggered_at on the alert
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
      logger.error('Error evaluating individual alert', { alertId: alert.id, error: message });
    }
  }
}

export default new PriceAlertEvaluator();
