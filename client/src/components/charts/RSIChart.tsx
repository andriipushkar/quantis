import React, { useEffect, useRef, useCallback } from 'react';

interface RSIChartProps {
  data: { time: number; value: number }[];
  height?: number;
}

export const RSIChart: React.FC<RSIChartProps> = ({ data, height = 100 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = height;
    const padLeft = 40;
    const padRight = 8;
    const padTop = 4;
    const padBottom = 4;
    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;

    // Read theme background from CSS variable
    const rootStyle = getComputedStyle(document.documentElement);
    const bgHsl = rootStyle.getPropertyValue('--card')?.trim();
    const bgColor = bgHsl ? `hsl(${bgHsl})` : '#1a1a2e';
    const mutedColor = rootStyle.getPropertyValue('--muted-foreground')?.trim();
    const textColor = mutedColor ? `hsl(${mutedColor})` : '#888';

    // Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);

    // Helper: Y position from RSI value (0-100)
    const yFromRsi = (rsi: number) => padTop + chartH - (rsi / 100) * chartH;
    const xFromIdx = (i: number) => padLeft + (i / Math.max(data.length - 1, 1)) * chartW;

    // Fill zones: green below 30, red above 70
    // Green zone (RSI 0-30)
    ctx.fillStyle = 'rgba(34, 197, 94, 0.08)';
    ctx.fillRect(padLeft, yFromRsi(30), chartW, yFromRsi(0) - yFromRsi(30));

    // Red zone (RSI 70-100)
    ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
    ctx.fillRect(padLeft, yFromRsi(100), chartW, yFromRsi(70) - yFromRsi(100));

    // Dashed lines at 30 and 70
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;

    // Line at 30
    ctx.beginPath();
    ctx.moveTo(padLeft, yFromRsi(30));
    ctx.lineTo(w - padRight, yFromRsi(30));
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.5)';
    ctx.stroke();

    // Line at 70
    ctx.beginPath();
    ctx.moveTo(padLeft, yFromRsi(70));
    ctx.lineTo(w - padRight, yFromRsi(70));
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
    ctx.stroke();

    // Line at 50 (lighter)
    ctx.beginPath();
    ctx.moveTo(padLeft, yFromRsi(50));
    ctx.lineTo(w - padRight, yFromRsi(50));
    ctx.strokeStyle = 'rgba(128, 128, 128, 0.2)';
    ctx.stroke();

    ctx.setLineDash([]);

    // Y axis labels
    ctx.fillStyle = textColor;
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('70', padLeft - 4, yFromRsi(70));
    ctx.fillText('30', padLeft - 4, yFromRsi(30));
    ctx.fillText('50', padLeft - 4, yFromRsi(50));

    // Draw RSI line
    ctx.beginPath();
    data.forEach((point, i) => {
      const x = xFromIdx(i);
      const y = yFromRsi(Math.max(0, Math.min(100, point.value)));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = 'hsl(217, 91%, 60%)'; // blue
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }, [data, height]);

  useEffect(() => {
    draw();
    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  return (
    <div ref={containerRef} className="w-full" style={{ height }}>
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};
