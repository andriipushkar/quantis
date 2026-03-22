import { Router, Request, Response } from 'express';
import logger from '../../config/logger.js';
import { getAllTickersAsObject, getTickerBySymbol } from '../../utils/ticker-cache.js';

const router = Router();

// GET /ticker — all tickers
router.get('/ticker', async (_req: Request, res: Response) => {
  try {
    const tickers = await getAllTickersAsObject();

    res.json({ success: true, data: tickers });
  } catch (err) {
    logger.error('Get tickers error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /ticker/:symbol
router.get('/ticker/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const ticker = await getTickerBySymbol(symbol);

    if (ticker) {
      res.json({ success: true, data: ticker });
      return;
    }

    res.status(404).json({ success: false, error: 'Ticker not found' });
  } catch (err) {
    logger.error('Get ticker error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
