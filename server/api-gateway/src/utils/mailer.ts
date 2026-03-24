import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import logger from '../config/logger.js';

const transporter = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT || 587,
      secure: env.SMTP_SECURE || false,
      auth: {
        user: env.SMTP_USER!,
        pass: env.SMTP_PASS!,
      },
    })
  : null;

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<boolean> {
  if (!transporter) {
    logger.warn('SMTP not configured, skipping email', { to, subject });
    return false;
  }
  try {
    await transporter.sendMail({
      from: env.SMTP_FROM || 'noreply@quantis.io',
      to,
      subject,
      html,
    });
    logger.info('Email sent successfully', { to, subject });
    return true;
  } catch (err) {
    logger.error('Failed to send email', {
      to,
      error: (err as Error).message,
    });
    return false;
  }
}
