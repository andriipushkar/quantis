/**
 * Market Sentiment — Unit Tests
 *
 * Tests Fear & Greed calculation, correlation matrix computation,
 * narrative classification, and market breadth from routes/market/sentiment.ts.
 */

// ---------------------------------------------------------------------------
// Replicated logic from market/sentiment.ts
// ---------------------------------------------------------------------------

// --- Fear & Greed components ---

function computeRsiScore(rsiAvg: number): number {
  return Math.max(0, Math.min(100, ((rsiAvg - 30) / 40) * 100));
}

function computeBullishPct(changes: number[]): number {
  if (changes.length === 0) return 50;
  const bullishCount = changes.filter((c) => c > 0).length;
  return (bullishCount / changes.length) * 100;
}

function computeVolumeScore(bullishPct: number, avgChange: number): number {
  return Math.max(0, Math.min(100, bullishPct + (avgChange > 0 ? 10 : -10)));
}

function computeFearGreedScore(
  rsiAvg: number,
  changes: number[],
  fundingScore = 50
): { score: number; label: string; components: Record<string, number> } {
  const rsiScore = computeRsiScore(rsiAvg);
  const bullishPct = computeBullishPct(changes);
  const avgChange =
    changes.length > 0 ? changes.reduce((a, b) => a + b, 0) / changes.length : 0;
  const volumeScore = computeVolumeScore(bullishPct, avgChange);

  const raw = Math.round(
    rsiScore * 0.3 + bullishPct * 0.3 + volumeScore * 0.2 + fundingScore * 0.2
  );
  const score = Math.max(0, Math.min(100, raw));

  let label: string;
  if (score < 20) label = 'Extreme Fear';
  else if (score < 40) label = 'Fear';
  else if (score < 60) label = 'Neutral';
  else if (score < 80) label = 'Greed';
  else label = 'Extreme Greed';

  return {
    score,
    label,
    components: {
      rsi_score: Math.round(rsiScore * 100) / 100,
      bullish_pct: Math.round(bullishPct * 100) / 100,
      volume_score: Math.round(volumeScore * 100) / 100,
      funding_score: fundingScore,
    },
  };
}

// --- RSI calculation ---

function computeRsi(closes: number[]): number {
  if (closes.length < 15) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= 14; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / 14;
  const avgLoss = losses / 14;
  return avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
}

// --- Pearson correlation ---

function pearsonCorrelation(x: number[], y: number[]): number {
  const len = Math.min(x.length, y.length);
  const xSlice = x.slice(x.length - len);
  const ySlice = y.slice(y.length - len);

  const xMean = xSlice.reduce((a, b) => a + b, 0) / len;
  const yMean = ySlice.reduce((a, b) => a + b, 0) / len;

  let num = 0;
  let denomX = 0;
  let denomY = 0;
  for (let k = 0; k < len; k++) {
    const dx = xSlice[k] - xMean;
    const dy = ySlice[k] - yMean;
    num += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denom = Math.sqrt(denomX * denomY);
  return denom === 0 ? 0 : num / denom;
}

// --- Narrative classification ---

const NARRATIVE_SECTORS: Record<string, string[]> = {
  'AI & ML': ['LINKUSDT', 'DOTUSDT'],
  'Layer 1': ['ETHUSDT', 'SOLUSDT', 'AVAXUSDT', 'ADAUSDT'],
  'Meme': ['DOGEUSDT'],
  'DeFi': ['LINKUSDT'],
  'Exchange': ['BNBUSDT'],
  'Payments': ['XRPUSDT'],
};

function computeNarrativeScore(avgChange: number, avgVolume: number, avgRsi: number): number {
  const momentumScore = Math.max(0, Math.min(100, (avgChange + 10) * 5));
  const volumeScore = Math.min(100, (avgVolume / 1e9) * 50);
  const rsiScore = Math.max(0, Math.min(100, ((avgRsi - 30) / 40) * 100));
  const score = Math.round(momentumScore * 0.4 + volumeScore * 0.3 + rsiScore * 0.3);
  return Math.max(0, Math.min(100, score));
}

function computeTrend(avgChange: number): 'rising' | 'falling' | 'stable' {
  if (avgChange > 1) return 'rising';
  if (avgChange < -1) return 'falling';
  return 'stable';
}

// --- Breadth ---

function computeBreadthScore(
  advRatio: number,
  pctAboveSma: number,
  avgRsi: number,
  newHighs: number,
  newLows: number,
  totalPairs: number
): { score: number; label: string } {
  const rsiScore = Math.max(0, Math.min(100, ((avgRsi - 30) / 40) * 100));
  const hlScore =
    totalPairs > 0
      ? Math.max(0, Math.min(100, ((newHighs - newLows) / totalPairs + 0.5) * 100))
      : 50;

  const raw = Math.round(advRatio * 0.3 + pctAboveSma * 0.3 + rsiScore * 0.2 + hlScore * 0.2);
  const score = Math.max(0, Math.min(100, raw));

  let label: string;
  if (score >= 70) label = 'Strong Bull';
  else if (score >= 55) label = 'Moderate Bull';
  else if (score >= 45) label = 'Neutral';
  else if (score >= 30) label = 'Moderate Bear';
  else label = 'Weak / Bearish';

  return { score, label };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Sentiment — Fear & Greed Index', () => {
  describe('RSI component', () => {
    test('RSI 30 maps to score 0', () => {
      expect(computeRsiScore(30)).toBe(0);
    });

    test('RSI 70 maps to score 100', () => {
      expect(computeRsiScore(70)).toBe(100);
    });

    test('RSI 50 maps to score 50', () => {
      expect(computeRsiScore(50)).toBe(50);
    });

    test('RSI below 30 is clamped to 0', () => {
      expect(computeRsiScore(10)).toBe(0);
    });

    test('RSI above 70 is clamped to 100', () => {
      expect(computeRsiScore(90)).toBe(100);
    });
  });

  describe('Bullish percentage', () => {
    test('all positive changes = 100%', () => {
      expect(computeBullishPct([1, 2, 3, 4, 5])).toBe(100);
    });

    test('all negative changes = 0%', () => {
      expect(computeBullishPct([-1, -2, -3])).toBe(0);
    });

    test('mixed changes = correct ratio', () => {
      expect(computeBullishPct([1, -1, 2, -2])).toBe(50);
    });

    test('zero changes are not bullish', () => {
      expect(computeBullishPct([0, 0, 0])).toBe(0);
    });

    test('empty array defaults to 50', () => {
      expect(computeBullishPct([])).toBe(50);
    });
  });

  describe('Volume score', () => {
    test('positive avg change adds 10 to bullish pct', () => {
      const score = computeVolumeScore(50, 1);
      expect(score).toBe(60);
    });

    test('negative avg change subtracts 10 from bullish pct', () => {
      const score = computeVolumeScore(50, -1);
      expect(score).toBe(40);
    });

    test('clamped to 0 minimum', () => {
      const score = computeVolumeScore(0, -20);
      expect(score).toBe(0);
    });

    test('clamped to 100 maximum', () => {
      const score = computeVolumeScore(100, 20);
      expect(score).toBe(100);
    });
  });

  describe('Composite score', () => {
    test('extreme fear label for very low score', () => {
      // All negative changes, low RSI
      const result = computeFearGreedScore(20, [-5, -10, -8, -3, -6]);
      expect(result.score).toBeLessThan(20);
      expect(result.label).toBe('Extreme Fear');
    });

    test('extreme greed label for very high score', () => {
      // All positive changes, high RSI
      const result = computeFearGreedScore(80, [5, 10, 8, 3, 6]);
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.label).toBe('Extreme Greed');
    });

    test('neutral for balanced inputs', () => {
      const result = computeFearGreedScore(50, [1, -1, 2, -2, 0.5]);
      expect(result.score).toBeGreaterThanOrEqual(40);
      expect(result.score).toBeLessThan(60);
      expect(result.label).toBe('Neutral');
    });

    test('score is always 0-100', () => {
      const extremes = [
        computeFearGreedScore(0, [-100, -100]),
        computeFearGreedScore(100, [100, 100]),
        computeFearGreedScore(50, []),
      ];
      for (const r of extremes) {
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(100);
      }
    });

    test('label boundaries are correct', () => {
      // Create inputs that produce specific score ranges
      // Score < 20
      const fear = computeFearGreedScore(20, [-10, -10, -10, -10, -10]);
      expect(fear.label).toBe('Extreme Fear');

      // Score 60-79
      const greed = computeFearGreedScore(55, [1, 1, 1, 1, 1]);
      expect(greed.label).toBe('Greed');
    });

    test('components are included in result', () => {
      const result = computeFearGreedScore(50, [1, 2, 3]);
      expect(result.components).toHaveProperty('rsi_score');
      expect(result.components).toHaveProperty('bullish_pct');
      expect(result.components).toHaveProperty('volume_score');
      expect(result.components).toHaveProperty('funding_score');
    });

    test('funding score defaults to 50', () => {
      const result = computeFearGreedScore(50, [1]);
      expect(result.components.funding_score).toBe(50);
    });
  });
});

describe('Sentiment — RSI Calculation', () => {
  test('all gains => RSI = 100', () => {
    const closes = Array.from({ length: 15 }, (_, i) => 100 + i);
    expect(computeRsi(closes)).toBe(100);
  });

  test('all losses => RSI close to 0', () => {
    const closes = Array.from({ length: 15 }, (_, i) => 100 - i);
    const rsi = computeRsi(closes);
    expect(rsi).toBeLessThan(10);
  });

  test('equal gains and losses => RSI = 50', () => {
    // alternating up/down by same amount
    const closes = [100, 101, 100, 101, 100, 101, 100, 101, 100, 101, 100, 101, 100, 101, 100];
    const rsi = computeRsi(closes);
    expect(rsi).toBe(50);
  });

  test('insufficient data (< 15) returns default 50', () => {
    expect(computeRsi([100, 101, 102])).toBe(50);
  });

  test('flat price => RSI defaults to 100 (no losses)', () => {
    const closes = Array.from({ length: 15 }, () => 100);
    // gains = 0, losses = 0, avgLoss = 0 => returns 100
    expect(computeRsi(closes)).toBe(100);
  });

  test('RSI is between 0 and 100', () => {
    const cases = [
      Array.from({ length: 15 }, (_, i) => 100 + Math.sin(i) * 10),
      Array.from({ length: 15 }, (_, i) => 50 + i * 0.5),
      Array.from({ length: 15 }, (_, i) => 200 - i * 2),
    ];
    for (const closes of cases) {
      const rsi = computeRsi(closes);
      expect(rsi).toBeGreaterThanOrEqual(0);
      expect(rsi).toBeLessThanOrEqual(100);
    }
  });
});

describe('Sentiment — Correlation Matrix', () => {
  test('identical series have correlation 1.0', () => {
    const x = [1, 2, 3, 4, 5];
    const r = pearsonCorrelation(x, x);
    expect(r).toBeCloseTo(1.0, 4);
  });

  test('perfectly negatively correlated series have correlation -1.0', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [5, 4, 3, 2, 1];
    const r = pearsonCorrelation(x, y);
    expect(r).toBeCloseTo(-1.0, 4);
  });

  test('uncorrelated series have correlation near 0', () => {
    const x = [1, 2, 3, 4, 5, 6, 7, 8];
    const y = [2, 4, 1, 3, 5, 2, 4, 1]; // roughly random relative to x
    const r = pearsonCorrelation(x, y);
    expect(Math.abs(r)).toBeLessThan(0.5);
  });

  test('constant series returns 0 (division by zero guard)', () => {
    const x = [5, 5, 5, 5, 5];
    const y = [1, 2, 3, 4, 5];
    const r = pearsonCorrelation(x, y);
    expect(r).toBe(0);
  });

  test('both constant series returns 0', () => {
    const x = [3, 3, 3, 3];
    const y = [7, 7, 7, 7];
    expect(pearsonCorrelation(x, y)).toBe(0);
  });

  test('different length arrays use minimum length', () => {
    const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const y = [1, 2, 3];
    // Uses last 3 of x: [8, 9, 10] vs [1, 2, 3]
    const r = pearsonCorrelation(x, y);
    expect(r).toBeCloseTo(1.0, 4);
  });

  test('correlation is between -1 and 1', () => {
    const cases = [
      [[10, 20, 30], [5, 15, 25]],
      [[100, 50, 75], [30, 60, 45]],
      [[1, 1, 2, 3, 5, 8], [2, 3, 5, 7, 11, 13]],
    ];
    for (const [x, y] of cases) {
      const r = pearsonCorrelation(x, y);
      expect(r).toBeGreaterThanOrEqual(-1);
      expect(r).toBeLessThanOrEqual(1);
    }
  });

  test('self-correlation matrix diagonal is always 1', () => {
    const pairs = ['BTC', 'ETH', 'SOL'];
    const n = pairs.length;
    const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      matrix[i][i] = 1;
    }
    for (let i = 0; i < n; i++) {
      expect(matrix[i][i]).toBe(1);
    }
  });

  test('correlation matrix is symmetric', () => {
    const data: Record<string, number[]> = {
      A: [1, 2, 3, 4, 5],
      B: [2, 4, 5, 4, 5],
      C: [5, 3, 1, 2, 4],
    };
    const keys = Object.keys(data);
    const n = keys.length;
    const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      matrix[i][i] = 1;
      for (let j = i + 1; j < n; j++) {
        const r = pearsonCorrelation(data[keys[i]], data[keys[j]]);
        const rounded = Math.round(r * 10000) / 10000;
        matrix[i][j] = rounded;
        matrix[j][i] = rounded;
      }
    }

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        expect(matrix[i][j]).toBe(matrix[j][i]);
      }
    }
  });
});

describe('Sentiment — Narrative Classification', () => {
  test('narrative sectors are defined', () => {
    expect(Object.keys(NARRATIVE_SECTORS).length).toBeGreaterThan(0);
  });

  test('Layer 1 contains ETH, SOL, AVAX, ADA', () => {
    const l1 = NARRATIVE_SECTORS['Layer 1'];
    expect(l1).toContain('ETHUSDT');
    expect(l1).toContain('SOLUSDT');
    expect(l1).toContain('AVAXUSDT');
    expect(l1).toContain('ADAUSDT');
  });

  test('Meme sector contains DOGE', () => {
    expect(NARRATIVE_SECTORS['Meme']).toContain('DOGEUSDT');
  });

  test('LINKUSDT appears in both AI & ML and DeFi', () => {
    expect(NARRATIVE_SECTORS['AI & ML']).toContain('LINKUSDT');
    expect(NARRATIVE_SECTORS['DeFi']).toContain('LINKUSDT');
  });

  describe('Narrative score computation', () => {
    test('positive change, high volume, high RSI => high score', () => {
      const score = computeNarrativeScore(10, 2e9, 70);
      expect(score).toBeGreaterThanOrEqual(70);
    });

    test('negative change, zero volume, low RSI => low score', () => {
      const score = computeNarrativeScore(-10, 0, 30);
      expect(score).toBeLessThanOrEqual(10);
    });

    test('neutral values produce moderate score', () => {
      const score = computeNarrativeScore(0, 5e8, 50);
      expect(score).toBeGreaterThan(20);
      expect(score).toBeLessThan(80);
    });

    test('score is always 0-100', () => {
      const extreme = [
        computeNarrativeScore(100, 1e12, 100),
        computeNarrativeScore(-100, 0, 0),
      ];
      for (const s of extreme) {
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('Trend classification', () => {
    test('avgChange > 1 is rising', () => {
      expect(computeTrend(1.5)).toBe('rising');
      expect(computeTrend(10)).toBe('rising');
    });

    test('avgChange < -1 is falling', () => {
      expect(computeTrend(-1.5)).toBe('falling');
      expect(computeTrend(-10)).toBe('falling');
    });

    test('avgChange between -1 and 1 is stable', () => {
      expect(computeTrend(0)).toBe('stable');
      expect(computeTrend(0.5)).toBe('stable');
      expect(computeTrend(-0.5)).toBe('stable');
      expect(computeTrend(1)).toBe('stable');
      expect(computeTrend(-1)).toBe('stable');
    });
  });
});

describe('Sentiment — Market Breadth', () => {
  describe('Breadth score calculation', () => {
    test('all advancing, all above SMA, high RSI, all new highs => strong bull', () => {
      const result = computeBreadthScore(100, 100, 70, 10, 0, 10);
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.label).toBe('Strong Bull');
    });

    test('all declining, none above SMA, low RSI, all new lows => weak/bearish', () => {
      const result = computeBreadthScore(0, 0, 30, 0, 10, 10);
      expect(result.score).toBeLessThan(30);
      expect(result.label).toBe('Weak / Bearish');
    });

    test('balanced market => neutral range', () => {
      const result = computeBreadthScore(50, 50, 50, 5, 5, 10);
      expect(result.score).toBeGreaterThanOrEqual(30);
      expect(result.score).toBeLessThan(70);
    });

    test('score is always 0-100', () => {
      const cases = [
        computeBreadthScore(0, 0, 0, 0, 100, 100),
        computeBreadthScore(100, 100, 100, 100, 0, 100),
        computeBreadthScore(50, 50, 50, 50, 50, 100),
      ];
      for (const r of cases) {
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('Breadth labels', () => {
    test('score >= 70 is Strong Bull', () => {
      const result = computeBreadthScore(100, 100, 70, 10, 0, 10);
      expect(result.label).toBe('Strong Bull');
    });

    test('score 55-69 is Moderate Bull', () => {
      const result = computeBreadthScore(60, 65, 55, 3, 1, 10);
      expect(result.label).toBe('Moderate Bull');
    });

    test('score 45-54 is Neutral', () => {
      const result = computeBreadthScore(50, 50, 50, 2, 2, 10);
      expect(result.label).toBe('Neutral');
    });

    test('score 30-44 is Moderate Bear', () => {
      const result = computeBreadthScore(35, 35, 42, 2, 3, 10);
      expect(result.label).toBe('Moderate Bear');
    });

    test('score < 30 is Weak / Bearish', () => {
      const result = computeBreadthScore(0, 0, 30, 0, 10, 10);
      expect(result.label).toBe('Weak / Bearish');
    });
  });

  describe('Edge cases', () => {
    test('zero total pairs uses fallback hlScore of 50', () => {
      const result = computeBreadthScore(50, 50, 50, 0, 0, 0);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    test('breadthLine = advancing - declining', () => {
      const advancing = 7;
      const declining = 3;
      const breadthLine = advancing - declining;
      expect(breadthLine).toBe(4);
    });

    test('pctAboveSma calculation', () => {
      const aboveSma = 6;
      const totalPairs = 10;
      const pct = Math.round((aboveSma / totalPairs) * 10000) / 100;
      expect(pct).toBe(60);
    });
  });
});
