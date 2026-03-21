import { Router, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { env } from '../config/env.js';
import {
  welcomeEmail,
  signalAlertEmail,
  weeklyReportEmail,
  passwordResetEmail,
  paymentConfirmEmail,
} from '../utils/email-templates.js';
import logger from '../config/logger.js';

const router = Router();

// Admin check middleware
function requireAdmin(req: AuthenticatedRequest, res: Response, next: () => void): void {
  const adminEmails = env.ADMIN_EMAILS;
  if (!req.user || !adminEmails.includes(req.user.email.toLowerCase())) {
    res.status(403).json({ success: false, error: 'Admin access required' });
    return;
  }
  next();
}

// All routes require auth + admin
router.use(authenticate);
router.use(requireAdmin);

// Mock data for template previews
const MOCK_DATA = {
  welcome: { userName: 'CryptoTrader42' },
  signal: { pair: 'BTC/USDT', type: 'BUY', entry: 87450.25, confidence: 82 },
  weekly: { topMover: 'SOL (+18.5%)', signalCount: 47, portfolioChange: 5.3 },
  reset: { resetLink: 'https://quantis.app/reset-password?token=mock-token-abc123' },
  payment: { tier: 'Pro', amount: 49.99, txHash: '0x7a3b...f92e1c8d' },
};

type TemplateKey = 'welcome' | 'signal' | 'weekly' | 'reset' | 'payment';

const TEMPLATE_GENERATORS: Record<TemplateKey, () => string> = {
  welcome: () => welcomeEmail(MOCK_DATA.welcome.userName),
  signal: () => signalAlertEmail(MOCK_DATA.signal),
  weekly: () => weeklyReportEmail(MOCK_DATA.weekly),
  reset: () => passwordResetEmail(MOCK_DATA.reset.resetLink),
  payment: () => paymentConfirmEmail(MOCK_DATA.payment),
};

// POST /preview/:template — Preview email template with mock data
router.post('/preview/:template', (req: AuthenticatedRequest, res: Response) => {
  try {
    const template = req.params.template as TemplateKey;

    if (!TEMPLATE_GENERATORS[template]) {
      res.status(400).json({
        success: false,
        error: `Unknown template. Available: ${Object.keys(TEMPLATE_GENERATORS).join(', ')}`,
      });
      return;
    }

    const html = TEMPLATE_GENERATORS[template]();
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    logger.error('Email preview error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Failed to generate preview' });
  }
});

// POST /send-test — Send test email (requires SMTP configured)
router.post('/send-test', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { template, to } = req.body;

    if (!template || !to) {
      res.status(400).json({ success: false, error: 'Missing required fields: template, to' });
      return;
    }

    if (!TEMPLATE_GENERATORS[template as TemplateKey]) {
      res.status(400).json({
        success: false,
        error: `Unknown template. Available: ${Object.keys(TEMPLATE_GENERATORS).join(', ')}`,
      });
      return;
    }

    // Check if SMTP is configured
    if (!env.SMTP_HOST || !env.SMTP_USER) {
      res.status(503).json({
        success: false,
        error: 'SMTP not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS environment variables.',
      });
      return;
    }

    // In a real implementation, this would send the email via nodemailer or similar
    logger.info('Test email requested', { template, to, admin: req.user!.email });

    res.json({
      success: true,
      message: `Test email "${template}" would be sent to ${to}. SMTP integration pending.`,
    });
  } catch (err) {
    logger.error('Email send-test error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Failed to send test email' });
  }
});

export default router;
