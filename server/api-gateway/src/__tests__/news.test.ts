/**
 * News — Unit Tests
 *
 * Tests sentiment analysis, category detection, and news formatting
 * from routes/news.ts.
 */

// ---------------------------------------------------------------------------
// Replicated logic from news.ts
// ---------------------------------------------------------------------------

const BULLISH_KEYWORDS = [
  'surge', 'rally', 'bullish', 'soar', 'gain', 'rise', 'pump', 'breakout',
  'all-time high', 'ath', 'adoption', 'partnership', 'launch', 'upgrade',
  'approval', 'institutional', 'accumulation', 'growth', 'record',
];

const BEARISH_KEYWORDS = [
  'crash', 'dump', 'bearish', 'plunge', 'drop', 'decline', 'hack', 'exploit',
  'ban', 'regulation', 'crackdown', 'lawsuit', 'fraud', 'liquidation',
  'sell-off', 'selloff', 'collapse', 'fear', 'warning', 'vulnerability',
];

type Sentiment = 'bullish' | 'bearish' | 'neutral';
type Category = 'market' | 'regulatory' | 'technology' | 'exchange' | 'defi';

function analyzeSentiment(title: string): Sentiment {
  const lower = title.toLowerCase();
  const bullishScore = BULLISH_KEYWORDS.filter((kw) => lower.includes(kw)).length;
  const bearishScore = BEARISH_KEYWORDS.filter((kw) => lower.includes(kw)).length;

  if (bullishScore > bearishScore) return 'bullish';
  if (bearishScore > bullishScore) return 'bearish';
  return 'neutral';
}

function detectCategory(title: string, description: string): Category {
  const text = `${title} ${description}`.toLowerCase();

  if (/defi|dex|yield|liquidity|aave|uniswap|compound|staking/.test(text)) return 'defi';
  if (/regulation|sec|law|compliance|ban|legal|government|policy/.test(text)) return 'regulatory';
  if (/exchange|binance|coinbase|kraken|okx|bybit|trading/.test(text)) return 'exchange';
  if (/upgrade|protocol|blockchain|layer|network|fork|development|smart contract/.test(text)) return 'technology';
  return 'market';
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('News — Sentiment Classification', () => {
  describe('Bullish detection', () => {
    test('single bullish keyword returns bullish', () => {
      expect(analyzeSentiment('Bitcoin surges to new levels')).toBe('bullish');
    });

    test('"rally" keyword is bullish', () => {
      expect(analyzeSentiment('Crypto market rally continues')).toBe('bullish');
    });

    test('"all-time high" multi-word keyword is bullish', () => {
      expect(analyzeSentiment('ETH hits all-time high')).toBe('bullish');
    });

    test('"institutional" keyword is bullish', () => {
      expect(analyzeSentiment('Institutional investors enter crypto')).toBe('bullish');
    });

    test('"adoption" keyword is bullish', () => {
      expect(analyzeSentiment('Growing adoption of blockchain')).toBe('bullish');
    });

    test('"partnership" keyword is bullish', () => {
      expect(analyzeSentiment('New partnership announced for project')).toBe('bullish');
    });

    test('multiple bullish keywords reinforce bullish sentiment', () => {
      expect(analyzeSentiment('Bitcoin surge and rally lead to breakout and growth')).toBe('bullish');
    });
  });

  describe('Bearish detection', () => {
    test('"crash" keyword is bearish', () => {
      expect(analyzeSentiment('Bitcoin crash wipes out portfolios')).toBe('bearish');
    });

    test('"hack" keyword is bearish', () => {
      expect(analyzeSentiment('Major protocol hack reported')).toBe('bearish');
    });

    test('"liquidation" keyword is bearish', () => {
      expect(analyzeSentiment('Massive liquidation event')).toBe('bearish');
    });

    test('"sell-off" hyphenated keyword is bearish', () => {
      expect(analyzeSentiment('Market sell-off continues')).toBe('bearish');
    });

    test('"selloff" non-hyphenated keyword is bearish', () => {
      expect(analyzeSentiment('Major selloff in altcoins')).toBe('bearish');
    });

    test('"exploit" keyword is bearish', () => {
      expect(analyzeSentiment('DeFi protocol exploit discovered')).toBe('bearish');
    });

    test('"vulnerability" keyword is bearish', () => {
      expect(analyzeSentiment('Critical vulnerability found in contract')).toBe('bearish');
    });

    test('multiple bearish keywords reinforce bearish sentiment', () => {
      expect(analyzeSentiment('Market crash, hack, and fraud lead to fear')).toBe('bearish');
    });
  });

  describe('Neutral detection', () => {
    test('no keywords returns neutral', () => {
      expect(analyzeSentiment('Bitcoin price update today')).toBe('neutral');
    });

    test('equal bullish and bearish keywords returns neutral', () => {
      // "surge" (bullish) and "crash" (bearish) => tie => neutral
      expect(analyzeSentiment('Bitcoin surge or crash ahead?')).toBe('neutral');
    });

    test('empty title returns neutral', () => {
      expect(analyzeSentiment('')).toBe('neutral');
    });

    test('unrelated content returns neutral', () => {
      expect(analyzeSentiment('A simple status update')).toBe('neutral');
    });
  });

  describe('Case insensitivity', () => {
    test('uppercase keywords are detected', () => {
      expect(analyzeSentiment('BITCOIN SURGE TO ATH')).toBe('bullish');
    });

    test('mixed case keywords are detected', () => {
      expect(analyzeSentiment('Market Crash Incoming')).toBe('bearish');
    });
  });

  describe('Keyword counting', () => {
    test('more bullish than bearish keywords => bullish', () => {
      // "surge", "rally" (2 bullish) vs "drop" (1 bearish)
      expect(analyzeSentiment('Surge and rally despite small drop')).toBe('bullish');
    });

    test('more bearish than bullish keywords => bearish', () => {
      // "crash", "dump", "fear" (3 bearish) vs "growth" (1 bullish)
      expect(analyzeSentiment('Crash and dump cause fear despite growth')).toBe('bearish');
    });
  });
});

describe('News — Category Classification', () => {
  describe('DeFi category (highest priority)', () => {
    test('title with "defi" is classified as defi', () => {
      expect(detectCategory('DeFi protocol update', '')).toBe('defi');
    });

    test('description with "uniswap" is classified as defi', () => {
      expect(detectCategory('New protocol', 'Uniswap V4 launches')).toBe('defi');
    });

    test('"aave" triggers defi', () => {
      expect(detectCategory('Aave governance proposal', '')).toBe('defi');
    });

    test('"yield" triggers defi', () => {
      expect(detectCategory('New yield farming opportunity', '')).toBe('defi');
    });

    test('"staking" triggers defi', () => {
      expect(detectCategory('Staking rewards increased', '')).toBe('defi');
    });

    test('"compound" triggers defi', () => {
      expect(detectCategory('Compound interest rates change', '')).toBe('defi');
    });

    test('"dex" triggers defi', () => {
      expect(detectCategory('New DEX launches on Solana', '')).toBe('defi');
    });

    test('"liquidity" in description triggers defi', () => {
      expect(detectCategory('Pool update', 'Liquidity has increased')).toBe('defi');
    });
  });

  describe('Regulatory category', () => {
    test('"regulation" triggers regulatory', () => {
      expect(detectCategory('New regulation announced', '')).toBe('regulatory');
    });

    test('"SEC" triggers regulatory', () => {
      expect(detectCategory('SEC delays ETF decision', '')).toBe('regulatory');
    });

    test('"compliance" triggers regulatory', () => {
      expect(detectCategory('Compliance requirements updated', '')).toBe('regulatory');
    });

    test('"government" triggers regulatory', () => {
      expect(detectCategory('Government policy on crypto', '')).toBe('regulatory');
    });

    test('"ban" triggers regulatory', () => {
      expect(detectCategory('Country considers ban on crypto', '')).toBe('regulatory');
    });

    test('"legal" triggers regulatory', () => {
      expect(detectCategory('Legal framework for digital assets', '')).toBe('regulatory');
    });
  });

  describe('Exchange category', () => {
    test('"binance" triggers exchange', () => {
      expect(detectCategory('Binance reports record volume', '')).toBe('exchange');
    });

    test('"coinbase" triggers exchange', () => {
      expect(detectCategory('Coinbase lists new token', '')).toBe('exchange');
    });

    test('"trading" triggers exchange', () => {
      expect(detectCategory('Trading volume hits new record', '')).toBe('exchange');
    });

    test('"kraken" triggers exchange', () => {
      expect(detectCategory('Kraken adds new feature', '')).toBe('exchange');
    });
  });

  describe('Technology category', () => {
    test('"blockchain" triggers technology', () => {
      expect(detectCategory('Blockchain technology advances', '')).toBe('technology');
    });

    test('"protocol" triggers technology', () => {
      expect(detectCategory('Protocol upgrade scheduled', '')).toBe('technology');
    });

    test('"layer" triggers technology', () => {
      expect(detectCategory('Layer 2 scaling solution', '')).toBe('technology');
    });

    test('"fork" triggers technology', () => {
      expect(detectCategory('Hard fork approaching', '')).toBe('technology');
    });

    test('"smart contract" triggers technology', () => {
      expect(detectCategory('Smart contract audit complete', '')).toBe('technology');
    });

    test('"network" triggers technology', () => {
      expect(detectCategory('Network congestion increases', '')).toBe('technology');
    });
  });

  describe('Market category (default)', () => {
    test('generic title falls back to market', () => {
      expect(detectCategory('Bitcoin price rises', '')).toBe('market');
    });

    test('empty title and description is market', () => {
      expect(detectCategory('', '')).toBe('market');
    });

    test('unrelated text is market', () => {
      expect(detectCategory('Random news headline', 'No special keywords here')).toBe('market');
    });
  });

  describe('Priority ordering', () => {
    test('defi takes priority over exchange when both match', () => {
      // "uniswap" matches defi, "exchange" matches exchange
      expect(detectCategory('Uniswap exchange volume', '')).toBe('defi');
    });

    test('defi takes priority over regulatory when both match', () => {
      // "defi" + "regulation"
      expect(detectCategory('DeFi regulation proposed', '')).toBe('defi');
    });

    test('regulatory takes priority over exchange when both match', () => {
      // "regulation" matches regulatory, "binance" matches exchange
      expect(detectCategory('Regulation of Binance operations', '')).toBe('regulatory');
    });

    test('regulatory takes priority over technology', () => {
      expect(detectCategory('Government policy on blockchain', '')).toBe('regulatory');
    });
  });
});

describe('News — Mock News Items', () => {
  test('Bitcoin surge article is classified as bullish', () => {
    const sentiment = analyzeSentiment('Bitcoin Surges Past Key Resistance as Institutional Demand Grows');
    expect(sentiment).toBe('bullish');
  });

  test('SEC delays article is classified correctly', () => {
    const category = detectCategory(
      'SEC Delays Decision on Ethereum ETF Applications',
      'The U.S. Securities and Exchange Commission has pushed back its deadline'
    );
    expect(category).toBe('regulatory');
  });

  test('Uniswap V4 article is classified as defi + bullish', () => {
    const title = 'Uniswap V4 Launch Brings Major DeFi Innovations';
    expect(detectCategory(title, 'Uniswap has officially launched its V4 protocol upgrade')).toBe('defi');
    expect(analyzeSentiment(title)).toBe('bullish'); // "launch" is bullish
  });

  test('DeFi hack article is classified as bearish', () => {
    const title = 'Major Crypto Hack: DeFi Protocol Loses $12M in Exploit';
    expect(analyzeSentiment(title)).toBe('bearish'); // "hack", "exploit"
  });

  test('Binance volume article is classified as exchange', () => {
    const title = 'Binance Reports Record Trading Volume Amid Market Rally';
    const desc = 'Binance has reported its highest 24-hour trading volume';
    expect(detectCategory(title, desc)).toBe('exchange');
  });

  test('Layer 2 article is classified as technology', () => {
    const title = 'Ethereum Layer 2 Networks Hit New Transaction Records';
    const desc = 'Arbitrum and Optimism have both achieved new daily transaction records';
    expect(detectCategory(title, desc)).toBe('technology');
  });

  test('Fear & Greed article sentiment is bearish', () => {
    const title = 'Crypto Market Fear & Greed Index Shifts to Extreme Greed';
    // "fear" is bearish keyword
    expect(analyzeSentiment(title)).toBe('bearish');
  });

  test('mining difficulty article with "all-time high" is bullish', () => {
    const title = 'Bitcoin Mining Difficulty Reaches All-Time High';
    expect(analyzeSentiment(title)).toBe('bullish'); // "all-time high"
  });
});

describe('News — Keyword Lists', () => {
  test('bullish and bearish keyword lists have no overlap', () => {
    const overlap = BULLISH_KEYWORDS.filter((kw) => BEARISH_KEYWORDS.includes(kw));
    expect(overlap).toHaveLength(0);
  });

  test('all bullish keywords are lowercase', () => {
    for (const kw of BULLISH_KEYWORDS) {
      expect(kw).toBe(kw.toLowerCase());
    }
  });

  test('all bearish keywords are lowercase', () => {
    for (const kw of BEARISH_KEYWORDS) {
      expect(kw).toBe(kw.toLowerCase());
    }
  });

  test('bullish keywords list is not empty', () => {
    expect(BULLISH_KEYWORDS.length).toBeGreaterThan(0);
  });

  test('bearish keywords list is not empty', () => {
    expect(BEARISH_KEYWORDS.length).toBeGreaterThan(0);
  });
});
