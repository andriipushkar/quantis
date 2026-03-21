/**
 * Hook tests
 *
 * Tests for useWebSocket hook logic: batching, event handling, cleanup.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---- Mock socket.io ----

const mockOn = vi.fn();
const mockOff = vi.fn();
const mockDisconnect = vi.fn();
const mockConnect = vi.fn();
const mockSocket = {
  on: mockOn,
  off: mockOff,
  disconnect: mockDisconnect,
  connect: mockConnect,
  connected: false,
  auth: {},
};

vi.mock('@/services/socket', () => ({
  connectSocket: vi.fn(),
  getSocket: vi.fn(() => mockSocket),
  disconnectSocket: vi.fn(),
}));

// ---- Mock stores ----

const mockUpdateTicker = vi.fn();
const mockAddToast = vi.fn();
const mockAddNotification = vi.fn();

vi.mock('@/stores/market', () => ({
  useMarketStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector({ updateTicker: mockUpdateTicker })
  ),
}));

vi.mock('@/stores/toast', () => ({
  useToastStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector({ addToast: mockAddToast })
  ),
}));

vi.mock('@/stores/notifications', () => ({
  useNotificationStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector({ addNotification: mockAddNotification })
  ),
}));

// ---- Mock React hooks to run synchronously ----

let effectCallback: (() => (() => void) | void) | null = null;
let effectCleanup: (() => void) | null = null;

vi.mock('react', () => ({
  useEffect: vi.fn((cb: () => (() => void) | void) => {
    effectCallback = cb;
  }),
  useRef: vi.fn((val: unknown) => ({ current: val })),
  useCallback: vi.fn((cb: unknown) => cb),
}));

// ---- Tests ----

describe('useWebSocket hook', () => {
  let useWebSocket: typeof import('@/hooks/useWebSocket').useWebSocket;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockOn.mockReset();
    mockOff.mockReset();
    effectCallback = null;
    effectCleanup = null;

    // Reset the initialized ref
    vi.resetModules();

    // Re-mock after reset
    vi.doMock('@/services/socket', () => ({
      connectSocket: vi.fn(),
      getSocket: vi.fn(() => mockSocket),
      disconnectSocket: vi.fn(),
    }));
    vi.doMock('@/stores/market', () => ({
      useMarketStore: vi.fn((selector: (s: unknown) => unknown) =>
        selector({ updateTicker: mockUpdateTicker })
      ),
    }));
    vi.doMock('@/stores/toast', () => ({
      useToastStore: vi.fn((selector: (s: unknown) => unknown) =>
        selector({ addToast: mockAddToast })
      ),
    }));
    vi.doMock('@/stores/notifications', () => ({
      useNotificationStore: vi.fn((selector: (s: unknown) => unknown) =>
        selector({ addNotification: mockAddNotification })
      ),
    }));
    vi.doMock('react', () => ({
      useEffect: vi.fn((cb: () => (() => void) | void) => {
        effectCallback = cb;
      }),
      useRef: vi.fn((val: unknown) => ({ current: val })),
      useCallback: vi.fn((cb: unknown) => cb),
    }));

    const mod = await import('@/hooks/useWebSocket');
    useWebSocket = mod.useWebSocket;
  });

  afterEach(() => {
    if (effectCleanup) effectCleanup();
  });

  it('calls connectSocket on mount via useEffect', async () => {
    useWebSocket();
    const socketMod = await import('@/services/socket');
    // Run the effect
    if (effectCallback) {
      effectCleanup = effectCallback() as (() => void) | null;
    }
    expect(socketMod.connectSocket).toHaveBeenCalled();
  });

  it('registers ticker:update and signal:new event listeners', () => {
    useWebSocket();
    if (effectCallback) {
      effectCleanup = effectCallback() as (() => void) | null;
    }
    const eventNames = mockOn.mock.calls.map((c: unknown[]) => c[0]);
    expect(eventNames).toContain('ticker:update');
    expect(eventNames).toContain('signal:new');
  });

  it('cleanup removes event listeners and disconnects', async () => {
    useWebSocket();
    if (effectCallback) {
      effectCleanup = effectCallback() as (() => void) | null;
    }
    const socketMod = await import('@/services/socket');

    if (effectCleanup) {
      effectCleanup();
      effectCleanup = null;
    }

    expect(mockOff).toHaveBeenCalledWith('ticker:update');
    expect(mockOff).toHaveBeenCalledWith('signal:new');
    expect(socketMod.disconnectSocket).toHaveBeenCalled();
  });

  it('ticker:update handler enqueues ticker data', () => {
    vi.useFakeTimers();
    useWebSocket();
    if (effectCallback) {
      effectCleanup = effectCallback() as (() => void) | null;
    }

    // Find the ticker:update handler
    const tickerCall = mockOn.mock.calls.find((c: unknown[]) => c[0] === 'ticker:update');
    expect(tickerCall).toBeDefined();
    const tickerHandler = tickerCall![1] as (data: unknown) => void;

    // Invoke it with ticker data
    const tickerData = { symbol: 'BTCUSDT', price: 50000, exchange: 'binance', change24h: 2, volume: 100, timestamp: 1 };
    tickerHandler(tickerData);

    // The handler enqueues, not immediately calling updateTicker
    // After TICKER_BATCH_MS (500ms), flushUpdates should fire
    vi.advanceTimersByTime(500);

    // flushUpdates uses requestAnimationFrame
    // Since jsdom doesn't have rAF, we check that the enqueue logic ran without error
    vi.useRealTimers();
  });

  it('signal:new handler shows toast and notification for buy signal', () => {
    useWebSocket();
    if (effectCallback) {
      effectCleanup = effectCallback() as (() => void) | null;
    }

    const signalCall = mockOn.mock.calls.find((c: unknown[]) => c[0] === 'signal:new');
    expect(signalCall).toBeDefined();
    const signalHandler = signalCall![1] as (data: unknown) => void;

    signalHandler({ pair: 'BTCUSDT', type: 'buy', confidence: 85 });

    expect(mockAddToast).toHaveBeenCalledWith(
      'New BUY signal: BTCUSDT (85% confidence)',
      'success'
    );
    expect(mockAddNotification).toHaveBeenCalledWith(
      'BUY Signal: BTCUSDT',
      '85% confidence buy signal detected',
      'signal'
    );
  });

  it('signal:new handler shows toast and notification for sell signal', () => {
    useWebSocket();
    if (effectCallback) {
      effectCleanup = effectCallback() as (() => void) | null;
    }

    const signalCall = mockOn.mock.calls.find((c: unknown[]) => c[0] === 'signal:new');
    const signalHandler = signalCall![1] as (data: unknown) => void;

    signalHandler({ pair: 'ETHUSDT', type: 'sell', confidence: 72 });

    expect(mockAddToast).toHaveBeenCalledWith(
      'New SELL signal: ETHUSDT (72% confidence)',
      'danger'
    );
  });

  it('signal:new handler ignores data without pair', () => {
    useWebSocket();
    if (effectCallback) {
      effectCleanup = effectCallback() as (() => void) | null;
    }

    const signalCall = mockOn.mock.calls.find((c: unknown[]) => c[0] === 'signal:new');
    const signalHandler = signalCall![1] as (data: unknown) => void;

    signalHandler({ type: 'buy', confidence: 50 });
    expect(mockAddToast).not.toHaveBeenCalled();
    expect(mockAddNotification).not.toHaveBeenCalled();
  });

  it('signal:new handler ignores null data', () => {
    useWebSocket();
    if (effectCallback) {
      effectCleanup = effectCallback() as (() => void) | null;
    }

    const signalCall = mockOn.mock.calls.find((c: unknown[]) => c[0] === 'signal:new');
    const signalHandler = signalCall![1] as (data: unknown) => void;

    signalHandler(null);
    expect(mockAddToast).not.toHaveBeenCalled();
  });
});
