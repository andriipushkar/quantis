import { Router, Response } from 'express';
import redis from '../config/redis.js';
import logger from '../config/logger.js';
import { query } from '../config/database.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { validateBody, orderSchema } from '../validators/index.js';

const router = Router();

// --- Helpers ---

/** Map API side ('buy'/'sell') to DB side ('long'/'short') */
function toDbSide(side: string): string {
  return side === 'buy' ? 'long' : 'short';
}

/** Map DB side ('long'/'short') to API side ('buy'/'sell') */
function toApiSide(side: string): string {
  return side === 'long' ? 'buy' : 'sell';
}

/** Ensure a paper account row exists, return the account */
async function getOrCreateAccount(userId: string) {
  const existing = await query('SELECT * FROM paper_accounts WHERE user_id = $1', [userId]);
  if (existing.rows.length > 0) {
    return existing.rows[0];
  }
  const inserted = await query(
    'INSERT INTO paper_accounts (user_id, balance, equity, realized_pnl) VALUES ($1, 10000, 10000, 0) RETURNING *',
    [userId],
  );
  return inserted.rows[0];
}

/** Fetch ticker from Redis */
async function getTickerPrice(symbol: string): Promise<number | null> {
  const exchanges = ['binance', 'bybit', 'okx'];
  for (const exchange of exchanges) {
    const data = await redis.get(`ticker:${exchange}:${symbol}`);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        return parsed.price ?? null;
      } catch {
        /* skip */
      }
    }
  }
  return null;
}

// GET /account — Returns virtual account summary
router.get('/account', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const account = await getOrCreateAccount(userId);

    // Calculate unrealized P&L from open positions
    const positionsResult = await query('SELECT * FROM paper_positions WHERE user_id = $1', [userId]);
    let unrealizedPnl = 0;
    for (const pos of positionsResult.rows) {
      const currentPrice = await getTickerPrice(pos.symbol);
      if (currentPrice !== null) {
        if (pos.side === 'long') {
          unrealizedPnl += (currentPrice - Number(pos.entry_price)) * Number(pos.quantity);
        } else {
          unrealizedPnl += (Number(pos.entry_price) - currentPrice) * Number(pos.quantity);
        }
      }
    }

    const balance = Number(account.balance);
    const realizedPnl = Number(account.realized_pnl);
    const equity = balance + unrealizedPnl;

    res.json({
      success: true,
      data: {
        balance: Math.round(balance * 100) / 100,
        equity: Math.round(equity * 100) / 100,
        unrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
        realizedPnl: Math.round(realizedPnl * 100) / 100,
        positionsCount: positionsResult.rows.length,
      },
    });
  } catch (err) {
    logger.error('Paper account error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /order — Place a paper trade order
router.post('/order', authenticate, validateBody(orderSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { symbol: rawSymbol, side, quantity: usdAmount } = req.body;
    const userId = req.user!.id;

    const symbol = rawSymbol.toUpperCase();
    const currentPrice = await getTickerPrice(symbol);
    if (currentPrice === null) {
      res.status(404).json({ success: false, error: `No ticker data found for ${symbol}` });
      return;
    }

    const account = await getOrCreateAccount(userId);
    const balance = Number(account.balance);

    if (usdAmount > balance) {
      res.status(400).json({ success: false, error: 'Insufficient balance' });
      return;
    }

    const assetQuantity = usdAmount / currentPrice;
    const dbSide = toDbSide(side);

    // Check if there's an existing position for this symbol
    const existingResult = await query(
      'SELECT * FROM paper_positions WHERE user_id = $1 AND symbol = $2',
      [userId, symbol],
    );

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];
      if (existing.side !== dbSide) {
        // Close existing position (opposite direction)
        const existingQty = Number(existing.quantity);
        const existingEntryPrice = Number(existing.entry_price);
        const existingAmount = existingEntryPrice * existingQty;

        let pnl: number;
        if (existing.side === 'long') {
          pnl = (currentPrice - existingEntryPrice) * existingQty;
        } else {
          pnl = (existingEntryPrice - currentPrice) * existingQty;
        }

        const pnlRounded = Math.round(pnl * 100) / 100;
        const pnlPercent = existingAmount > 0 ? (pnl / existingAmount) * 100 : 0;

        // Insert into trade history
        await query(
          `INSERT INTO paper_trades (user_id, symbol, side, quantity, entry_price, exit_price, pnl, pnl_percent, opened_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [userId, symbol, existing.side, existingQty, existingEntryPrice, currentPrice, pnlRounded, Math.round(pnlPercent * 100) / 100, existing.opened_at],
        );

        // Delete old position
        await query('DELETE FROM paper_positions WHERE id = $1', [existing.id]);

        // Update balance: return old position value + pnl, then deduct new order
        const newBalance = balance + existingAmount + pnl - usdAmount;
        await query(
          'UPDATE paper_accounts SET balance = $1, realized_pnl = realized_pnl + $2, updated_at = NOW() WHERE user_id = $3',
          [newBalance, pnlRounded, userId],
        );

        // Open new position
        await query(
          `INSERT INTO paper_positions (user_id, symbol, side, quantity, entry_price, current_price, opened_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [userId, symbol, dbSide, assetQuantity, currentPrice, currentPrice],
        );

        res.json({
          success: true,
          data: {
            action: 'closed_and_opened',
            closedPnl: pnlRounded,
            order: {
              symbol,
              side,
              entryPrice: currentPrice,
              quantity: assetQuantity,
              amount: usdAmount,
            },
            balance: Math.round(newBalance * 100) / 100,
          },
        });
        return;
      }
    }

    // Open new position (or add alongside existing same-direction)
    const newBalance = balance - usdAmount;
    await query(
      'UPDATE paper_accounts SET balance = $1, updated_at = NOW() WHERE user_id = $2',
      [newBalance, userId],
    );

    await query(
      `INSERT INTO paper_positions (user_id, symbol, side, quantity, entry_price, current_price, opened_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [userId, symbol, dbSide, assetQuantity, currentPrice, currentPrice],
    );

    res.json({
      success: true,
      data: {
        action: 'opened',
        order: {
          symbol,
          side,
          entryPrice: currentPrice,
          quantity: assetQuantity,
          amount: usdAmount,
        },
        balance: Math.round(newBalance * 100) / 100,
      },
    });
  } catch (err) {
    logger.error('Paper order error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /positions — List open positions with current P&L
router.get('/positions', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const positionsResult = await query('SELECT * FROM paper_positions WHERE user_id = $1', [userId]);

    const positions = [];
    for (const pos of positionsResult.rows) {
      const entryPrice = Number(pos.entry_price);
      const qty = Number(pos.quantity);
      const amount = entryPrice * qty;
      const currentPrice = await getTickerPrice(pos.symbol);
      let pnl = 0;
      let pnlPct = 0;
      if (currentPrice !== null) {
        if (pos.side === 'long') {
          pnl = (currentPrice - entryPrice) * qty;
        } else {
          pnl = (entryPrice - currentPrice) * qty;
        }
        pnlPct = amount > 0 ? (pnl / amount) * 100 : 0;
      }

      positions.push({
        symbol: pos.symbol,
        side: toApiSide(pos.side),
        entryPrice,
        currentPrice: currentPrice ?? entryPrice,
        quantity: qty,
        amount,
        pnl: Math.round(pnl * 100) / 100,
        pnlPct: Math.round(pnlPct * 100) / 100,
        openedAt: pos.opened_at.toISOString(),
      });
    }

    res.json({ success: true, data: positions });
  } catch (err) {
    logger.error('Paper positions error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /close/:symbol — Close position at current market price
router.post('/close/:symbol', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const userId = req.user!.id;

    const posResult = await query(
      'SELECT * FROM paper_positions WHERE user_id = $1 AND symbol = $2',
      [userId, symbol],
    );

    if (posResult.rows.length === 0) {
      res.status(404).json({ success: false, error: `No open position for ${symbol}` });
      return;
    }

    const pos = posResult.rows[0];
    const currentPrice = await getTickerPrice(symbol);
    if (currentPrice === null) {
      res.status(404).json({ success: false, error: `No ticker data found for ${symbol}` });
      return;
    }

    const entryPrice = Number(pos.entry_price);
    const qty = Number(pos.quantity);
    const amount = entryPrice * qty;

    let pnl: number;
    if (pos.side === 'long') {
      pnl = (currentPrice - entryPrice) * qty;
    } else {
      pnl = (entryPrice - currentPrice) * qty;
    }

    const pnlRounded = Math.round(pnl * 100) / 100;
    const pnlPercent = amount > 0 ? Math.round(((pnl / amount) * 100) * 100) / 100 : 0;

    // Insert trade history record
    await query(
      `INSERT INTO paper_trades (user_id, symbol, side, quantity, entry_price, exit_price, pnl, pnl_percent, opened_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [userId, symbol, pos.side, qty, entryPrice, currentPrice, pnlRounded, pnlPercent, pos.opened_at],
    );

    // Delete closed position
    await query('DELETE FROM paper_positions WHERE id = $1', [pos.id]);

    // Update account balance and realized PnL
    const account = await getOrCreateAccount(userId);
    const newBalance = Number(account.balance) + amount + pnl;
    await query(
      'UPDATE paper_accounts SET balance = $1, realized_pnl = realized_pnl + $2, updated_at = NOW() WHERE user_id = $3',
      [newBalance, pnlRounded, userId],
    );

    res.json({
      success: true,
      data: {
        symbol,
        side: toApiSide(pos.side),
        entryPrice,
        exitPrice: currentPrice,
        quantity: qty,
        pnl: pnlRounded,
        balance: Math.round(newBalance * 100) / 100,
      },
    });
  } catch (err) {
    logger.error('Paper close error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /history — Trade history
router.get('/history', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const result = await query(
      'SELECT * FROM paper_trades WHERE user_id = $1 ORDER BY closed_at DESC',
      [userId],
    );

    const history = result.rows.map((t: { symbol: string; side: string; entry_price: string; exit_price: string; quantity: string; pnl: string; opened_at: Date; closed_at: Date }) => ({
      symbol: t.symbol,
      side: toApiSide(t.side),
      entryPrice: Number(t.entry_price),
      exitPrice: Number(t.exit_price),
      quantity: Number(t.quantity),
      amount: Number(t.entry_price) * Number(t.quantity),
      pnl: Number(t.pnl),
      openedAt: t.opened_at.toISOString(),
      closedAt: t.closed_at.toISOString(),
    }));

    res.json({ success: true, data: history });
  } catch (err) {
    logger.error('Paper history error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
