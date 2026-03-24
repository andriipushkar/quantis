/**
 * Branch coverage tests for shared package
 *
 * Targets uncovered branches in:
 *   - utils/index.ts — sleep (line 46), generateId fallback (lines 58-60)
 *   - circuitBreaker.ts — OPEN without fallback throws,
 *     HALF_OPEN probe fails reopens, onStateChange callback,
 *     transitionTo same state (no-op), reset() method
 */

import { CircuitBreaker, CircuitState } from '../circuitBreaker';
import { sleep, generateId, formatPrice, formatPercent, formatVolume, isValidTimeframe } from '../utils/index';

// =====================================================================
// utils/index — branch coverage
// =====================================================================

describe('utils — branch coverage', () => {
  describe('sleep', () => {
    it('resolves after the given delay', async () => {
      const start = Date.now();
      await sleep(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(40); // allow some timing slack
    });
  });

  describe('generateId', () => {
    it('returns a string from crypto.randomUUID when available', () => {
      const id = generateId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('returns a fallback id when crypto.randomUUID is not available', () => {
      const originalCrypto = globalThis.crypto;
      // Remove crypto to force fallback
      Object.defineProperty(globalThis, 'crypto', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      try {
        const id = generateId();
        expect(typeof id).toBe('string');
        expect(id).toContain('-');
        expect(id.length).toBeGreaterThan(5);
      } finally {
        Object.defineProperty(globalThis, 'crypto', {
          value: originalCrypto,
          writable: true,
          configurable: true,
        });
      }
    });

    it('returns a fallback id when crypto exists but randomUUID does not', () => {
      const originalCrypto = globalThis.crypto;
      Object.defineProperty(globalThis, 'crypto', {
        value: { getRandomValues: originalCrypto?.getRandomValues },
        writable: true,
        configurable: true,
      });

      try {
        const id = generateId();
        expect(typeof id).toBe('string');
        expect(id).toContain('-');
      } finally {
        Object.defineProperty(globalThis, 'crypto', {
          value: originalCrypto,
          writable: true,
          configurable: true,
        });
      }
    });
  });

  describe('formatPrice', () => {
    it('respects custom decimal places', () => {
      expect(formatPrice(123.456789, 4)).toBe('123.4568');
    });

    it('uses default 2 decimals', () => {
      expect(formatPrice(99)).toBe('99.00');
    });
  });

  describe('formatPercent', () => {
    it('formats negative percent without + sign', () => {
      expect(formatPercent(-3.5)).toBe('-3.50%');
    });

    it('formats zero with + sign', () => {
      expect(formatPercent(0)).toBe('+0.00%');
    });
  });

  describe('formatVolume', () => {
    it('formats billions', () => {
      expect(formatVolume(2_500_000_000)).toBe('2.50B');
    });

    it('formats millions', () => {
      expect(formatVolume(1_234_567)).toBe('1.23M');
    });

    it('formats thousands', () => {
      expect(formatVolume(5_678)).toBe('5.68K');
    });

    it('formats small numbers', () => {
      expect(formatVolume(42)).toBe('42.00');
    });
  });

  describe('isValidTimeframe', () => {
    it('returns true for valid timeframes', () => {
      expect(isValidTimeframe('1m')).toBe(true);
      expect(isValidTimeframe('1H')).toBe(true);
      expect(isValidTimeframe('1D')).toBe(true);
    });

    it('returns false for invalid timeframes', () => {
      expect(isValidTimeframe('2s')).toBe(false);
      expect(isValidTimeframe('')).toBe(false);
    });
  });
});

// =====================================================================
// CircuitBreaker — branch coverage
// =====================================================================

describe('CircuitBreaker — branch coverage', () => {
  it('throws when OPEN and no fallback is provided', async () => {
    const breaker = new CircuitBreaker('test-open-throw', {
      failureThreshold: 2,
      resetTimeout: 100,
    });

    const failing = async () => { throw new Error('fail'); };
    const fallback = () => 'fb';

    // Open the circuit
    await breaker.call(failing, fallback);
    await breaker.call(failing, fallback);
    expect(breaker.getState()).toBe(CircuitState.OPEN);

    // Now call without fallback — should throw
    await expect(breaker.call(failing)).rejects.toThrow('Circuit breaker "test-open-throw" is OPEN');
  });

  it('throws the original error when CLOSED action fails and no fallback', async () => {
    const breaker = new CircuitBreaker('test-no-fb', {
      failureThreshold: 5,
      resetTimeout: 100,
    });

    await expect(
      breaker.call(async () => { throw new Error('original'); }),
    ).rejects.toThrow('original');
    expect(breaker.getFailureCount()).toBe(1);
  });

  it('transitions from OPEN to HALF_OPEN after resetTimeout', async () => {
    const breaker = new CircuitBreaker('test-half-open', {
      failureThreshold: 2,
      resetTimeout: 50,
    });

    const failing = async () => { throw new Error('fail'); };
    const fallback = () => 'fb';

    await breaker.call(failing, fallback);
    await breaker.call(failing, fallback);
    expect(breaker.getState()).toBe(CircuitState.OPEN);

    // Wait for resetTimeout
    await new Promise(r => setTimeout(r, 70));

    // Next call should transition to HALF_OPEN and then probe
    const result = await breaker.call(async () => 'recovered', fallback);
    expect(result).toBe('recovered');
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('re-opens when HALF_OPEN probe fails', async () => {
    const breaker = new CircuitBreaker('test-probe-fail', {
      failureThreshold: 2,
      resetTimeout: 50,
    });

    const failing = async () => { throw new Error('fail'); };
    const fallback = () => 'fb';

    // Open
    await breaker.call(failing, fallback);
    await breaker.call(failing, fallback);
    expect(breaker.getState()).toBe(CircuitState.OPEN);

    // Wait for half-open
    await new Promise(r => setTimeout(r, 70));

    // Probe with another failure
    const result = await breaker.call(failing, fallback);
    expect(result).toBe('fb');
    expect(breaker.getState()).toBe(CircuitState.OPEN);
  });

  it('invokes onStateChange callback on transitions', async () => {
    const stateChanges: Array<{ from: CircuitState; to: CircuitState }> = [];

    const breaker = new CircuitBreaker('test-callback', {
      failureThreshold: 2,
      resetTimeout: 50,
      onStateChange: (_name, from, to) => {
        stateChanges.push({ from, to });
      },
    });

    const failing = async () => { throw new Error('fail'); };
    const fallback = () => 'fb';

    await breaker.call(failing, fallback);
    await breaker.call(failing, fallback);

    expect(stateChanges).toEqual([
      { from: CircuitState.CLOSED, to: CircuitState.OPEN },
    ]);
  });

  it('reset() transitions back to CLOSED from any state', async () => {
    const breaker = new CircuitBreaker('test-reset', {
      failureThreshold: 2,
      resetTimeout: 10000,
    });

    const failing = async () => { throw new Error('fail'); };
    const fallback = () => 'fb';

    await breaker.call(failing, fallback);
    await breaker.call(failing, fallback);
    expect(breaker.getState()).toBe(CircuitState.OPEN);

    breaker.reset();
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
    expect(breaker.getFailureCount()).toBe(0);
  });

  it('transitionTo same state is a no-op', async () => {
    const stateChanges: string[] = [];
    const breaker = new CircuitBreaker('test-noop', {
      failureThreshold: 5,
      resetTimeout: 100,
      onStateChange: (_name, _from, to) => stateChanges.push(to),
    });

    // Already CLOSED, reset should not fire callback
    breaker.reset();
    expect(stateChanges).toEqual([]);
  });
});
