import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';
import logger from '../config/logger.js';
import { authenticate, AuthenticatedRequest, AuthUser } from '../middleware/auth.js';
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
} from '../validators/auth.js';

const router = Router();

function generateAccessToken(user: { id: string; email: string; tier: string }): string {
  const secret = process.env.JWT_ACCESS_SECRET!;
  const expiresIn = process.env.JWT_ACCESS_EXPIRY || '15m';
  return jwt.sign({ id: user.id, email: user.email, tier: user.tier }, secret, { expiresIn });
}

function generateRefreshToken(user: { id: string; email: string; tier: string }): string {
  const secret = process.env.JWT_REFRESH_SECRET!;
  const expiresIn = process.env.JWT_REFRESH_EXPIRY || '7d';
  return jwt.sign({ id: user.id, email: user.email, tier: user.tier }, secret, { expiresIn });
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

    const passwordHash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS || '12'));

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

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
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
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
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

    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) {
      res.status(500).json({ success: false, error: 'Internal server error' });
      return;
    }

    let decoded: AuthUser;
    try {
      decoded = jwt.verify(token, secret) as AuthUser;
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
      secure: process.env.NODE_ENV === 'production',
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

    res.json({ success: true, data: result.rows[0] });
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

    const valid = await bcrypt.compare(oldPassword, result.rows[0].password_hash);
    if (!valid) {
      res.status(401).json({ success: false, error: 'Current password is incorrect' });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS || '12'));
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

export default router;
