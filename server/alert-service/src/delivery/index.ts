import { query } from '../config/database.js';
import { publisher } from '../config/redis.js';
import logger from '../config/logger.js';
import { sendAlertEmail } from './email.js';

interface DeliveryChannel {
  type: 'push' | 'email' | 'telegram';
  config?: Record<string, string>;
}

export async function deliverAlert(
  alertId: string,
  userId: string,
  snapshot: Record<string, unknown>
): Promise<void> {
  try {
    // Look up alert details and channels
    const alertResult = await query(
      `SELECT a.id, a.name, a.channels_json, u.email
       FROM alerts a
       JOIN users u ON u.id = a.user_id
       WHERE a.id = $1`,
      [alertId]
    );

    if (alertResult.rows.length === 0) {
      logger.warn('Alert not found for delivery', { alertId });
      return;
    }

    const alert = alertResult.rows[0];
    const channels: DeliveryChannel[] = JSON.parse(alert.channels_json || '[]');

    if (channels.length === 0) {
      // Default to push if no channels specified
      channels.push({ type: 'push' });
    }

    const deliveryResults: { channel: string; status: string; error?: string }[] = [];

    for (const channel of channels) {
      try {
        switch (channel.type) {
          case 'push':
            // Publish to Redis for Socket.IO to pick up and push to client
            await publisher.publish('alert:push', JSON.stringify({
              userId,
              alertId,
              alertName: alert.name,
              snapshot,
              timestamp: new Date().toISOString(),
            }));
            deliveryResults.push({ channel: 'push', status: 'delivered' });
            logger.debug('Push notification published', { alertId, userId });
            break;

          case 'email':
            if (alert.email) {
              await sendAlertEmail(
                alert.email,
                { name: alert.name, id: alertId },
                snapshot as any
              );
              deliveryResults.push({ channel: 'email', status: 'delivered' });
            } else {
              deliveryResults.push({ channel: 'email', status: 'skipped', error: 'No email address' });
              logger.warn('No email address for user', { alertId, userId });
            }
            break;

          case 'telegram':
            // Stub for future Telegram integration
            logger.info('Telegram delivery not yet implemented', { alertId, userId });
            deliveryResults.push({ channel: 'telegram', status: 'skipped', error: 'Not implemented' });
            break;

          default:
            logger.warn('Unknown delivery channel', { channel: channel.type, alertId });
            deliveryResults.push({ channel: channel.type, status: 'skipped', error: 'Unknown channel' });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        deliveryResults.push({ channel: channel.type, status: 'failed', error: message });
        logger.error('Delivery failed for channel', { alertId, channel: channel.type, error: message });
      }
    }

    // Log overall delivery status
    logger.info('Alert delivery completed', {
      alertId,
      userId,
      results: deliveryResults,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Error delivering alert', { alertId, userId, error: message });
    throw error;
  }
}
