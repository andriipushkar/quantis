import { Router, Response } from 'express';
import redis from '../config/redis.js';
import logger from '../config/logger.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// --- In-memory paper trading store ---

interface Position {
  symbol: string;
  side: 'buy' | 'sell';
  entryPrice: number;
  quantity: number; // quantity of asset
  amount: number; // USD amount invested
  openedAt: string;
}

interface TradeRecord {
  symbol: string;
  side: 'buy' | 'sell';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  amount: number;
  pnl: number;
  closedAt: string;
  openedAt: string;
}

interface PaperAccount {
  balance: number;
  positions: Position[];
  history: TradeRecord[];
}

const accounts = new Map<string, PaperAccount>();

function getAccount(userId: string): PaperAccount {
  if (!accounts.has(userId)) {
    accounts.set(userId, {
      balance: 10000,
      positions: [],
      history: [],
    });
  }
  return accounts.get(userId)!;
}

// Fetch ticker from Redis
async function getTickerPrice(symbol: string): Promise<number | null> {
  const exchanges = ['binance', 'bybit', 'okx'];
  for (const exchange of exchanges) {
    const data = await redis.get(`ticker:${exchange}:${symbol}`);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        return parsed.price ?? null;
      } catch { /* skip */ }
    }
  }
  return null;
}

// GET /account — Returns virtual account summary
router.get('/account', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const account = getAccount(req.user!.id);

    // Calculate unrealized P&L from open positions
    let unrealizedPnl = 0;
    for (const pos of account.positions) {
      const currentPrice = await getTickerPrice(pos.symbol);
      if (currentPrice !== null) {
        if (pos.side === 'buy') {
          unrealizedPnl += (currentPrice - pos.entryPrice) * pos.quantity;
        } else {
          unrealizedPnl += (pos.entryPrice - currentPrice) * pos.quantity;
        }
      }
    }

    const realizedPnl = account.history.reduce((sum, t) => sum + t.pnl, 0);
    const equity = account.balance + unrealizedPnl;

    res.json({
      success: true,
      data: {
        balance: Math.round(account.balance * 100) / 100,
        equity: Math.round(equity * 100) / 100,
        unrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
        realizedPnl: Math.round(realizedPnl * 100) / 100,
        positionsCount: account.positions.length,
      },
    });
  } catch (err) {
    logger.error('Paper account error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /order — Place a paper trade order
router.post('/order', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { symbol: rawSymbol, side, quantity: amount } = req.body;

    if (!rawSymbol || !side || !amount) {
      res.status(400).json({ success: false, error: 'symbol, side, and quantity (USD amount) are required' });
      return;
    }

    if (side !== 'buy' && side !== 'sell') {
      res.status(400).json({ success: false, error: 'side must be "buy" or "sell"' });
      return;
    }

    const usdAmount = parseFloat(amount);
    if (isNaN(usdAmount) || usdAmount <= 0) {
      res.status(400).json({ success: false, error: 'quantity must be a positive number' });
      return;
    }

    const symbol = rawSymbol.toUpperCase();
    const currentPrice = await getTickerPrice(symbol);
    if (currentPrice === null) {
      res.status(404).json({ success: false, error: `No ticker data found for ${symbol}` });
      return;
    }

    const account = getAccount(req.user!.id);

    if (usdAmount > account.balance) {
      res.status(400).json({ success: false, error: 'Insufficient balance' });
      return;
    }

    const assetQuantity = usdAmount / currentPrice;

    // Check if there's an existing position in the opposite direction to close
    const existingIdx = account.positions.findIndex((p) => p.symbol === symbol);
    if (existingIdx !== -1) {
      const existing = account.positions[existingIdx];
      if (existing.side !== side) {
        // Close existing position
        let pnl: number;
        if (existing.side === 'buy') {
          pnl = (currentPrice - existing.entryPrice) * existing.quantity;
        } else {
          pnl = (existing.entryPrice - currentPrice) * existing.quantity;
        }

        account.balance += existing.amount + pnl;
        account.history.push({
          symbol: existing.symbol,
          side: existing.side,
          entryPrice: existing.entryPrice,
          exitPrice: currentPrice,
          quantity: existing.quantity,
          amount: existing.amount,
          pnl: Math.round(pnl * 100) / 100,
          openedAt: existing.openedAt,
          closedAt: new Date().toISOString(),
        });
        account.positions.splice(existingIdx, 1);

        // Now open the new position with the requested amount
        account.balance -= usdAmount;
        account.positions.push({
          symbol,
          side,
          entryPrice: currentPrice,
          quantity: assetQuantity,
          amount: usdAmount,
          openedAt: new Date().toISOString(),
        });

        res.json({
          success: true,
          data: {
            action: 'closed_and_opened',
            closedPnl: Math.round(pnl * 100) / 100,
            order: {
              symbol,
              side,
              entryPrice: currentPrice,
              quantity: assetQuantity,
              amount: usdAmount,
            },
            balance: Math.round(account.balance * 100) / 100,
          },
        });
        return;
      }
    }

    // Open new position or add to existing same-direction position
    account.balance -= usdAmount;
    account.positions.push({
      symbol,
      side,
      entryPrice: currentPrice,
      quantity: assetQuantity,
      amount: usdAmount,
      openedAt: new Date().toISOString(),
    });

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
        balance: Math.round(account.balance * 100) / 100,
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
    const account = getAccount(req.user!.id);

    const positions = [];
    for (const pos of account.positions) {
      const currentPrice = await getTickerPrice(pos.symbol);
      let pnl = 0;
      let pnlPct = 0;
      if (currentPrice !== null) {
        if (pos.side === 'buy') {
          pnl = (currentPrice - pos.entryPrice) * pos.quantity;
        } else {
          pnl = (pos.entryPrice - currentPrice) * pos.quantity;
        }
        pnlPct = (pnl / pos.amount) * 100;
      }

      positions.push({
        symbol: pos.symbol,
        side: pos.side,
        entryPrice: pos.entryPrice,
        currentPrice: currentPrice ?? pos.entryPrice,
        quantity: pos.quantity,
        amount: pos.amount,
        pnl: Math.round(pnl * 100) / 100,
        pnlPct: Math.round(pnlPct * 100) / 100,
        openedAt: pos.openedAt,
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
    const account = getAccount(req.user!.id);

    const posIdx = account.positions.findIndex((p) => p.symbol === symbol);
    if (posIdx === -1) {
      res.status(404).json({ success: false, error: `No open position for ${symbol}` });
      return;
    }

    const pos = account.positions[posIdx];
    const currentPrice = await getTickerPrice(symbol);
    if (currentPrice === null) {
      res.status(404).json({ success: false, error: `No ticker data found for ${symbol}` });
      return;
    }

    let pnl: number;
    if (pos.side === 'buy') {
      pnl = (currentPrice - pos.entryPrice) * pos.quantity;
    } else {
      pnl = (pos.entryPrice - currentPrice) * pos.quantity;
    }

    account.balance += pos.amount + pnl;
    account.history.push({
      symbol: pos.symbol,
      side: pos.side,
      entryPrice: pos.entryPrice,
      exitPrice: currentPrice,
      quantity: pos.quantity,
      amount: pos.amount,
      pnl: Math.round(pnl * 100) / 100,
      openedAt: pos.openedAt,
      closedAt: new Date().toISOString(),
    });
    account.positions.splice(posIdx, 1);

    res.json({
      success: true,
      data: {
        symbol,
        side: pos.side,
        entryPrice: pos.entryPrice,
        exitPrice: currentPrice,
        quantity: pos.quantity,
        pnl: Math.round(pnl * 100) / 100,
        balance: Math.round(account.balance * 100) / 100,
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
    const account = getAccount(req.user!.id);
    res.json({ success: true, data: account.history.slice().reverse() });
  } catch (err) {
    logger.error('Paper history error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
