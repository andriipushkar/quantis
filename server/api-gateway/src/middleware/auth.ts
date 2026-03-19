import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../config/logger.js';

export interface AuthUser {
  id: string;
  email: string;
  tier: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid authorization header' });
      return;
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) {
      logger.error('JWT_ACCESS_SECRET is not configured');
      res.status(500).json({ error: 'Internal server error' });
      return;
    }

    const decoded = jwt.verify(token, secret) as AuthUser;
    req.user = {
      id: decoded.id,
      email: decoded.email,
      tier: decoded.tier,
    };

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' });
      return;
    }
    if (err instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    logger.error('Authentication error', { error: (err as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

const TIER_LEVELS: Record<string, number> = {
  starter: 1,
  trader: 2,
  pro: 3,
  institutional: 4,
};

export function requireTier(minTier: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const userLevel = TIER_LEVELS[req.user.tier] || 0;
    const requiredLevel = TIER_LEVELS[minTier] || 0;

    if (userLevel < requiredLevel) {
      res.status(403).json({
        error: 'Insufficient subscription tier',
        required: minTier,
        current: req.user.tier,
      });
      return;
    }

    next();
  };
}
