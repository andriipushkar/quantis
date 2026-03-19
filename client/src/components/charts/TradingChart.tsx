import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  ColorType,
  CrosshairMode,
  type CandlestickData,
  type HistogramData,
  type Time,
} from 'lightweight-charts';
import { useThemeStore } from '@/stores/theme';

export interface OHLCVData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TradingChartProps {
  symbol: string;
  timeframe: string;
  data: OHLCVData[];
  className?: string;
}

export interface TradingChartRef {
  chart: IChartApi | null;
  candleSeries: ISeriesApi<'Candlestick'> | null;
  volumeSeries: ISeriesApi<'Histogram'> | null;
  update: (bar: OHLCVData) => void;
}

function getChartColors(theme: 'dark' | 'light') {
  if (theme === 'light') {
    return {
      background: '#F8F6F0',
      textColor: '#5A5A5A',
      gridColor: '#E5E0D5',
      borderColor: '#E5E0D5',
      crosshairColor: '#A08840',
    };
  }
  return {
    background: '#0B0E11',
    textColor: '#848E9C',
    gridColor: '#1E2329',
    borderColor: '#1E2329',
    crosshairColor: '#C9A84C',
  };
}

export const TradingChart = forwardRef<TradingChartRef, TradingChartProps>(
  ({ symbol, timeframe, data, className }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const { theme } = useThemeStore();

    useImperativeHandle(ref, () => ({
      chart: chartRef.current,
      candleSeries: candleSeriesRef.current,
      volumeSeries: volumeSeriesRef.current,
      update: (bar: OHLCVData) => {
        if (candleSeriesRef.current) {
          candleSeriesRef.current.update({
            time: bar.time as Time,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
          });
        }
        if (volumeSeriesRef.current) {
          volumeSeriesRef.current.update({
            time: bar.time as Time,
            value: bar.volume,
            color: bar.close >= bar.open ? 'rgba(14, 203, 129, 0.3)' : 'rgba(246, 70, 93, 0.3)',
          });
        }
      },
    }));

    // Apply theme changes to existing chart
    useEffect(() => {
      if (!chartRef.current) return;
      const colors = getChartColors(theme);
      chartRef.current.applyOptions({
        layout: {
          background: { type: ColorType.Solid, color: colors.background },
          textColor: colors.textColor,
        },
        grid: {
          vertLines: { color: colors.gridColor },
          horzLines: { color: colors.gridColor },
        },
        rightPriceScale: { borderColor: colors.borderColor },
        timeScale: { borderColor: colors.borderColor },
        crosshair: {
          vertLine: { color: colors.crosshairColor, labelBackgroundColor: colors.crosshairColor },
          horzLine: { color: colors.crosshairColor, labelBackgroundColor: colors.crosshairColor },
        },
      });
    }, [theme]);

    useEffect(() => {
      if (!containerRef.current) return;

      const colors = getChartColors(theme);

      const chart = createChart(containerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: colors.background },
          textColor: colors.textColor,
        },
        grid: {
          vertLines: { color: colors.gridColor },
          horzLines: { color: colors.gridColor },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: colors.crosshairColor, width: 1, style: 3, labelBackgroundColor: colors.crosshairColor },
          horzLine: { color: colors.crosshairColor, width: 1, style: 3, labelBackgroundColor: colors.crosshairColor },
        },
        rightPriceScale: {
          borderColor: colors.borderColor,
          scaleMargins: { top: 0.1, bottom: 0.25 },
        },
        timeScale: {
          borderColor: colors.borderColor,
          timeVisible: true,
          secondsVisible: false,
        },
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });

      chartRef.current = chart;

      const candleSeries = chart.addCandlestickSeries({
        upColor: '#0ECB81',
        downColor: '#F6465D',
        borderDownColor: '#F6465D',
        borderUpColor: '#0ECB81',
        wickDownColor: '#F6465D',
        wickUpColor: '#0ECB81',
      });
      candleSeriesRef.current = candleSeries;

      const volumeSeries = chart.addHistogramSeries({
        priceFormat: { type: 'volume' },
        priceScaleId: '',
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });
      volumeSeriesRef.current = volumeSeries;

      const handleResize = () => {
        if (containerRef.current) {
          chart.applyOptions({
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
          });
        }
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        chart.remove();
        chartRef.current = null;
        candleSeriesRef.current = null;
        volumeSeriesRef.current = null;
      };
    }, []);

    useEffect(() => {
      if (!candleSeriesRef.current || !volumeSeriesRef.current || data.length === 0) return;

      const candleData: CandlestickData[] = data.map((d) => ({
        time: d.time as Time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }));

      const volumeData: HistogramData[] = data.map((d) => ({
        time: d.time as Time,
        value: d.volume,
        color: d.close >= d.open ? 'rgba(14, 203, 129, 0.3)' : 'rgba(246, 70, 93, 0.3)',
      }));

      candleSeriesRef.current.setData(candleData);
      volumeSeriesRef.current.setData(volumeData);
      chartRef.current?.timeScale().fitContent();
    }, [data, symbol, timeframe]);

    return (
      <div
        ref={containerRef}
        className={className || 'w-full h-full min-h-[400px]'}
      />
    );
  }
);

TradingChart.displayName = 'TradingChart';
