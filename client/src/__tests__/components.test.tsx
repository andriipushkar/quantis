/**
 * Component tests
 *
 * Tests for Badge, Card, and SignalCard components.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '@/components/common/Badge';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/common/Card';

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

describe('Badge component', () => {
  it('renders children text', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeDefined();
  });

  it('renders with default variant classes', () => {
    const { container } = render(<Badge>Default</Badge>);
    const el = container.firstElementChild!;
    expect(el.className).toContain('text-primary');
  });

  it('renders with success variant', () => {
    const { container } = render(<Badge variant="success">OK</Badge>);
    const el = container.firstElementChild!;
    expect(el.className).toContain('text-success');
  });

  it('renders with danger variant', () => {
    const { container } = render(<Badge variant="danger">Error</Badge>);
    const el = container.firstElementChild!;
    expect(el.className).toContain('text-danger');
  });

  it('renders with warning variant', () => {
    const { container } = render(<Badge variant="warning">Warn</Badge>);
    const el = container.firstElementChild!;
    expect(el.className).toContain('text-warning');
  });

  it('renders with neutral variant', () => {
    const { container } = render(<Badge variant="neutral">Neutral</Badge>);
    const el = container.firstElementChild!;
    expect(el.className).toContain('text-muted-foreground');
  });

  it('applies additional className', () => {
    const { container } = render(<Badge className="ml-2">Extra</Badge>);
    const el = container.firstElementChild!;
    expect(el.className).toContain('ml-2');
  });

  it('has base classes on all variants', () => {
    const { container } = render(<Badge>Base</Badge>);
    const el = container.firstElementChild!;
    expect(el.className).toContain('inline-flex');
    expect(el.className).toContain('text-xs');
    expect(el.className).toContain('font-semibold');
  });
});

// ---------------------------------------------------------------------------
// Card components
// ---------------------------------------------------------------------------

describe('Card component', () => {
  it('renders children', () => {
    render(<Card><span>Card Content</span></Card>);
    expect(screen.getByText('Card Content')).toBeDefined();
  });

  it('applies card base classes', () => {
    const { container } = render(<Card>Test</Card>);
    const el = container.firstElementChild!;
    expect(el.className).toContain('bg-card');
    expect(el.className).toContain('rounded-xl');
  });

  it('merges custom className', () => {
    const { container } = render(<Card className="custom-class">Test</Card>);
    expect(container.firstElementChild!.className).toContain('custom-class');
  });
});

describe('CardHeader component', () => {
  it('renders children', () => {
    render(<CardHeader><span>Header</span></CardHeader>);
    expect(screen.getByText('Header')).toBeDefined();
  });

  it('applies padding classes', () => {
    const { container } = render(<CardHeader>H</CardHeader>);
    expect(container.firstElementChild!.className).toContain('p-5');
  });
});

describe('CardTitle component', () => {
  it('renders as h3 element', () => {
    render(<CardTitle>Title Text</CardTitle>);
    const el = screen.getByText('Title Text');
    expect(el.tagName).toBe('H3');
  });

  it('has uppercase tracking classes', () => {
    const { container } = render(<CardTitle>Title</CardTitle>);
    expect(container.firstElementChild!.className).toContain('uppercase');
    expect(container.firstElementChild!.className).toContain('tracking-wider');
  });
});

describe('CardContent component', () => {
  it('renders children', () => {
    render(<CardContent><p>Paragraph</p></CardContent>);
    expect(screen.getByText('Paragraph')).toBeDefined();
  });
});

describe('CardFooter component', () => {
  it('renders children', () => {
    render(<CardFooter><button>Action</button></CardFooter>);
    expect(screen.getByText('Action')).toBeDefined();
  });

  it('has flex layout', () => {
    const { container } = render(<CardFooter>F</CardFooter>);
    expect(container.firstElementChild!.className).toContain('flex');
  });
});

// ---------------------------------------------------------------------------
// SignalCard
// ---------------------------------------------------------------------------

// Mock react-router-dom's useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

import { SignalCard } from '@/components/dashboard/SignalCard';

describe('SignalCard component', () => {

  const buySignal = {
    id: 's1',
    pair: 'BTCUSDT',
    exchange: 'binance',
    type: 'buy' as const,
    strategy: 'RSI Reversal',
    strength: 'strong' as const,
    confidence: 85,
    entry_price: 50000,
    stop_loss: 48000,
    tp1: 52000,
    tp2: 54000,
    tp3: 56000,
    sources_json: ['RSI', 'MACD'],
    reasoning: 'Bullish divergence',
    timeframe: '4h',
    status: 'active',
    created_at: '2025-01-01T00:00:00Z',
  };

  const sellSignal = { ...buySignal, id: 's2', type: 'sell' as const };

  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it('renders pair name', () => {
    render(<SignalCard signal={buySignal} />);
    expect(screen.getByText('BTCUSDT')).toBeDefined();
  });

  it('renders BUY label for buy signal', () => {
    render(<SignalCard signal={buySignal} />);
    expect(screen.getByText('BUY')).toBeDefined();
  });

  it('renders SELL label for sell signal', () => {
    render(<SignalCard signal={sellSignal} />);
    expect(screen.getByText('SELL')).toBeDefined();
  });

  it('renders confidence percentage', () => {
    render(<SignalCard signal={buySignal} />);
    expect(screen.getByText('85%')).toBeDefined();
  });

  it('renders entry price', () => {
    render(<SignalCard signal={buySignal} />);
    expect(screen.getByText('Entry')).toBeDefined();
  });

  it('renders stop loss label', () => {
    render(<SignalCard signal={buySignal} />);
    expect(screen.getByText('SL')).toBeDefined();
  });

  it('renders take profit labels', () => {
    render(<SignalCard signal={buySignal} />);
    expect(screen.getByText('TP1')).toBeDefined();
    expect(screen.getByText('TP2')).toBeDefined();
  });

  it('renders Open Chart button', () => {
    render(<SignalCard signal={buySignal} />);
    expect(screen.getByText('Open Chart')).toBeDefined();
  });

  it('applies success color class for buy signal type badge', () => {
    const { container } = render(<SignalCard signal={buySignal} />);
    const buyBadge = container.querySelector('.text-success');
    expect(buyBadge).not.toBeNull();
  });

  it('applies danger color class for sell signal type badge', () => {
    const { container } = render(<SignalCard signal={sellSignal} />);
    const sellBadge = container.querySelector('.text-danger');
    expect(sellBadge).not.toBeNull();
  });
});
