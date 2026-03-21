/**
 * Circuit Breaker pattern implementation.
 *
 * States:
 *   CLOSED   — normal operation, failures are counted
 *   OPEN     — all calls are short-circuited with a fallback
 *   HALF_OPEN — a single probe request is allowed through
 *
 * Usage:
 *   const breaker = new CircuitBreaker('binance-rest', { failureThreshold: 5 });
 *   const data = await breaker.call(() => fetch(url), () => cachedData);
 */

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the circuit (default: 5) */
  failureThreshold?: number;
  /** Time in ms the circuit stays open before moving to half-open (default: 30 000) */
  resetTimeout?: number;
  /** Time in ms after a success to reset the failure count (default: 60 000) */
  successResetInterval?: number;
  /** Optional callback when state changes */
  onStateChange?: (name: string, from: CircuitState, to: CircuitState) => void;
}

export class CircuitBreaker {
  readonly name: string;

  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private nextAttemptTime = 0;

  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly onStateChange?: CircuitBreakerOptions['onStateChange'];

  constructor(name: string, options: CircuitBreakerOptions = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeout = options.resetTimeout ?? 30_000;
    this.onStateChange = options.onStateChange;
  }

  // ── Public API ───────────────────────────────────────────────────

  /**
   * Execute `action` if the circuit is closed/half-open.
   * Falls back to `fallback` when the circuit is open or action fails.
   */
  async call<T>(action: () => Promise<T>, fallback?: () => T | Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() >= this.nextAttemptTime) {
        this.transitionTo(CircuitState.HALF_OPEN);
      } else {
        if (fallback) return fallback();
        throw new Error(`Circuit breaker "${this.name}" is OPEN`);
      }
    }

    try {
      const result = await action();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      if (fallback) return fallback();
      throw error;
    }
  }

  /** Current circuit state */
  getState(): CircuitState {
    return this.state;
  }

  /** Number of consecutive failures */
  getFailureCount(): number {
    return this.failureCount;
  }

  /** Manually reset the breaker to CLOSED */
  reset(): void {
    this.failureCount = 0;
    this.transitionTo(CircuitState.CLOSED);
  }

  // ── Internal ─────────────────────────────────────────────────────

  private onSuccess(): void {
    this.failureCount = 0;
    if (this.state !== CircuitState.CLOSED) {
      this.transitionTo(CircuitState.CLOSED);
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      // Probe failed — reopen
      this.transitionTo(CircuitState.OPEN);
    } else if (this.failureCount >= this.failureThreshold) {
      this.transitionTo(CircuitState.OPEN);
    }
  }

  private transitionTo(newState: CircuitState): void {
    if (this.state === newState) return;

    const prev = this.state;
    this.state = newState;

    if (newState === CircuitState.OPEN) {
      this.nextAttemptTime = Date.now() + this.resetTimeout;
    }

    this.onStateChange?.(this.name, prev, newState);
  }
}
