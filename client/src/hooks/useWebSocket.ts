import { useEffect, useRef } from 'react';
import { connectSocket, getSocket, disconnectSocket } from '@/services/socket';
import { useMarketStore } from '@/stores/market';
import type { TickerData } from '@/services/api';

export function useWebSocket() {
  const updateTicker = useMarketStore((s) => s.updateTicker);
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

    return () => {
      socket.off('ticker:update');
      disconnectSocket();
      initialized.current = false;
    };
  }, [updateTicker]);
}
