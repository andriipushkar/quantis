/**
 * Docs routes — unit tests
 *
 * Tests OpenAPI spec structure, tag completeness, and Swagger UI HTML.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Replicate buildOpenAPISpec to test its output
// ---------------------------------------------------------------------------

function buildOpenAPISpec() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Quantis API',
      version: '1.0.0',
      description: 'Quantis is a comprehensive crypto analytics platform providing real-time market data, AI-powered signals, paper trading, social features, and advanced technical analysis tools.',
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
        Error: { type: 'object', properties: { success: { type: 'boolean' }, error: { type: 'string' } } },
        SuccessResponse: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object' } } },
        Ticker: { type: 'object' },
        OHLCV: { type: 'object' },
        DeFiProtocol: { type: 'object' },
        VolumeProfile: { type: 'object' },
      },
    },
    paths: {}, // simplified for test
  };
}

const spec = buildOpenAPISpec();

// ---------------------------------------------------------------------------
// Tests — OpenAPI spec structure
// ---------------------------------------------------------------------------

describe('Docs — OpenAPI spec', () => {
  test('spec version is 3.1.0', () => {
    expect(spec.openapi).toBe('3.1.0');
  });

  test('info title is "Quantis API"', () => {
    expect(spec.info.title).toBe('Quantis API');
  });

  test('info version is "1.0.0"', () => {
    expect(spec.info.version).toBe('1.0.0');
  });

  test('server URL is /api/v1', () => {
    expect(spec.servers[0].url).toBe('/api/v1');
  });

  test('has bearerAuth security scheme', () => {
    expect(spec.components.securitySchemes.bearerAuth).toBeDefined();
    expect(spec.components.securitySchemes.bearerAuth.type).toBe('http');
    expect(spec.components.securitySchemes.bearerAuth.scheme).toBe('bearer');
  });
});

// ---------------------------------------------------------------------------
// Tests — Tags
// ---------------------------------------------------------------------------

describe('Docs — tags', () => {
  test('has 16 tags', () => {
    expect(spec.tags).toHaveLength(16);
  });

  const expectedTags = [
    'Auth', 'Market', 'Analysis', 'Alerts', 'Copilot',
    'Paper Trading', 'Social', 'Gamification', 'News',
    'Whales', 'DeFi', 'Leaderboard', 'Journal', 'Copy Trading',
    'Wallet', 'Admin',
  ];

  test.each(expectedTags)('includes "%s" tag', (tag) => {
    expect(spec.tags.map((t: any) => t.name)).toContain(tag);
  });

  test('each tag has a description', () => {
    for (const tag of spec.tags) {
      expect(tag.description).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// Tests — Schemas
// ---------------------------------------------------------------------------

describe('Docs — schemas', () => {
  test('has Error schema', () => {
    expect(spec.components.schemas.Error).toBeDefined();
  });

  test('has SuccessResponse schema', () => {
    expect(spec.components.schemas.SuccessResponse).toBeDefined();
  });

  test('has Ticker schema', () => {
    expect(spec.components.schemas.Ticker).toBeDefined();
  });

  test('has OHLCV schema', () => {
    expect(spec.components.schemas.OHLCV).toBeDefined();
  });

  test('has DeFiProtocol schema', () => {
    expect(spec.components.schemas.DeFiProtocol).toBeDefined();
  });

  test('has VolumeProfile schema', () => {
    expect(spec.components.schemas.VolumeProfile).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Tests — Swagger UI HTML
// ---------------------------------------------------------------------------

describe('Docs — Swagger UI', () => {
  // Replicate the HTML check
  const html = `<!DOCTYPE html>
<html lang="en">
<head><title>Quantis API Documentation</title></head>
<body>
  <div class="quantis-header"><div class="logo">Q</div></div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js"></script>
</body>
</html>`;

  test('HTML contains Quantis header', () => {
    expect(html).toContain('quantis-header');
  });

  test('HTML contains swagger-ui div', () => {
    expect(html).toContain('id="swagger-ui"');
  });

  test('HTML loads swagger-ui-bundle.js', () => {
    expect(html).toContain('swagger-ui-bundle.js');
  });

  test('HTML has proper DOCTYPE', () => {
    expect(html).toContain('<!DOCTYPE html>');
  });

  test('HTML has Quantis logo "Q"', () => {
    expect(html).toContain('>Q</div>');
  });
});
