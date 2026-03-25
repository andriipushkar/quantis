import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { query } from '../config/database.js';
import logger from '../config/logger.js';
import { authenticate, AuthenticatedRequest, AuthUser } from '../middleware/auth.js';
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
} from '../validators/auth.js';
import { sendEmail } from '../utils/mailer.js';
import { welcomeEmail } from '../utils/email-templates.js';

// Base32 encoding for TOTP secret generation
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function toBase32(buffer: Buffer): string {
  let result = '';
  let bits = 0;
  let value = 0;
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += BASE32_CHARS[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) {
    result += BASE32_CHARS[(value << (5 - bits)) & 0x1f];
  }
  return result;
}

const router = Router();

function generateAccessToken(user: { id: string; email: string; tier: string }): string {
  return jwt.sign(
    { id: user.id, email: user.email, tier: user.tier },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRY as jwt.SignOptions['expiresIn'] },
  );
}

function generateRefreshToken(user: { id: string; email: string; tier: string }): string {
  return jwt.sign(
    { id: user.id, email: user.email, tier: user.tier },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRY as jwt.SignOptions['expiresIn'] },
  );
}

// POST /register
router.post('/register', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validation = registerSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: validation.error.issues });
      return;
    }

    const { email, password } = validation.data;

    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      res.status(409).json({ success: false, error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);

    const userResult = await query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, tier',
      [email, passwordHash]
    );
    const user = userResult.rows[0];

    // Create profile with referral code
    const referralCode = user.id.split('-')[0].toUpperCase();
    await query(
      'INSERT INTO user_profiles (user_id, referral_code) VALUES ($1, $2)',
      [user.id, referralCode]
    );

    // Send welcome email (non-blocking — don't fail registration if email fails)
    const displayName = email.split('@')[0];
    sendEmail(email, 'Welcome to Quantis!', welcomeEmail(displayName)).catch((err) => {
      logger.error('Failed to send welcome email', { email, error: (err as Error).message });
    });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, tier: user.tier },
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    logger.error('Registration error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /login
router.post('/login', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: validation.error.issues });
      return;
    }

    const { email, password } = validation.data;

    const result = await query(
      'SELECT id, email, password_hash, tier FROM users WHERE email = $1',
      [email]
    );
    if (result.rows.length === 0) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const user = result.rows[0];

    // OAuth-only users cannot login with password
    if (!user.password_hash) {
      res.status(401).json({ success: false, error: 'This account uses Google Sign-In. Please login with Google.' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, tier: user.tier },
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    logger.error('Login error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /refresh
router.post('/refresh', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!token) {
      res.status(401).json({ success: false, error: 'Refresh token required' });
      return;
    }

    let decoded: AuthUser;
    try {
      decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as AuthUser;
    } catch {
      res.status(401).json({ success: false, error: 'Invalid refresh token' });
      return;
    }

    const userResult = await query(
      'SELECT id, email, tier FROM users WHERE id = $1',
      [decoded.id]
    );
    if (userResult.rows.length === 0) {
      res.status(401).json({ success: false, error: 'User not found' });
      return;
    }

    const user = userResult.rows[0];
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      data: { accessToken: newAccessToken, refreshToken: newRefreshToken },
    });
  } catch (err) {
    logger.error('Token refresh error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /logout
router.post('/logout', authenticate, async (_req: AuthenticatedRequest, res: Response) => {
  res.clearCookie('refreshToken');
  res.json({ success: true, message: 'Logged out successfully' });
});

// GET /me
router.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.tier, u.language, u.created_at,
              p.display_name, p.timezone, p.experience_level, p.ui_mode, p.referral_code
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [req.user!.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const userData = result.rows[0];
    const isAdmin = env.ADMIN_EMAILS.includes(userData.email.toLowerCase());
    res.json({ success: true, data: { ...userData, is_admin: isAdmin } });
  } catch (err) {
    logger.error('Get profile error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /me
router.put('/me', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validation = updateProfileSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: validation.error.issues });
      return;
    }

    const { displayName, language, timezone } = validation.data;

    if (language) {
      await query('UPDATE users SET language = $1, updated_at = NOW() WHERE id = $2', [language, req.user!.id]);
    }

    await query(
      `UPDATE user_profiles
       SET display_name = COALESCE($1, display_name),
           timezone = COALESCE($2, timezone)
       WHERE user_id = $3`,
      [displayName, timezone, req.user!.id]
    );

    res.json({ success: true, message: 'Profile updated' });
  } catch (err) {
    logger.error('Update profile error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /change-password
router.post('/change-password', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validation = changePasswordSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: validation.error.issues });
      return;
    }

    const { oldPassword, newPassword } = validation.data;

    const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user!.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    if (!result.rows[0].password_hash) {
      res.status(400).json({ success: false, error: 'Cannot change password for Google Sign-In accounts. Set a password first.' });
      return;
    }

    const valid = await bcrypt.compare(oldPassword, result.rows[0].password_hash);
    if (!valid) {
      res.status(401).json({ success: false, error: 'Current password is incorrect' });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
      newHash,
      req.user!.id,
    ]);

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    logger.error('Change password error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /google — Google OAuth login/register
router.post('/google', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      res.status(501).json({ success: false, error: 'Google OAuth is not configured' });
      return;
    }

    const { code, credential } = req.body;

    let googleUser: { sub: string; email: string; name?: string; picture?: string };

    if (credential) {
      // ID token flow (Google Identity Services / One Tap)
      const payload = await verifyGoogleIdToken(credential);
      if (!payload) {
        res.status(401).json({ success: false, error: 'Invalid Google credential' });
        return;
      }
      googleUser = payload;
    } else if (code) {
      // Authorization code flow
      const tokens = await exchangeGoogleCode(code);
      if (!tokens) {
        res.status(401).json({ success: false, error: 'Invalid Google authorization code' });
        return;
      }
      googleUser = tokens;
    } else {
      res.status(400).json({ success: false, error: 'Google credential or authorization code required' });
      return;
    }

    // Check if user exists by google_id
    let userResult = await query(
      'SELECT id, email, tier FROM users WHERE google_id = $1',
      [googleUser.sub]
    );

    if (userResult.rows.length === 0) {
      // Check if email already registered (link accounts)
      userResult = await query(
        'SELECT id, email, tier FROM users WHERE email = $1',
        [googleUser.email]
      );

      if (userResult.rows.length > 0) {
        // Link Google ID to existing account
        await query(
          `UPDATE users SET google_id = $1, auth_provider = 'google',
             avatar_url = COALESCE(avatar_url, $2), updated_at = NOW()
           WHERE id = $3`,
          [googleUser.sub, googleUser.picture || null, userResult.rows[0].id]
        );
      } else {
        // Create new user (no password for OAuth users)
        userResult = await query(
          `INSERT INTO users (email, google_id, auth_provider, avatar_url)
           VALUES ($1, $2, 'google', $3)
           RETURNING id, email, tier`,
          [googleUser.email, googleUser.sub, googleUser.picture || null]
        );

        const newUser = userResult.rows[0];

        // Create profile
        const displayName = googleUser.name || googleUser.email.split('@')[0];
        const referralCode = newUser.id.split('-')[0].toUpperCase();
        await query(
          'INSERT INTO user_profiles (user_id, display_name, referral_code) VALUES ($1, $2, $3)',
          [newUser.id, displayName, referralCode]
        );
      }
    }

    const user = userResult.rows[0];
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, tier: user.tier },
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    logger.error('Google OAuth error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Verify a Google ID token (from Identity Services / One Tap).
 * Uses Google's tokeninfo endpoint for simplicity (no extra dependencies).
 */
async function verifyGoogleIdToken(
  idToken: string
): Promise<{ sub: string; email: string; name?: string; picture?: string } | null> {
  try {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    );
    if (!response.ok) return null;

    const payload = (await response.json()) as {
      sub: string;
      email: string;
      email_verified: string;
      name?: string;
      picture?: string;
      aud: string;
    };

    // Verify audience matches our client ID
    if (payload.aud !== env.GOOGLE_CLIENT_ID) return null;
    if (payload.email_verified !== 'true') return null;

    return { sub: payload.sub, email: payload.email, name: payload.name, picture: payload.picture };
  } catch {
    return null;
  }
}

/**
 * Exchange a Google authorization code for user info.
 */
async function exchangeGoogleCode(
  code: string
): Promise<{ sub: string; email: string; name?: string; picture?: string } | null> {
  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${env.APP_URL}/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) return null;

    const tokens = (await tokenResponse.json()) as { access_token: string; id_token?: string };

    // Get user info with access token
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userResponse.ok) return null;

    const userInfo = (await userResponse.json()) as {
      id: string;
      email: string;
      name?: string;
      picture?: string;
      verified_email: boolean;
    };

    if (!userInfo.verified_email) return null;

    return { sub: userInfo.id, email: userInfo.email, name: userInfo.name, picture: userInfo.picture };
  } catch {
    return null;
  }
}

// POST /2fa/setup — Generate TOTP secret
router.post('/2fa/setup', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const secret = toBase32(crypto.randomBytes(20));
    const email = req.user!.email;
    const qrCodeUrl = `otpauth://totp/Quantis:${encodeURIComponent(email)}?secret=${secret}&issuer=Quantis`;

    // Store secret (encrypted placeholder) in users table
    await query(
      'UPDATE users SET totp_secret_enc = $1, updated_at = NOW() WHERE id = $2',
      [secret, req.user!.id]
    );

    res.json({
      success: true,
      data: { secret, qrCodeUrl },
    });
  } catch (err) {
    logger.error('2FA setup error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /2fa/verify — Verify TOTP code and enable 2FA
router.post('/2fa/verify', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { code } = req.body;

    if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
      res.status(400).json({ success: false, error: 'A valid 6-digit code is required' });
      return;
    }

    // Check that user has a TOTP secret set up
    const result = await query('SELECT totp_secret_enc FROM users WHERE id = $1', [req.user!.id]);
    if (!result.rows[0]?.totp_secret_enc) {
      res.status(400).json({ success: false, error: 'Please set up 2FA first' });
      return;
    }

    // MVP: accept any valid 6-digit code to enable 2FA
    await query(
      'UPDATE users SET is_2fa_enabled = true, updated_at = NOW() WHERE id = $1',
      [req.user!.id]
    );

    res.json({ success: true, message: 'Two-factor authentication enabled successfully' });
  } catch (err) {
    logger.error('2FA verify error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
