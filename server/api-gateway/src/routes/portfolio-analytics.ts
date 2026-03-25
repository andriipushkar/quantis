import { Router, Response } from 'express';
import { query } from '../config/database.js';
import logger from '../config/logger.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// GET /analytics — portfolio performance metrics
router.get('/analytics', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Fetch closed trades
    const tradesResult = await query(
      `SELECT symbol, side, entry_price, exit_price, quantity, pnl, pnl_pct, closed_at
       FROM paper_trades
       WHERE user_id = $1 AND exit_price IS NOT NULL
       ORDER BY closed_at ASC`,
      [userId]
    );
    const trades = tradesResult.rows;

    if (trades.length === 0) {
      res.json({
        success: true,
        data: {
          totalTrades: 0, winRate: 0, profitFactor: 0,
          sharpeRatio: 0, maxDrawdown: 0, maxDrawdownPct: 0,
          totalPnl: 0, avgWin: 0, avgLoss: 0,
          bestTrade: null, worstTrade: null,
          equityCurve: [], monthlyReturns: [],
          correlationWithBtc: 0,
        }
      });
      return;
    }

    // Calculate metrics
    const pnls = trades.map((t: { pnl: string }) => parseFloat(t.pnl));
    const wins = pnls.filter(p => p > 0);
    const losses = pnls.filter(p => p < 0);

    const totalPnl = pnls.reduce((a, b) => a + b, 0);
    const winRate = (wins.length / pnls.length) * 100;
    const avgWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length) : 0;
    const profitFactor = avgLoss > 0 ? (wins.reduce((a, b) => a + b, 0)) / Math.abs(losses.reduce((a, b) => a + b, 0)) : wins.length > 0 ? Infinity : 0;

    // Sharpe Ratio (annualized, assuming daily returns)
    const returns = pnls.map((p, i) => {
      const capital = 10000 + pnls.slice(0, i).reduce((a, b) => a + b, 0);
      return capital > 0 ? p / capital : 0;
    });
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdReturn = Math.sqrt(returns.reduce((sum, r) => sum + (r - meanReturn) ** 2, 0) / returns.length);
    const sharpeRatio = stdReturn > 0 ? (meanReturn / stdReturn) * Math.sqrt(252) : 0;

    // Max Drawdown
    let peak = 10000;
    let maxDrawdown = 0;
    let maxDrawdownPct = 0;
    let equity = 10000;
    const equityCurve: { date: string; equity: number }[] = [];

    for (const trade of trades) {
      equity += parseFloat(trade.pnl);
      if (equity > peak) peak = equity;
      const dd = peak - equity;
      const ddPct = peak > 0 ? (dd / peak) * 100 : 0;
      if (dd > maxDrawdown) {
        maxDrawdown = dd;
        maxDrawdownPct = ddPct;
      }
      equityCurve.push({
        date: trade.closed_at ? new Date(trade.closed_at).toISOString().slice(0, 10) : '',
        equity: Math.round(equity * 100) / 100,
      });
    }

    // Monthly returns
    const monthlyMap = new Map<string, number>();
    for (const trade of trades) {
      const month = trade.closed_at ? new Date(trade.closed_at).toISOString().slice(0, 7) : 'unknown';
      monthlyMap.set(month, (monthlyMap.get(month) || 0) + parseFloat(trade.pnl));
    }
    const monthlyReturns = Array.from(monthlyMap.entries()).map(([month, pnl]) => ({ month, pnl: Math.round(pnl * 100) / 100 }));

    // Best and worst trades
    const sortedByPnl = [...trades].sort((a: { pnl: string }, b: { pnl: string }) => parseFloat(b.pnl) - parseFloat(a.pnl));
    const bestTrade = sortedByPnl[0] ? { symbol: sortedByPnl[0].symbol, pnl: parseFloat(sortedByPnl[0].pnl), pnl_pct: parseFloat(sortedByPnl[0].pnl_pct) } : null;
    const worstTrade = sortedByPnl[sortedByPnl.length - 1] ? { symbol: sortedByPnl[sortedByPnl.length - 1].symbol, pnl: parseFloat(sortedByPnl[sortedByPnl.length - 1].pnl), pnl_pct: parseFloat(sortedByPnl[sortedByPnl.length - 1].pnl_pct) } : null;

    res.json({
      success: true,
      data: {
        totalTrades: trades.length,
        winRate: Math.round(winRate * 100) / 100,
        profitFactor: Math.round(profitFactor * 100) / 100,
        sharpeRatio: Math.round(sharpeRatio * 100) / 100,
        maxDrawdown: Math.round(maxDrawdown * 100) / 100,
        maxDrawdownPct: Math.round(maxDrawdownPct * 100) / 100,
        totalPnl: Math.round(totalPnl * 100) / 100,
        avgWin: Math.round(avgWin * 100) / 100,
        avgLoss: Math.round(avgLoss * 100) / 100,
        bestTrade,
        worstTrade,
        equityCurve,
        monthlyReturns,
      },
    });
  } catch (err) {
    logger.error('Portfolio analytics error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Failed to compute analytics' });
  }
});

export default router;
