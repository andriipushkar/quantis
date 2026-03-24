/**
 * Socket service — unit tests
 *
 * Tests connection lifecycle, subscription tracking, and status management.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock socket.io-client
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  connected: false,
  auth: {},
  io: {
    on: vi.fn(),
  },
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

vi.mock('@/services/api', () => ({
  getToken: vi.fn(() => 'test-token'),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('socket service', () => {
  let socketModule: typeof import('@/services/socket');

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset module state between tests
    vi.resetModules();
    socketModule = await import('@/services/socket');
  });

  describe('getSocket', () => {
    it('returns a socket instance', () => {
      const s = socketModule.getSocket();
      expect(s).toBeDefined();
      expect(s.on).toBeDefined();
    });

    it('returns the same instance on repeated calls', () => {
      const s1 = socketModule.getSocket();
      const s2 = socketModule.getSocket();
      expect(s1).toBe(s2);
    });
  });

  describe('connectSocket', () => {
    it('calls socket.connect() when not connected', () => {
      mockSocket.connected = false;
      socketModule.connectSocket();
      expect(mockSocket.connect).toHaveBeenCalled();
    });

    it('does not call connect() when already connected', () => {
      mockSocket.connected = true;
      socketModule.connectSocket();
      expect(mockSocket.connect).not.toHaveBeenCalled();
    });

    it('sets auth token before connecting', () => {
      mockSocket.connected = false;
      socketModule.connectSocket();
      expect(mockSocket.auth).toEqual({ token: 'test-token' });
    });
  });

  describe('disconnectSocket', () => {
    it('calls socket.disconnect() when connected', () => {
      // First get the socket to initialize it
      socketModule.getSocket();
      mockSocket.connected = true;
      socketModule.disconnectSocket();
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe('onConnectionStatus', () => {
    it('calls listener immediately with current status', () => {
      const listener = vi.fn();
      socketModule.onConnectionStatus(listener);
      expect(listener).toHaveBeenCalledWith('disconnected');
    });

    it('returns unsubscribe function', () => {
      const listener = vi.fn();
      const unsub = socketModule.onConnectionStatus(listener);
      expect(typeof unsub).toBe('function');
    });
  });

  describe('getConnectionStatus', () => {
    it('returns current connection status', () => {
      const status = socketModule.getConnectionStatus();
      expect(['connected', 'connecting', 'disconnected', 'reconnecting']).toContain(status);
    });
  });

  describe('subscribeTicker', () => {
    it('emits subscribe:ticker event with symbols', () => {
      socketModule.subscribeTicker(['BTCUSDT', 'ETHUSDT']);
      expect(mockSocket.emit).toHaveBeenCalledWith('subscribe:ticker', ['BTCUSDT', 'ETHUSDT']);
    });
  });

  describe('unsubscribeTicker', () => {
    it('emits unsubscribe:ticker event', () => {
      socketModule.unsubscribeTicker(['BTCUSDT']);
      expect(mockSocket.emit).toHaveBeenCalledWith('unsubscribe:ticker', ['BTCUSDT']);
    });
  });

  describe('subscribeOHLCV', () => {
    it('emits subscribe:ohlcv event with symbol and timeframe', () => {
      socketModule.subscribeOHLCV('BTCUSDT', '1h');
      expect(mockSocket.emit).toHaveBeenCalledWith('subscribe:ohlcv', { symbol: 'BTCUSDT', timeframe: '1h' });
    });
  });

  describe('unsubscribeOHLCV', () => {
    it('emits unsubscribe:ohlcv event', () => {
      socketModule.unsubscribeOHLCV('BTCUSDT', '1h');
      expect(mockSocket.emit).toHaveBeenCalledWith('unsubscribe:ohlcv', { symbol: 'BTCUSDT', timeframe: '1h' });
    });
  });

  describe('subscribeSignals', () => {
    it('emits subscribe:signals event', () => {
      socketModule.subscribeSignals();
      expect(mockSocket.emit).toHaveBeenCalledWith('subscribe:signals');
    });
  });

  describe('unsubscribeSignals', () => {
    it('emits unsubscribe:signals event', () => {
      socketModule.unsubscribeSignals();
      expect(mockSocket.emit).toHaveBeenCalledWith('unsubscribe:signals');
    });
  });

  describe('subscribeAlerts', () => {
    it('emits subscribe:alerts event', () => {
      socketModule.subscribeAlerts();
      expect(mockSocket.emit).toHaveBeenCalledWith('subscribe:alerts');
    });
  });

  describe('unsubscribeAlerts', () => {
    it('emits unsubscribe:alerts event', () => {
      socketModule.unsubscribeAlerts();
      expect(mockSocket.emit).toHaveBeenCalledWith('unsubscribe:alerts');
    });
  });
});
