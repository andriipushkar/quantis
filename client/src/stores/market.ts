import { create } from 'zustand';
import type { TickerData } from '@/services/api';

interface MarketState {
  selectedPair: string;
  selectedTimeframe: string;
  selectedExchange: string;
  tickers: Map<string, TickerData>;

  setSelectedPair: (pair: string) => void;
  setSelectedTimeframe: (timeframe: string) => void;
  setSelectedExchange: (exchange: string) => void;
  updateTicker: (symbol: string, data: TickerData) => void;
  updateTickers: (tickers: Record<string, TickerData>) => void;
}

export const useMarketStore = create<MarketState>((set) => ({
  selectedPair: 'BTCUSDT',
  selectedTimeframe: '1h',
  selectedExchange: 'binance',
  tickers: new Map(),

  setSelectedPair: (pair: string) => set({ selectedPair: pair }),
  setSelectedTimeframe: (timeframe: string) => set({ selectedTimeframe: timeframe }),
  setSelectedExchange: (exchange: string) => set({ selectedExchange: exchange }),

  updateTicker: (symbol: string, data: TickerData) =>
    set((state) => {
      const newTickers = new Map(state.tickers);
      newTickers.set(symbol, data);
      return { tickers: newTickers };
    }),

  updateTickers: (tickers: Record<string, TickerData>) =>
    set((state) => {
      const newTickers = new Map(state.tickers);
      Object.entries(tickers).forEach(([symbol, data]) => {
        newTickers.set(symbol, data);
      });
      return { tickers: newTickers };
    }),
}));

export const TIMEFRAMES = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '30m', value: '30m' },
  { label: '1H', value: '1h' },
  { label: '4H', value: '4h' },
  { label: '1D', value: '1d' },
  { label: '1W', value: '1w' },
] as const;
