import nodemailer from 'nodemailer';
import logger from '../config/logger.js';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS || '',
      }
    : undefined,
});

export async function sendAlertEmail(
  to: string,
  alert: { name: string; id: string },
  snapshot: { triggeredCondition?: string; currentPrice?: number; symbol?: string; timestamp?: string }
): Promise<void> {
  const fromAddress = process.env.SMTP_FROM || 'alerts@quantis.io';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 30px; }
        .header { color: #1a1a2e; font-size: 24px; margin-bottom: 20px; }
        .detail { margin: 10px 0; padding: 10px; background: #f0f4ff; border-radius: 4px; }
        .label { font-weight: bold; color: #555; }
        .value { color: #1a1a2e; }
        .footer { margin-top: 30px; font-size: 12px; color: #999; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">Alert Triggered: ${alert.name}</div>
        <div class="detail">
          <span class="label">Condition Met:</span>
          <span class="value">${snapshot.triggeredCondition || 'N/A'}</span>
        </div>
        ${snapshot.currentPrice !== undefined ? `
        <div class="detail">
          <span class="label">Current Price:</span>
          <span class="value">$${snapshot.currentPrice}</span>
        </div>
        ` : ''}
        ${snapshot.symbol ? `
        <div class="detail">
          <span class="label">Symbol:</span>
          <span class="value">${snapshot.symbol}</span>
        </div>
        ` : ''}
        <div class="detail">
          <span class="label">Triggered At:</span>
          <span class="value">${snapshot.timestamp || new Date().toISOString()}</span>
        </div>
        <div class="footer">
          This alert was sent by Quantis. You can manage your alerts in the dashboard.
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: fromAddress,
      to,
      subject: `Quantis Alert: ${alert.name}`,
      html,
    });

    logger.info('Alert email sent successfully', { alertId: alert.id, to });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to send alert email', { alertId: alert.id, to, error: message });
    throw error;
  }
}
