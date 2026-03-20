// ---------------------------------------------------------------------------
// Quantis Email Templates
// Dark theme with gold accents, responsive inline CSS
// ---------------------------------------------------------------------------

const BRAND_GOLD = '#D4A017';
const BRAND_GOLD_LIGHT = '#E8C547';
const BG_DARK = '#0F1117';
const BG_CARD = '#1A1D27';
const BG_SECTION = '#22252F';
const TEXT_WHITE = '#F1F1F1';
const TEXT_MUTED = '#9CA3AF';
const TEXT_GREEN = '#34D399';
const TEXT_RED = '#F87171';
const BORDER_COLOR = '#2D3041';

function baseLayout(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:${BG_DARK};font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:${BG_DARK};">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;background-color:${BG_CARD};border-radius:12px;overflow:hidden;border:1px solid ${BORDER_COLOR};">
          <!-- Gold Header -->
          <tr>
            <td style="background:linear-gradient(135deg,${BRAND_GOLD},${BRAND_GOLD_LIGHT});padding:24px 32px;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <div style="display:inline-block;width:40px;height:40px;line-height:40px;border-radius:10px;background-color:rgba(0,0,0,0.2);color:#000;font-weight:bold;font-size:20px;text-align:center;">Q</div>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:8px;">
                    <span style="font-size:22px;font-weight:700;color:#000;letter-spacing:1px;">QUANTIS</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid ${BORDER_COLOR};text-align:center;">
              <p style="margin:0;font-size:12px;color:${TEXT_MUTED};">
                &copy; ${new Date().getFullYear()} Quantis. All rights reserved.
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:${TEXT_MUTED};">
                This is an automated message. Please do not reply directly.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// 1. Welcome Email
// ---------------------------------------------------------------------------
export function welcomeEmail(userName: string): string {
  const content = `
    <h1 style="margin:0 0 8px;font-size:24px;color:${TEXT_WHITE};">Welcome to Quantis, ${userName}!</h1>
    <p style="margin:0 0 24px;font-size:15px;color:${TEXT_MUTED};line-height:1.6;">
      You've joined the next generation of crypto intelligence. Here are 3 quick steps to get started:
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
      <tr>
        <td style="padding:16px;background-color:${BG_SECTION};border-radius:8px;border-left:3px solid ${BRAND_GOLD};margin-bottom:12px;">
          <p style="margin:0;font-size:14px;color:${BRAND_GOLD};font-weight:600;">Step 1: Set Up Your Watchlist</p>
          <p style="margin:6px 0 0;font-size:13px;color:${TEXT_MUTED};line-height:1.5;">
            Add your favorite coins to track real-time prices, signals, and whale movements.
          </p>
        </td>
      </tr>
      <tr><td style="height:12px;"></td></tr>
      <tr>
        <td style="padding:16px;background-color:${BG_SECTION};border-radius:8px;border-left:3px solid ${BRAND_GOLD};">
          <p style="margin:0;font-size:14px;color:${BRAND_GOLD};font-weight:600;">Step 2: Enable AI Signals</p>
          <p style="margin:6px 0 0;font-size:13px;color:${TEXT_MUTED};line-height:1.5;">
            Turn on AI-powered signals to receive buy/sell alerts based on advanced technical analysis.
          </p>
        </td>
      </tr>
      <tr><td style="height:12px;"></td></tr>
      <tr>
        <td style="padding:16px;background-color:${BG_SECTION};border-radius:8px;border-left:3px solid ${BRAND_GOLD};">
          <p style="margin:0;font-size:14px;color:${BRAND_GOLD};font-weight:600;">Step 3: Explore the Academy</p>
          <p style="margin:6px 0 0;font-size:13px;color:${TEXT_MUTED};line-height:1.5;">
            Learn strategies from expert traders and earn XP as you level up your skills.
          </p>
        </td>
      </tr>
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center">
          <a href="#" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,${BRAND_GOLD},${BRAND_GOLD_LIGHT});color:#000;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
            Go to Dashboard
          </a>
        </td>
      </tr>
    </table>`;

  return baseLayout('Welcome to Quantis', content);
}

// ---------------------------------------------------------------------------
// 2. Signal Alert Email
// ---------------------------------------------------------------------------
export function signalAlertEmail(signal: { pair: string; type: string; entry: number; confidence: number }): string {
  const isBuy = signal.type.toLowerCase() === 'buy';
  const typeColor = isBuy ? TEXT_GREEN : TEXT_RED;
  const typeBg = isBuy ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)';

  const content = `
    <h1 style="margin:0 0 8px;font-size:24px;color:${TEXT_WHITE};">New Signal Alert</h1>
    <p style="margin:0 0 24px;font-size:15px;color:${TEXT_MUTED};line-height:1.6;">
      A new trading signal has been generated by Quantis AI.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:${BG_SECTION};border-radius:8px;border:1px solid ${BORDER_COLOR};margin-bottom:24px;">
      <tr>
        <td style="padding:20px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding-bottom:16px;">
                <span style="display:inline-block;padding:6px 16px;background-color:${typeBg};color:${typeColor};font-size:14px;font-weight:700;border-radius:6px;letter-spacing:1px;">
                  ${signal.type.toUpperCase()}
                </span>
              </td>
            </tr>
            <tr>
              <td>
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td width="50%" style="padding:8px 0;">
                      <p style="margin:0;font-size:12px;color:${TEXT_MUTED};">Pair</p>
                      <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:${TEXT_WHITE};">${signal.pair}</p>
                    </td>
                    <td width="50%" style="padding:8px 0;">
                      <p style="margin:0;font-size:12px;color:${TEXT_MUTED};">Entry Price</p>
                      <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:${TEXT_WHITE};">$${signal.entry.toLocaleString()}</p>
                    </td>
                  </tr>
                  <tr>
                    <td colspan="2" style="padding:8px 0;">
                      <p style="margin:0;font-size:12px;color:${TEXT_MUTED};">Confidence</p>
                      <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:${BRAND_GOLD};">${signal.confidence}%</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center">
          <a href="#" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,${BRAND_GOLD},${BRAND_GOLD_LIGHT});color:#000;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
            View Signal Details
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:24px 0 0;font-size:11px;color:${TEXT_MUTED};text-align:center;line-height:1.5;">
      This is not financial advice. Always do your own research before entering any trade.
    </p>`;

  return baseLayout(`New ${signal.type.toUpperCase()} Signal - ${signal.pair}`, content);
}

// ---------------------------------------------------------------------------
// 3. Weekly Report Email
// ---------------------------------------------------------------------------
export function weeklyReportEmail(data: { topMover: string; signalCount: number; portfolioChange: number }): string {
  const changeColor = data.portfolioChange >= 0 ? TEXT_GREEN : TEXT_RED;
  const changeSign = data.portfolioChange >= 0 ? '+' : '';

  const content = `
    <h1 style="margin:0 0 8px;font-size:24px;color:${TEXT_WHITE};">Your Weekly Summary</h1>
    <p style="margin:0 0 24px;font-size:15px;color:${TEXT_MUTED};line-height:1.6;">
      Here's how your portfolio performed this week.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
      <tr>
        <td width="33%" style="padding:4px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:${BG_SECTION};border-radius:8px;border:1px solid ${BORDER_COLOR};">
            <tr>
              <td style="padding:16px;text-align:center;">
                <p style="margin:0;font-size:11px;color:${TEXT_MUTED};text-transform:uppercase;letter-spacing:0.5px;">Top Mover</p>
                <p style="margin:8px 0 0;font-size:18px;font-weight:700;color:${BRAND_GOLD};">${data.topMover}</p>
              </td>
            </tr>
          </table>
        </td>
        <td width="33%" style="padding:4px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:${BG_SECTION};border-radius:8px;border:1px solid ${BORDER_COLOR};">
            <tr>
              <td style="padding:16px;text-align:center;">
                <p style="margin:0;font-size:11px;color:${TEXT_MUTED};text-transform:uppercase;letter-spacing:0.5px;">Signals</p>
                <p style="margin:8px 0 0;font-size:18px;font-weight:700;color:${TEXT_WHITE};">${data.signalCount}</p>
              </td>
            </tr>
          </table>
        </td>
        <td width="33%" style="padding:4px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:${BG_SECTION};border-radius:8px;border:1px solid ${BORDER_COLOR};">
            <tr>
              <td style="padding:16px;text-align:center;">
                <p style="margin:0;font-size:11px;color:${TEXT_MUTED};text-transform:uppercase;letter-spacing:0.5px;">Portfolio</p>
                <p style="margin:8px 0 0;font-size:18px;font-weight:700;color:${changeColor};">${changeSign}${data.portfolioChange}%</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center">
          <a href="#" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,${BRAND_GOLD},${BRAND_GOLD_LIGHT});color:#000;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
            View Full Report
          </a>
        </td>
      </tr>
    </table>`;

  return baseLayout('Your Quantis Weekly Report', content);
}

// ---------------------------------------------------------------------------
// 4. Password Reset Email
// ---------------------------------------------------------------------------
export function passwordResetEmail(resetLink: string): string {
  const content = `
    <h1 style="margin:0 0 8px;font-size:24px;color:${TEXT_WHITE};">Reset Your Password</h1>
    <p style="margin:0 0 24px;font-size:15px;color:${TEXT_MUTED};line-height:1.6;">
      We received a request to reset your password. Click the button below to create a new one.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
      <tr>
        <td align="center">
          <a href="${resetLink}" style="display:inline-block;padding:14px 40px;background:linear-gradient(135deg,${BRAND_GOLD},${BRAND_GOLD_LIGHT});color:#000;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
            Reset Password
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 16px;font-size:13px;color:${TEXT_MUTED};line-height:1.6;">
      If the button doesn't work, copy and paste this link into your browser:
    </p>
    <p style="margin:0 0 24px;font-size:12px;color:${BRAND_GOLD};word-break:break-all;line-height:1.5;">
      ${resetLink}
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:${BG_SECTION};border-radius:8px;border:1px solid ${BORDER_COLOR};">
      <tr>
        <td style="padding:16px;">
          <p style="margin:0;font-size:12px;color:${TEXT_MUTED};line-height:1.5;">
            This link will expire in 1 hour. If you did not request a password reset, please ignore this email or contact support if you have concerns.
          </p>
        </td>
      </tr>
    </table>`;

  return baseLayout('Reset Your Password - Quantis', content);
}

// ---------------------------------------------------------------------------
// 5. Payment Confirmation Email
// ---------------------------------------------------------------------------
export function paymentConfirmEmail(data: { tier: string; amount: number; txHash: string }): string {
  const content = `
    <h1 style="margin:0 0 8px;font-size:24px;color:${TEXT_WHITE};">Payment Confirmed</h1>
    <p style="margin:0 0 24px;font-size:15px;color:${TEXT_MUTED};line-height:1.6;">
      Your subscription payment has been successfully processed.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:${BG_SECTION};border-radius:8px;border:1px solid ${BORDER_COLOR};margin-bottom:24px;">
      <tr>
        <td style="padding:20px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid ${BORDER_COLOR};">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="font-size:13px;color:${TEXT_MUTED};">Plan</td>
                    <td align="right" style="font-size:14px;font-weight:600;color:${BRAND_GOLD};text-transform:capitalize;">${data.tier}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid ${BORDER_COLOR};">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="font-size:13px;color:${TEXT_MUTED};">Amount</td>
                    <td align="right" style="font-size:14px;font-weight:600;color:${TEXT_WHITE};">$${data.amount.toFixed(2)}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="font-size:13px;color:${TEXT_MUTED};">Transaction</td>
                    <td align="right" style="font-size:12px;font-weight:500;color:${TEXT_MUTED};font-family:monospace;word-break:break-all;">${data.txHash}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <div style="text-align:center;padding:16px;background-color:rgba(52,211,153,0.08);border-radius:8px;border:1px solid rgba(52,211,153,0.2);margin-bottom:24px;">
      <p style="margin:0;font-size:14px;color:${TEXT_GREEN};font-weight:600;">
        Your ${data.tier} plan is now active!
      </p>
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center">
          <a href="#" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,${BRAND_GOLD},${BRAND_GOLD_LIGHT});color:#000;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
            Explore Premium Features
          </a>
        </td>
      </tr>
    </table>`;

  return baseLayout('Payment Confirmed - Quantis', content);
}
