import { Router, Request, Response } from 'express';

const router = Router();

function buildOpenAPISpec() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Quantis API',
      version: '1.0.0',
      description:
        'Quantis is a comprehensive crypto analytics platform providing real-time market data, AI-powered signals, paper trading, social features, and advanced technical analysis tools.',
      contact: { name: 'Quantis Team', url: 'https://quantis.app' },
    },
    servers: [{ url: '/api/v1', description: 'API v1' }],
    tags: [
      { name: 'Auth', description: 'Authentication & user management' },
      { name: 'Market', description: 'Market data, tickers, OHLCV, screener' },
      { name: 'Analysis', description: 'Signals, indicators, pattern detection' },
      { name: 'Alerts', description: 'Price & indicator alerts' },
      { name: 'Copilot', description: 'AI trading assistant' },
      { name: 'Paper Trading', description: 'Simulated trading' },
      { name: 'Social', description: 'Social feed, posts, follows' },
      { name: 'Gamification', description: 'XP, achievements, streaks' },
      { name: 'News', description: 'Crypto news aggregation' },
      { name: 'Whales', description: 'Whale transaction monitoring' },
      { name: 'DeFi', description: 'DeFi protocol TVL tracking' },
      { name: 'Leaderboard', description: 'Trader rankings' },
      { name: 'Journal', description: 'Trade journaling' },
      { name: 'Copy Trading', description: 'Copy top traders' },
      { name: 'Wallet', description: 'Wallet tracking' },
      { name: 'Admin', description: 'Admin panel' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string' },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object' },
          },
        },
        Ticker: {
          type: 'object',
          properties: {
            symbol: { type: 'string', example: 'BTCUSDT' },
            price: { type: 'number', example: 67500.5 },
            change24h: { type: 'number', example: 2.35 },
            volume: { type: 'number', example: 1250000000 },
          },
        },
        OHLCV: {
          type: 'object',
          properties: {
            time: { type: 'integer' },
            open: { type: 'number' },
            high: { type: 'number' },
            low: { type: 'number' },
            close: { type: 'number' },
            volume: { type: 'number' },
          },
        },
        DeFiProtocol: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            tvl: { type: 'number' },
            tvlChange24h: { type: 'number' },
            chain: { type: 'string' },
            category: { type: 'string' },
            apy: { type: 'number' },
            riskRating: { type: 'integer', minimum: 1, maximum: 5 },
          },
        },
        VolumeProfile: {
          type: 'object',
          properties: {
            symbol: { type: 'string' },
            poc: { type: 'number' },
            vaHigh: { type: 'number' },
            vaLow: { type: 'number' },
            distributionShape: { type: 'string', enum: ['normal', 'p-shape', 'b-shape'] },
            volumeProfile: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  price: { type: 'number' },
                  volume: { type: 'number' },
                  pct: { type: 'number' },
                },
              },
            },
            totalVolume: { type: 'number' },
          },
        },
      },
    },
    paths: {
      // --- Auth ---
      '/auth/register': {
        post: {
          tags: ['Auth'],
          summary: 'Register a new user',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', minLength: 8 },
                  },
                },
              },
            },
          },
          responses: {
            '201': { description: 'User created' },
            '409': { description: 'Email already exists' },
          },
        },
      },
      '/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Login and obtain JWT tokens',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: {
                    email: { type: 'string' },
                    password: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Access and refresh tokens returned' },
            '401': { description: 'Invalid credentials' },
          },
        },
      },
      '/auth/refresh': {
        post: {
          tags: ['Auth'],
          summary: 'Refresh access token using refresh cookie',
          responses: { '200': { description: 'New access token' }, '401': { description: 'Invalid refresh token' } },
        },
      },
      '/auth/me': {
        get: {
          tags: ['Auth'],
          summary: 'Get current user profile',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Current user data' } },
        },
      },

      // --- Market ---
      '/market/pairs': {
        get: {
          tags: ['Market'],
          summary: 'List all trading pairs',
          parameters: [
            { name: 'exchange', in: 'query', schema: { type: 'string' } },
            { name: 'quote', in: 'query', schema: { type: 'string' } },
            { name: 'active', in: 'query', schema: { type: 'boolean' } },
          ],
          responses: { '200': { description: 'Array of trading pairs' } },
        },
      },
      '/market/pairs/{symbol}': {
        get: {
          tags: ['Market'],
          summary: 'Get a single trading pair by symbol',
          parameters: [{ name: 'symbol', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Trading pair details' }, '404': { description: 'Not found' } },
        },
      },
      '/market/ohlcv/{symbol}': {
        get: {
          tags: ['Market'],
          summary: 'Get OHLCV candles for a symbol',
          parameters: [
            { name: 'symbol', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'timeframe', in: 'query', schema: { type: 'string', enum: ['1m', '5m', '15m', '1h', '4h', '1d'] } },
            { name: 'limit', in: 'query', schema: { type: 'integer', maximum: 5000 } },
            { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
            { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
          ],
          responses: { '200': { description: 'Array of OHLCV candles', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { $ref: '#/components/schemas/OHLCV' } } } } } } } },
        },
      },
      '/market/ticker': {
        get: {
          tags: ['Market'],
          summary: 'Get all live tickers',
          responses: { '200': { description: 'Map of symbol to ticker data' } },
        },
      },
      '/market/ticker/{symbol}': {
        get: {
          tags: ['Market'],
          summary: 'Get ticker for a specific symbol',
          parameters: [{ name: 'symbol', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Ticker data' }, '404': { description: 'Ticker not found' } },
        },
      },
      '/market/screener': {
        get: {
          tags: ['Market'],
          summary: 'Advanced screener with RSI, volume, trend filters',
          parameters: [
            { name: 'sort', in: 'query', schema: { type: 'string', enum: ['symbol', 'price', 'change24h', 'volume', 'rsi'] } },
            { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
            { name: 'minVolume', in: 'query', schema: { type: 'number' } },
            { name: 'minRsi', in: 'query', schema: { type: 'number' } },
            { name: 'maxRsi', in: 'query', schema: { type: 'number' } },
            { name: 'exchange', in: 'query', schema: { type: 'string' } },
            { name: 'trend', in: 'query', schema: { type: 'string', enum: ['bullish', 'bearish', 'neutral'] } },
          ],
          responses: { '200': { description: 'Filtered screener results' } },
        },
      },
      '/market/fear-greed': {
        get: {
          tags: ['Market'],
          summary: 'Composite Fear & Greed index',
          responses: { '200': { description: 'Score 0-100 with label and component breakdown' } },
        },
      },
      '/market/correlation': {
        get: {
          tags: ['Market'],
          summary: 'Pearson correlation matrix between top pairs',
          responses: { '200': { description: 'NxN correlation matrix' } },
        },
      },
      '/market/regime': {
        get: {
          tags: ['Market'],
          summary: 'Market regime classifier (trending, ranging, volatile)',
          responses: { '200': { description: 'Regime classification with confidence and strategy recommendations' } },
        },
      },
      '/market/funding-rates': {
        get: {
          tags: ['Market'],
          summary: 'Simulated funding rates for all pairs',
          responses: { '200': { description: 'Funding rate data with annualized rates and predictions' } },
        },
      },
      '/market/narratives': {
        get: {
          tags: ['Market'],
          summary: 'Crypto sector/narrative performance tracker',
          responses: { '200': { description: 'Sector performance scores and token breakdown' } },
        },
      },
      '/market/breadth': {
        get: {
          tags: ['Market'],
          summary: 'Market breadth indicators (advance/decline, RSI, new highs/lows)',
          responses: { '200': { description: 'Breadth score and component indicators' } },
        },
      },
      '/market/open-interest': {
        get: {
          tags: ['Market'],
          summary: 'Simulated open interest data for all pairs',
          responses: { '200': { description: 'Open interest with OI/volume ratio' } },
        },
      },
      '/market/defi': {
        get: {
          tags: ['DeFi'],
          summary: 'DeFi overview with TVL data for top protocols',
          responses: {
            '200': {
              description: 'DeFi protocol list with TVL, APY, and totals',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          protocols: { type: 'array', items: { $ref: '#/components/schemas/DeFiProtocol' } },
                          totalTvl: { type: 'number' },
                          avgApy: { type: 'number' },
                          protocolCount: { type: 'integer' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/market/profile/{symbol}': {
        get: {
          tags: ['Market'],
          summary: 'Simulated TPO / Volume Profile data',
          parameters: [{ name: 'symbol', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': {
              description: 'Volume profile with POC, Value Area, distribution shape',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/VolumeProfile' } } },
            },
            '404': { description: 'Symbol not found' },
          },
        },
      },
      '/market/confluence/{symbol}': {
        get: {
          tags: ['Market'],
          summary: 'Cross-signal confluence map for a symbol',
          parameters: [{ name: 'symbol', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Confluence zones with strength ratings' } },
        },
      },
      '/market/liquidations/{symbol}': {
        get: {
          tags: ['Market'],
          summary: 'Simulated liquidation heatmap data',
          parameters: [{ name: 'symbol', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Liquidation levels above and below current price' } },
        },
      },
      '/market/orderflow/{symbol}': {
        get: {
          tags: ['Market'],
          summary: 'Simulated order flow / footprint data',
          parameters: [{ name: 'symbol', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Order flow footprint candles with buy/sell volume per level' } },
        },
      },
      '/market/seasonality/{symbol}': {
        get: {
          tags: ['Market'],
          summary: 'Day-of-week and hour-of-day performance analysis',
          parameters: [{ name: 'symbol', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Hourly and daily seasonality data' } },
        },
      },

      // --- Analysis ---
      '/analysis/signals': {
        get: {
          tags: ['Analysis'],
          summary: 'Get latest trading signals',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Array of trading signals with entry/SL/TP' } },
        },
      },

      // --- Alerts ---
      '/alerts': {
        get: {
          tags: ['Alerts'],
          summary: 'List all alerts for the current user',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Array of alerts' } },
        },
        post: {
          tags: ['Alerts'],
          summary: 'Create a new alert',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['symbol', 'condition', 'value'],
                  properties: {
                    symbol: { type: 'string' },
                    condition: { type: 'string', enum: ['price_above', 'price_below', 'rsi_above', 'rsi_below'] },
                    value: { type: 'number' },
                    channels: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
          },
          responses: { '201': { description: 'Alert created' } },
        },
      },
      '/alerts/{id}': {
        delete: {
          tags: ['Alerts'],
          summary: 'Delete an alert',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Alert deleted' } },
        },
      },

      // --- Copilot ---
      '/copilot/ask': {
        post: {
          tags: ['Copilot'],
          summary: 'Ask the AI copilot a trading question',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' }, context: { type: 'object' } } } } },
          },
          responses: { '200': { description: 'AI response with analysis' } },
        },
      },

      // --- Paper Trading ---
      '/paper/portfolio': {
        get: {
          tags: ['Paper Trading'],
          summary: 'Get paper trading portfolio',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Portfolio with balance and positions' } },
        },
      },
      '/paper/orders': {
        post: {
          tags: ['Paper Trading'],
          summary: 'Place a paper trading order',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    symbol: { type: 'string' },
                    side: { type: 'string', enum: ['buy', 'sell'] },
                    quantity: { type: 'number' },
                    type: { type: 'string', enum: ['market', 'limit'] },
                    price: { type: 'number' },
                  },
                },
              },
            },
          },
          responses: { '201': { description: 'Order placed' } },
        },
      },

      // --- Social ---
      '/social/feed': {
        get: {
          tags: ['Social'],
          summary: 'Get social feed posts',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer' } },
            { name: 'limit', in: 'query', schema: { type: 'integer' } },
          ],
          responses: { '200': { description: 'Paginated feed of posts' } },
        },
      },
      '/social/posts': {
        post: {
          tags: ['Social'],
          summary: 'Create a new post',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', properties: { content: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } } } } },
          },
          responses: { '201': { description: 'Post created' } },
        },
      },

      // --- Gamification ---
      '/gamification/profile': {
        get: {
          tags: ['Gamification'],
          summary: 'Get XP, level, streak, and achievements',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Gamification profile data' } },
        },
      },

      // --- Leaderboard ---
      '/leaderboard': {
        get: {
          tags: ['Leaderboard'],
          summary: 'Get trader leaderboard rankings',
          parameters: [
            { name: 'period', in: 'query', schema: { type: 'string', enum: ['daily', 'weekly', 'monthly', 'allTime'] } },
          ],
          responses: { '200': { description: 'Leaderboard rankings' } },
        },
      },

      // --- News ---
      '/news': {
        get: {
          tags: ['News'],
          summary: 'Get aggregated crypto news',
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer' } },
            { name: 'category', in: 'query', schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'Paginated news articles' } },
        },
      },

      // --- Whales ---
      '/whales/transactions': {
        get: {
          tags: ['Whales'],
          summary: 'Get recent whale transactions',
          responses: { '200': { description: 'Array of large transactions' } },
        },
      },

      // --- Journal ---
      '/journal': {
        get: {
          tags: ['Journal'],
          summary: 'List trade journal entries',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Journal entries' } },
        },
        post: {
          tags: ['Journal'],
          summary: 'Create a journal entry',
          security: [{ bearerAuth: [] }],
          responses: { '201': { description: 'Entry created' } },
        },
      },

      // --- Copy Trading ---
      '/copy/traders': {
        get: {
          tags: ['Copy Trading'],
          summary: 'List top traders available for copy trading',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Array of top traders with stats' } },
        },
      },

      // --- Wallet ---
      '/wallets': {
        get: {
          tags: ['Wallet'],
          summary: 'List tracked wallets',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Array of tracked wallets' } },
        },
      },
    },
  };
}

// GET /docs — OpenAPI JSON spec
router.get('/', (_req: Request, res: Response) => {
  res.json(buildOpenAPISpec());
});

// GET /docs/ui — Swagger UI
router.get('/ui', (_req: Request, res: Response) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Quantis API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist/swagger-ui.css" />
  <style>
    :root {
      --bg: #0a0a0f;
      --surface: #12121a;
      --border: #1e1e2e;
      --text: #e0e0e8;
      --text-muted: #8888a0;
      --primary: #c9a84c;
    }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .topbar-wrapper { display: none !important; }
    .swagger-ui .topbar { display: none; }
    .quantis-header {
      display: flex; align-items: center; gap: 12px;
      padding: 16px 24px; border-bottom: 1px solid var(--border);
      background: var(--surface);
    }
    .quantis-header .logo {
      width: 36px; height: 36px; border-radius: 8px;
      background: linear-gradient(135deg, #c9a84c, #f0d78c);
      display: flex; align-items: center; justify-content: center;
      font-weight: bold; font-size: 18px; color: #000;
    }
    .quantis-header h1 { margin: 0; font-size: 20px; color: var(--text); }
    .quantis-header span { color: var(--text-muted); font-size: 13px; }
    .swagger-ui { background: var(--bg) !important; }
    .swagger-ui .scheme-container { background: var(--surface) !important; border-bottom: 1px solid var(--border); }
    .swagger-ui .opblock-tag { color: var(--text) !important; border-bottom-color: var(--border) !important; }
    .swagger-ui .opblock { background: var(--surface) !important; border-color: var(--border) !important; }
    .swagger-ui .opblock .opblock-summary { border-color: var(--border) !important; }
    .swagger-ui .opblock .opblock-summary-description { color: var(--text-muted) !important; }
    .swagger-ui .opblock .opblock-section-header { background: var(--bg) !important; }
    .swagger-ui .opblock-description-wrapper p,
    .swagger-ui .opblock-body pre,
    .swagger-ui label,
    .swagger-ui .response-col_description__inner p,
    .swagger-ui table thead tr th { color: var(--text) !important; }
    .swagger-ui .btn { border-color: var(--border) !important; color: var(--text) !important; }
    .swagger-ui .model-box { background: var(--surface) !important; }
    .swagger-ui section.models { border-color: var(--border) !important; }
    .swagger-ui section.models h4 { color: var(--text) !important; }
    .swagger-ui .model { color: var(--text) !important; }
    .swagger-ui .info { margin: 20px 0 !important; }
    .swagger-ui .info .title { color: var(--text) !important; }
    .swagger-ui .info p, .swagger-ui .info li { color: var(--text-muted) !important; }
  </style>
</head>
<body>
  <div class="quantis-header">
    <div class="logo">Q</div>
    <div>
      <h1>Quantis API</h1>
      <span>Interactive documentation &mdash; v1.0.0</span>
    </div>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/api/v1/docs',
      dom_id: '#swagger-ui',
      deepLinking: true,
      layout: 'BaseLayout',
      defaultModelsExpandDepth: 1,
      docExpansion: 'list',
    });
  </script>
</body>
</html>`;
  res.type('html').send(html);
});

export default router;
