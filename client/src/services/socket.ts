import { io, Socket } from 'socket.io-client';
import { getToken } from './api';

let socket: Socket | null = null;

// ── Connection status ──────────────────────────────────────────────

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

type StatusListener = (status: ConnectionStatus) => void;
const statusListeners = new Set<StatusListener>();
let currentStatus: ConnectionStatus = 'disconnected';

function setStatus(status: ConnectionStatus) {
  currentStatus = status;
  statusListeners.forEach((fn) => fn(status));
}

export function onConnectionStatus(fn: StatusListener): () => void {
  statusListeners.add(fn);
  fn(currentStatus); // immediate current state
  return () => statusListeners.delete(fn);
}

export function getConnectionStatus(): ConnectionStatus {
  return currentStatus;
}

// ── Subscription tracking (for resubscription after reconnect) ─────

const activeSubscriptions = {
  tickers: new Set<string>(),
  ohlcv: new Set<string>(), // stored as "SYMBOL:TIMEFRAME"
  signals: false,
  alerts: false,
};

function resubscribeAll(s: Socket) {
  if (activeSubscriptions.tickers.size > 0) {
    s.emit('subscribe:ticker', Array.from(activeSubscriptions.tickers));
  }
  for (const key of activeSubscriptions.ohlcv) {
    const [symbol, timeframe] = key.split(':');
    s.emit('subscribe:ohlcv', { symbol, timeframe });
  }
  if (activeSubscriptions.signals) {
    s.emit('subscribe:signals');
  }
  if (activeSubscriptions.alerts) {
    s.emit('subscribe:alerts');
  }
}

// ── Socket lifecycle ───────────────────────────────────────────────

export function getSocket(): Socket {
  if (!socket) {
    socket = io('/', {
      path: '/socket.io',
      auth: { token: getToken() },
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      randomizationFactor: 0.3,
      timeout: 10000,
    });

    // Status tracking
    socket.on('connect', () => {
      setStatus('connected');
      resubscribeAll(socket!);
    });

    socket.on('disconnect', () => {
      setStatus('disconnected');
    });

    socket.io.on('reconnect_attempt', () => {
      setStatus('reconnecting');
    });

    socket.io.on('reconnect', () => {
      setStatus('connected');
    });

    socket.io.on('reconnect_error', () => {
      setStatus('reconnecting');
    });

    socket.on('connect_error', () => {
      setStatus('reconnecting');
    });
  }
  return socket;
}

export function connectSocket(): void {
  const s = getSocket();
  if (!s.connected) {
    setStatus('connecting');
    s.auth = { token: getToken() };
    s.connect();
  }
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
  setStatus('disconnected');
}

// ── Subscription helpers (track + emit) ────────────────────────────

export function subscribeTicker(symbols: string[]): void {
  const s = getSocket();
  symbols.forEach((sym) => activeSubscriptions.tickers.add(sym));
  s.emit('subscribe:ticker', symbols);
}

export function unsubscribeTicker(symbols: string[]): void {
  const s = getSocket();
  symbols.forEach((sym) => activeSubscriptions.tickers.delete(sym));
  s.emit('unsubscribe:ticker', symbols);
}

export function subscribeOHLCV(symbol: string, timeframe: string): void {
  const s = getSocket();
  activeSubscriptions.ohlcv.add(`${symbol}:${timeframe}`);
  s.emit('subscribe:ohlcv', { symbol, timeframe });
}

export function unsubscribeOHLCV(symbol: string, timeframe: string): void {
  const s = getSocket();
  activeSubscriptions.ohlcv.delete(`${symbol}:${timeframe}`);
  s.emit('unsubscribe:ohlcv', { symbol, timeframe });
}

export function subscribeSignals(): void {
  const s = getSocket();
  activeSubscriptions.signals = true;
  s.emit('subscribe:signals');
}

export function unsubscribeSignals(): void {
  const s = getSocket();
  activeSubscriptions.signals = false;
  s.emit('unsubscribe:signals');
}

export function subscribeAlerts(): void {
  const s = getSocket();
  activeSubscriptions.alerts = true;
  s.emit('subscribe:alerts');
}

export function unsubscribeAlerts(): void {
  const s = getSocket();
  activeSubscriptions.alerts = false;
  s.emit('unsubscribe:alerts');
}

export type { Socket };
