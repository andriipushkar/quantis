export interface CandleInput {
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface SupportResistanceLevels {
  supports: number[];
  resistances: number[];
}

/**
 * Detects support and resistance levels using the pivot point method.
 *
 * A local high (resistance candidate) occurs when a candle's high is greater than
 * the highs of its immediate neighbours on both sides.
 *
 * A local low (support candidate) occurs when a candle's low is less than
 * the lows of its immediate neighbours on both sides.
 *
 * Nearby levels are clustered together (within `clusterThreshold` percent)
 * and only levels touched at least `touchCount` times are returned.
 *
 * Results are sorted by number of touches descending (strongest first).
 */
export function detectSupportResistance(
  candles: CandleInput[],
  touchCount: number = 2,
): SupportResistanceLevels {
  if (candles.length < 5) {
    return { supports: [], resistances: [] };
  }

  const localHighs: number[] = [];
  const localLows: number[] = [];

  // Identify pivot points using 2 neighbours on each side
  for (let i = 2; i < candles.length - 2; i++) {
    const h = candles[i].high;
    if (
      h > candles[i - 1].high &&
      h > candles[i - 2].high &&
      h > candles[i + 1].high &&
      h > candles[i + 2].high
    ) {
      localHighs.push(h);
    }

    const l = candles[i].low;
    if (
      l < candles[i - 1].low &&
      l < candles[i - 2].low &&
      l < candles[i + 1].low &&
      l < candles[i + 2].low
    ) {
      localLows.push(l);
    }
  }

  const resistances = clusterLevels(localHighs, touchCount);
  const supports = clusterLevels(localLows, touchCount);

  return { supports, resistances };
}

/**
 * Clusters nearby price levels and returns those with at least `minTouches`.
 * Uses a 0.5% threshold for clustering.
 */
function clusterLevels(levels: number[], minTouches: number): number[] {
  if (levels.length === 0) return [];

  const sorted = [...levels].sort((a, b) => a - b);
  const clusterThreshold = 0.005; // 0.5%

  const clusters: { sum: number; count: number }[] = [];

  for (const level of sorted) {
    let merged = false;

    for (const cluster of clusters) {
      const avg = cluster.sum / cluster.count;
      if (Math.abs(level - avg) / avg <= clusterThreshold) {
        cluster.sum += level;
        cluster.count += 1;
        merged = true;
        break;
      }
    }

    if (!merged) {
      clusters.push({ sum: level, count: 1 });
    }
  }

  return clusters
    .filter((c) => c.count >= minTouches)
    .sort((a, b) => b.count - a.count)
    .map((c) => parseFloat((c.sum / c.count).toFixed(8)));
}
