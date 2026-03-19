import { io, Socket } from 'socket.io-client';
import { getToken } from './api';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io('/', {
      path: '/socket.io',
      auth: {
        token: getToken(),
      },
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export function connectSocket(): void {
  const s = getSocket();
  if (!s.connected) {
    s.auth = { token: getToken() };
    s.connect();
  }
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
}

// Ticker subscriptions
export function subscribeTicker(symbols: string[]): void {
  const s = getSocket();
  s.emit('subscribe:ticker', { symbols });
}

export function unsubscribeTicker(symbols: string[]): void {
  const s = getSocket();
  s.emit('unsubscribe:ticker', { symbols });
}

// OHLCV subscriptions
export function subscribeOHLCV(symbol: string, timeframe: string): void {
  const s = getSocket();
  s.emit('subscribe:ohlcv', { symbol, timeframe });
}

export function unsubscribeOHLCV(symbol: string, timeframe: string): void {
  const s = getSocket();
  s.emit('unsubscribe:ohlcv', { symbol, timeframe });
}

// Signals subscriptions
export function subscribeSignals(): void {
  const s = getSocket();
  s.emit('subscribe:signals');
}

export function unsubscribeSignals(): void {
  const s = getSocket();
  s.emit('unsubscribe:signals');
}

// Alerts subscriptions
export function subscribeAlerts(): void {
  const s = getSocket();
  s.emit('subscribe:alerts');
}

export function unsubscribeAlerts(): void {
  const s = getSocket();
  s.emit('unsubscribe:alerts');
}

export type { Socket };
