import { Router, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';
import logger from '../config/logger.js';

const router = Router();

// --- Types ---
interface TokenHolding {
  token: string;
  amount: number;
  valueUsd: number;
  change24h: number;
}

// Mock token data by chain
const MOCK_TOKENS: Record<string, { token: string; priceRange: [number, number]; amountRange: [number, number] }[]> = {
  ethereum: [
    { token: 'ETH', priceRange: [2800, 3600], amountRange: [0.5, 15] },
    { token: 'USDC', priceRange: [0.999, 1.001], amountRange: [500, 50000] },
    { token: 'LINK', priceRange: [12, 22], amountRange: [50, 1000] },
    { token: 'UNI', priceRange: [6, 14], amountRange: [20, 500] },
    { token: 'AAVE', priceRange: [80, 180], amountRange: [2, 40] },
  ],
  solana: [
    { token: 'SOL', priceRange: [120, 200], amountRange: [5, 200] },
    { token: 'USDC', priceRange: [0.999, 1.001], amountRange: [200, 30000] },
    { token: 'RAY', priceRange: [1.5, 5], amountRange: [100, 5000] },
    { token: 'JTO', priceRange: [2, 6], amountRange: [50, 2000] },
    { token: 'BONK', priceRange: [0.00001, 0.00005], amountRange: [1000000, 50000000] },
  ],
  bitcoin: [
    { token: 'BTC', priceRange: [60000, 95000], amountRange: [0.01, 2] },
    { token: 'ORDI', priceRange: [20, 70], amountRange: [5, 100] },
    { token: 'SATS', priceRange: [0.0000003, 0.000001], amountRange: [10000000, 500000000] },
  ],
};

function generateHoldings(chain: string, addressSeed: string): TokenHolding[] {
  const tokens = MOCK_TOKENS[chain] || MOCK_TOKENS.ethereum;
  // Use address as seed for deterministic but varied results
  let seed = 0;
  for (let i = 0; i < addressSeed.length; i++) {
    seed = ((seed << 5) - seed + addressSeed.charCodeAt(i)) | 0;
  }
  const rng = () => {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed & 0x7fffffff) / 0x7fffffff;
  };

  const count = 3 + Math.floor(rng() * Math.min(3, tokens.length - 2));
  const shuffled = [...tokens].sort(() => rng() - 0.5).slice(0, count);

  return shuffled.map((t) => {
    const price = t.priceRange[0] + rng() * (t.priceRange[1] - t.priceRange[0]);
    const amount = t.amountRange[0] + rng() * (t.amountRange[1] - t.amountRange[0]);
    const valueUsd = Math.round(price * amount * 100) / 100;
    const change24h = Math.round((rng() * 20 - 8) * 100) / 100;
    return {
      token: t.token,
      amount: Math.round(amount * 100000) / 100000,
      valueUsd,
      change24h,
    };
  });
}

// All routes require auth
router.use(authenticate);

// POST /track — Add wallet to track
router.post('/track', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { address, chain, label } = req.body;

    if (!address || !chain) {
      res.status(400).json({ success: false, error: 'Missing required fields: address, chain' });
      return;
    }

    const validChains = ['ethereum', 'solana', 'bitcoin'];
    if (!validChains.includes(chain)) {
      res.status(400).json({ success: false, error: `Invalid chain. Must be one of: ${validChains.join(', ')}` });
      return;
    }

    // Check for duplicates per user (UNIQUE constraint will also catch this)
    const existing = await query(
      `SELECT id FROM tracked_wallets WHERE user_id = $1 AND LOWER(address) = LOWER($2) AND chain = $3`,
      [req.user!.id, address, chain]
    );

    if (existing.rows.length > 0) {
      res.status(409).json({ success: false, error: 'Wallet already tracked' });
      return;
    }

    const result = await query(
      `INSERT INTO tracked_wallets (user_id, address, chain, label)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.user!.id, address, chain, label || null]
    );

    const r = result.rows[0];
    res.status(201).json({
      success: true,
      data: {
        id: r.id,
        userId: r.user_id,
        address: r.address,
        chain: r.chain,
        label: r.label || undefined,
        addedAt: r.added_at.toISOString(),
      },
    });
  } catch (err) {
    logger.error('Wallet track error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Failed to track wallet' });
  }
});

// GET / — List tracked wallets
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM tracked_wallets WHERE user_id = $1 ORDER BY added_at DESC`,
      [req.user!.id]
    );

    const withTotals = result.rows.map((r: Record<string, unknown>) => {
      const chain = r.chain as string;
      const address = r.address as string;
      const holdings = generateHoldings(chain, address);
      const totalValue = holdings.reduce((sum, h) => sum + h.valueUsd, 0);
      return {
        id: r.id as string,
        userId: r.user_id as string,
        address,
        chain,
        label: (r.label as string) || undefined,
        addedAt: (r.added_at as Date).toISOString(),
        totalValue: Math.round(totalValue * 100) / 100,
      };
    });

    res.json({ success: true, data: withTotals });
  } catch (err) {
    logger.error('Wallet list error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Failed to list wallets' });
  }
});

// DELETE /:id — Remove tracked wallet
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `DELETE FROM tracked_wallets WHERE id = $1 AND user_id = $2 RETURNING id`,
      [req.params.id, req.user!.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Wallet not found' });
      return;
    }

    res.json({ success: true, message: 'Wallet removed' });
  } catch (err) {
    logger.error('Wallet delete error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Failed to remove wallet' });
  }
});

// GET /:address/balance — Get mock balance data
router.get('/:address/balance', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { address } = req.params;
    const chain = (req.query.chain as string) || 'ethereum';

    const holdings = generateHoldings(chain, address);
    const totalValue = holdings.reduce((sum, h) => sum + h.valueUsd, 0);

    res.json({
      success: true,
      data: {
        address,
        chain,
        holdings,
        totalValue: Math.round(totalValue * 100) / 100,
      },
    });
  } catch (err) {
    logger.error('Wallet balance error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Failed to fetch balance' });
  }
});

export default router;
