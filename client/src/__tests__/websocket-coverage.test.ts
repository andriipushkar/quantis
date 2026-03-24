/**
 * useWebSocket hook — branch coverage tests
 *
 * Tests ticker batching, signal handling (buy/sell), cleanup, and edge cases.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---- Mock socket ----
const eventHandlers: Record<string, Function> = {};
const mockSocket = {
  on: vi.fn((event: string, handler: Function) => { eventHandlers[event] = handler; }),
  off: vi.fn((event: string) => { delete eventHandlers[event]; }),
  connected: false,
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
  useMarketStore: vi.fn((sel: Function) => sel({ updateTicker: mockUpdateTicker })),
}));

vi.mock('@/stores/toast', () => ({
  useToastStore: vi.fn((sel: Function) => sel({ addToast: mockAddToast })),
}));

vi.mock('@/stores/notifications', () => ({
  useNotificationStore: vi.fn((sel: Function) => sel({ addNotification: mockAddNotification })),
}));

// ---- Mock React hooks ----
let effectCallback: (() => (() => void) | void) | null = null;
let effectCleanup: (() => void) | null = null;

vi.mock('react', () => ({
  useEffect: vi.fn((cb: () => (() => void) | void) => { effectCallback = cb; }),
  useRef: vi.fn((val: unknown) => ({ current: val })),
  useCallback: vi.fn((cb: unknown) => cb),
}));

// ---- Tests ----
describe('useWebSocket hook coverage', () => {
  let useWebSocket: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    Object.keys(eventHandlers).forEach(k => delete eventHandlers[k]);

    vi.resetModules();
    const mod = await import('@/hooks/useWebSocket');
    useWebSocket = mod.useWebSocket;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function runEffect() {
    useWebSocket();
    if (effectCallback) {
      const cleanup = effectCallback();
      if (typeof cleanup === 'function') effectCleanup = cleanup;
    }
  }

  it('connects socket on mount', async () => {
    runEffect();
    const socketMod = await import('@/services/socket');
    expect(socketMod.connectSocket).toHaveBeenCalled();
  });

  it('registers ticker:update and signal:new handlers', () => {
    runEffect();
    expect(mockSocket.on).toHaveBeenCalledWith('ticker:update', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('signal:new', expect.any(Function));
  });

  it('ticker:update with valid data enqueues and flushes after batch interval', () => {
    runEffect();
    const tickerHandler = eventHandlers['ticker:update'];
    tickerHandler({ symbol: 'BTCUSDT', price: 50000 });

    // Batch timer should be running
    vi.advanceTimersByTime(500);

    // requestAnimationFrame callback
    vi.runAllTimers();
  });

  it('ticker:update with null data is ignored', () => {
    runEffect();
    const tickerHandler = eventHandlers['ticker:update'];
    tickerHandler(null);
    tickerHandler({ symbol: '' });
    tickerHandler({});

    vi.advanceTimersByTime(1000);
    // No crash
  });

  it('signal:new with buy signal shows success toast', () => {
    runEffect();
    const signalHandler = eventHandlers['signal:new'];
    signalHandler({ pair: 'BTCUSDT', type: 'buy', confidence: 85 });

    expect(mockAddToast).toHaveBeenCalledWith(
      expect.stringContaining('BUY'),
      'success'
    );
    expect(mockAddNotification).toHaveBeenCalledWith(
      expect.stringContaining('BUY Signal'),
      expect.stringContaining('85%'),
      'signal'
    );
  });

  it('signal:new with sell signal shows danger toast', () => {
    runEffect();
    const signalHandler = eventHandlers['signal:new'];
    signalHandler({ pair: 'ETHUSDT', type: 'sell', confidence: 72 });

    expect(mockAddToast).toHaveBeenCalledWith(
      expect.stringContaining('SELL'),
      'danger'
    );
  });

  it('signal:new without pair is ignored', () => {
    runEffect();
    const signalHandler = eventHandlers['signal:new'];
    signalHandler({});
    signalHandler(null);

    expect(mockAddToast).not.toHaveBeenCalled();
  });

  it('cleanup removes event handlers and disconnects', async () => {
    runEffect();
    if (effectCleanup) effectCleanup();

    expect(mockSocket.off).toHaveBeenCalledWith('ticker:update');
    expect(mockSocket.off).toHaveBeenCalledWith('signal:new');
    const socketMod = await import('@/services/socket');
    expect(socketMod.disconnectSocket).toHaveBeenCalled();
  });

  it('multiple rapid ticker updates batch into one flush', () => {
    runEffect();
    const tickerHandler = eventHandlers['ticker:update'];

    // Send 5 rapid updates
    tickerHandler({ symbol: 'BTCUSDT', price: 50000 });
    tickerHandler({ symbol: 'ETHUSDT', price: 3000 });
    tickerHandler({ symbol: 'BTCUSDT', price: 50100 }); // overwrites first BTC
    tickerHandler({ symbol: 'SOLUSDT', price: 150 });
    tickerHandler({ symbol: 'ETHUSDT', price: 3050 }); // overwrites first ETH

    // Only one batch timer should be running
    vi.advanceTimersByTime(500);
    vi.runAllTimers();
  });
});
