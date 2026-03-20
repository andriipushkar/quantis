import { z, ZodSchema } from 'zod';
import { Request, Response, NextFunction } from 'express';

/**
 * Express middleware factory that validates req.body against a Zod schema.
 * On success the parsed (and potentially transformed/defaulted) data replaces
 * req.body so downstream handlers always work with clean, typed data.
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: result.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

/**
 * Express middleware factory that validates req.query against a Zod schema.
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: result.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      });
      return;
    }
    req.query = result.data;
    next();
  };
}

/**
 * Express middleware factory that validates req.params against a Zod schema.
 */
export function validateParams(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: result.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      });
      return;
    }
    req.params = result.data;
    next();
  };
}

// ---------------------------------------------------------------------------
// Reusable schemas for key API endpoints
// ---------------------------------------------------------------------------

export const symbolParamSchema = z.object({
  symbol: z
    .string()
    .min(2)
    .max(20)
    .regex(/^[A-Z0-9]+$/, 'Invalid symbol format'),
});

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(5000).optional().default(500),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const timeframeSchema = z.object({
  timeframe: z
    .enum(['1m', '5m', '15m', '1h', '4h', '1d'])
    .optional()
    .default('1m'),
});

export const alertCreateSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  conditions: z.object({
    type: z.enum([
      'price_above',
      'price_below',
      'rsi_above',
      'rsi_below',
      'price_change_pct',
    ]),
    symbol: z.string().min(2).max(20),
    value: z.number().finite(),
  }),
  channels: z
    .array(z.enum(['push', 'email', 'telegram']))
    .min(1),
});

export const orderSchema = z.object({
  symbol: z.string().min(2).max(20),
  side: z.enum(['buy', 'sell']),
  quantity: z.number().positive().finite(),
});

export const journalEntrySchema = z.object({
  pair: z.string().min(2).max(20),
  direction: z.enum(['long', 'short']),
  entryPrice: z.number().positive(),
  exitPrice: z.number().positive().optional(),
  size: z.number().positive(),
  strategy: z.string().max(50).optional(),
  emotional_state: z
    .enum(['calm', 'fomo', 'revenge', 'greedy', 'fearful'])
    .optional(),
  confidence: z.number().int().min(1).max(5).optional(),
  notes: z.string().max(1000).optional(),
  timeframe: z.string().max(5).optional(),
});

export const copilotSchema = z.object({
  question: z.string().min(1).max(500).trim(),
  symbol: z.string().min(2).max(20).optional(),
});

export const socialPostSchema = z.object({
  type: z.enum(['trade_idea', 'analysis', 'comment']),
  content: z.string().min(1).max(2000).trim(),
  symbol: z.string().max(20).optional(),
  direction: z.enum(['bullish', 'bearish', 'neutral']).optional(),
});
