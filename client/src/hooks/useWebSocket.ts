import { useEffect, useRef } from 'react';
import { connectSocket, getSocket, disconnectSocket } from '@/services/socket';
import { useMarketStore } from '@/stores/market';
import { useToastStore } from '@/stores/toast';
import type { TickerData } from '@/services/api';

export function useWebSocket() {
  const updateTicker = useMarketStore((s) => s.updateTicker);
  const addToast = useToastStore((s) => s.addToast);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    connectSocket();
    const socket = getSocket();

    socket.on('ticker:update', (data: TickerData) => {
      if (data?.symbol) {
        updateTicker(data.symbol, data);
      }
    });

    socket.on('signal:new', (data: { pair?: string; type?: string; confidence?: number }) => {
      if (data?.pair) {
        const dir = data.type === 'buy' ? 'BUY' : 'SELL';
        addToast(
          `New ${dir} signal: ${data.pair} (${data.confidence}% confidence)`,
          data.type === 'buy' ? 'success' : 'danger'
        );
      }
    });

    return () => {
      socket.off('ticker:update');
      socket.off('signal:new');
      disconnectSocket();
      initialized.current = false;
    };
  }, [updateTicker, addToast]);
}
