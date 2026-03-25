/**
 * Client-side utility tests
 *
 * Tests for the cn() utility and formatting helpers.
 */

import { cn } from '@/utils/cn';

// ---------------------------------------------------------------------------
// cn() — className merge utility (clsx + tailwind-merge)
// ---------------------------------------------------------------------------
describe('cn() utility', () => {
  test('returns empty string for no arguments', () => {
    expect(cn()).toBe('');
  });

  test('returns a single class as-is', () => {
    expect(cn('text-red-500')).toBe('text-red-500');
  });

  test('merges multiple classes', () => {
    const result = cn('px-4', 'py-2');
    expect(result).toContain('px-4');
    expect(result).toContain('py-2');
  });

  test('handles conditional classes (false/undefined/null are excluded)', () => {
    const result = cn('base', false, undefined, null, 'end');
    expect(result).toContain('base');
    expect(result).toContain('end');
    expect(result).not.toContain('hidden');
  });

  test('tailwind-merge resolves conflicting classes (last wins)', () => {
    // tailwind-merge should keep only the last conflicting utility
    const result = cn('px-4', 'px-8');
    expect(result).toBe('px-8');
  });

  test('tailwind-merge resolves conflicting color classes', () => {
    const result = cn('text-red-500', 'text-blue-500');
    expect(result).toBe('text-blue-500');
  });

  test('handles array inputs', () => {
    const result = cn(['px-4', 'py-2']);
    expect(result).toContain('px-4');
    expect(result).toContain('py-2');
  });

  test('handles object inputs', () => {
    const result = cn({ 'bg-red-500': true, 'bg-blue-500': false });
    expect(result).toContain('bg-red-500');
    expect(result).not.toContain('bg-blue-500');
  });
});

// ---------------------------------------------------------------------------
// Formatting helpers — inline implementations matching shared/src/utils
// ---------------------------------------------------------------------------

function formatPrice(price: number, decimals: number = 2): string {
  return price.toFixed(decimals);
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function formatVolume(volume: number): string {
  if (volume >= 1_000_000_000) {
    return `${(volume / 1_000_000_000).toFixed(2)}B`;
  }
  if (volume >= 1_000_000) {
    return `${(volume / 1_000_000).toFixed(2)}M`;
  }
  if (volume >= 1_000) {
    return `${(volume / 1_000).toFixed(2)}K`;
  }
  return volume.toFixed(2);
}

describe('formatPrice', () => {
  test('formats to 2 decimal places by default', () => {
    expect(formatPrice(45123.456)).toBe('45123.46');
  });

  test('formats to specified decimal places', () => {
    expect(formatPrice(0.00001234, 8)).toBe('0.00001234');
    expect(formatPrice(45000, 0)).toBe('45000');
  });

  test('handles zero', () => {
    expect(formatPrice(0)).toBe('0.00');
  });

  test('handles very large numbers', () => {
    expect(formatPrice(99999.999)).toBe('100000.00');
  });
});

describe('formatPercent', () => {
  test('positive value includes + sign', () => {
    expect(formatPercent(5.5)).toBe('+5.50%');
  });

  test('negative value includes - sign', () => {
    expect(formatPercent(-3.14)).toBe('-3.14%');
  });

  test('zero gets + sign', () => {
    expect(formatPercent(0)).toBe('+0.00%');
  });

  test('rounds to 2 decimal places', () => {
    expect(formatPercent(1.999)).toBe('+2.00%');
  });
});

describe('formatVolume', () => {
  test('formats billions', () => {
    expect(formatVolume(1_500_000_000)).toBe('1.50B');
  });

  test('formats millions', () => {
    expect(formatVolume(2_340_000)).toBe('2.34M');
  });

  test('formats thousands', () => {
    expect(formatVolume(12_500)).toBe('12.50K');
  });

  test('formats small numbers without suffix', () => {
    expect(formatVolume(999)).toBe('999.00');
  });

  test('boundary: exactly 1000 uses K suffix', () => {
    expect(formatVolume(1000)).toBe('1.00K');
  });

  test('boundary: exactly 1M uses M suffix', () => {
    expect(formatVolume(1_000_000)).toBe('1.00M');
  });

  test('boundary: exactly 1B uses B suffix', () => {
    expect(formatVolume(1_000_000_000)).toBe('1.00B');
  });
});
