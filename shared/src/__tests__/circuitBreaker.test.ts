import { CircuitBreaker, CircuitState } from '../circuitBreaker';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker('test', {
      failureThreshold: 3,
      resetTimeout: 100, // 100ms for fast tests
    });
  });

  it('starts in CLOSED state', () => {
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
    expect(breaker.getFailureCount()).toBe(0);
  });

  it('stays CLOSED on successful calls', async () => {
    const result = await breaker.call(async () => 42);
    expect(result).toBe(42);
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('opens after reaching failure threshold', async () => {
    const failing = async () => { throw new Error('fail'); };
    const fallback = () => 'fallback';

    await breaker.call(failing, fallback);
    await breaker.call(failing, fallback);
    expect(breaker.getState()).toBe(CircuitState.CLOSED);

    await breaker.call(failing, fallback);
    expect(breaker.getState()).toBe(CircuitState.OPEN);
    expect(breaker.getFailureCount()).toBe(3);
  });

  it('returns fallback when OPEN', async () => {
    // Force open
    const failing = async () => { throw new Error('fail'); };
    for (let i = 0; i < 3; i++) {
      await breaker.call(failing, () => 'fb');
    }

    const result = await breaker.call(async () => 'should not run', () => 'circuit open fb');
    expect(result).toBe('circuit open fb');
  });

  it('throws when OPEN and no fallback', async () => {
    const failing = async (): Promise<string> => { throw new Error('fail'); };
    for (let i = 0; i < 3; i++) {
      try { await breaker.call(failing); } catch { /* expected */ }
    }

    await expect(breaker.call(async () => 'x')).rejects.toThrow('Circuit breaker "test" is OPEN');
  });

  it('transitions to HALF_OPEN after resetTimeout', async () => {
    const failing = async () => { throw new Error('fail'); };
    for (let i = 0; i < 3; i++) {
      await breaker.call(failing, () => 'fb');
    }
    expect(breaker.getState()).toBe(CircuitState.OPEN);

    // Wait for resetTimeout
    await new Promise((r) => setTimeout(r, 150));

    // Next call should transition to HALF_OPEN and succeed
    const result = await breaker.call(async () => 'recovered');
    expect(result).toBe('recovered');
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
    expect(breaker.getFailureCount()).toBe(0);
  });

  it('re-opens if HALF_OPEN probe fails', async () => {
    const failing = async () => { throw new Error('fail'); };
    for (let i = 0; i < 3; i++) {
      await breaker.call(failing, () => 'fb');
    }

    await new Promise((r) => setTimeout(r, 150));

    // Probe fails — should reopen
    await breaker.call(failing, () => 'fb');
    expect(breaker.getState()).toBe(CircuitState.OPEN);
  });

  it('calls onStateChange callback', async () => {
    const transitions: Array<{ from: CircuitState; to: CircuitState }> = [];
    const tracked = new CircuitBreaker('tracked', {
      failureThreshold: 2,
      resetTimeout: 50,
      onStateChange: (_name, from, to) => {
        transitions.push({ from, to });
      },
    });

    const failing = async () => { throw new Error('fail'); };
    await tracked.call(failing, () => 'fb');
    await tracked.call(failing, () => 'fb');

    expect(transitions).toEqual([
      { from: CircuitState.CLOSED, to: CircuitState.OPEN },
    ]);
  });

  it('manual reset returns to CLOSED', async () => {
    const failing = async () => { throw new Error('fail'); };
    for (let i = 0; i < 3; i++) {
      await breaker.call(failing, () => 'fb');
    }
    expect(breaker.getState()).toBe(CircuitState.OPEN);

    breaker.reset();
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
    expect(breaker.getFailureCount()).toBe(0);
  });
});
