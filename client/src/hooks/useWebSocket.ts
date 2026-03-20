import { useEffect, useRef, useCallback } from 'react';
import { connectSocket, getSocket, disconnectSocket } from '@/services/socket';
import { useMarketStore } from '@/stores/market';
import { useToastStore } from '@/stores/toast';
import { useNotificationStore } from '@/stores/notifications';
import type { TickerData } from '@/services/api';

/**
 * Batching interval in milliseconds.  All ticker updates received within this
 * window are collected and flushed as a single batch via requestAnimationFrame,
 * preventing excessive re-renders when the server pushes 10+ tickers/second.
 */
const TICKER_BATCH_MS = 500;

export function useWebSocket() {
  const updateTicker = useMarketStore((s) => s.updateTicker);
  const addToast = useToastStore((s) => s.addToast);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const initialized = useRef(false);

  // Pending ticker updates collected within the current batch window
  const pendingUpdates = useRef<Map<string, TickerData>>(new Map());
  const batchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Flush all pending ticker updates in a single requestAnimationFrame callback
   * so the DOM only repaints once per batch.
   */
  const flushUpdates = useCallback(() => {
    const updates = pendingUpdates.current;
    if (updates.size === 0) return;

    // Capture and clear before the async rAF fires
    const batch = new Map(updates);
    updates.clear();

    requestAnimationFrame(() => {
      for (const [symbol, data] of batch) {
        updateTicker(symbol, data);
      }
    });
  }, [updateTicker]);

  /**
   * Enqueue a ticker update.  If no batch timer is running, start one so we
   * flush after TICKER_BATCH_MS.
   */
  const enqueueTicker = useCallback(
    (data: TickerData) => {
      if (!data?.symbol) return;
      pendingUpdates.current.set(data.symbol, data);

      if (!batchTimer.current) {
        batchTimer.current = setTimeout(() => {
          batchTimer.current = null;
          flushUpdates();
        }, TICKER_BATCH_MS);
      }
    },
    [flushUpdates],
  );

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    connectSocket();
    const socket = getSocket();

    socket.on('ticker:update', (data: TickerData) => {
      enqueueTicker(data);
    });

    socket.on('signal:new', (data: { pair?: string; type?: string; confidence?: number }) => {
      if (data?.pair) {
        const dir = data.type === 'buy' ? 'BUY' : 'SELL';
        const message = `New ${dir} signal: ${data.pair} (${data.confidence}% confidence)`;
        addToast(message, data.type === 'buy' ? 'success' : 'danger');
        addNotification(
          `${dir} Signal: ${data.pair}`,
          `${data.confidence}% confidence ${dir.toLowerCase()} signal detected`,
          'signal'
        );
      }
    });

    return () => {
      socket.off('ticker:update');
      socket.off('signal:new');
      disconnectSocket();
      initialized.current = false;

      // Clean up pending batch
      if (batchTimer.current) {
        clearTimeout(batchTimer.current);
        batchTimer.current = null;
      }
      pendingUpdates.current.clear();
    };
  }, [updateTicker, addToast, addNotification, enqueueTicker]);
}
