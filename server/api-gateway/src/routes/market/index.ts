import { Router } from 'express';
import pairsRouter from './pairs.js';
import ohlcvRouter from './ohlcv.js';
import tickerRouter from './ticker.js';
import screenerRouter from './screener.js';
import derivativesRouter from './derivatives.js';
import sentimentRouter from './sentiment.js';
import onchainRouter from './onchain.js';
import advancedRouter from './advanced.js';
import arbitrageRouter from './arbitrage.js';

const router = Router();

// Mount all sub-routers
router.use('/', pairsRouter);       // /pairs, /pairs/:symbol
router.use('/', ohlcvRouter);       // /ohlcv/:symbol, /renko/:symbol
router.use('/', tickerRouter);      // /ticker, /ticker/:symbol
router.use('/', screenerRouter);    // /screener
router.use('/', derivativesRouter); // /funding-rates, /open-interest, /liquidations/:symbol, /orderflow/:symbol, /options/:symbol
router.use('/', sentimentRouter);   // /fear-greed, /correlation, /narratives, /breadth
router.use('/', onchainRouter);     // /defi, /dev-activity, /network-metrics/:symbol, /btc-models, /multi-asset
router.use('/', advancedRouter);    // /regime, /regime/scores, /confluence/:symbol, /seasonality/:symbol, /profile/:symbol
router.use('/', arbitrageRouter);   // /arbitrage/cross-exchange, /arbitrage/funding-rate, /arbitrage/triangular

export default router;
