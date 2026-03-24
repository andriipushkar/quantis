/**
 * Extended component tests
 *
 * Tests for Button, Input, Spinner, Toast, ToastContainer,
 * ErrorBoundary, and ConnectionStatus components.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks — must come before component imports
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, defaultOrOpts?: any) => typeof defaultOrOpts === 'string' ? defaultOrOpts : key }),
}));

vi.mock('lucide-react', () => ({
  Loader2: (props: React.HTMLAttributes<HTMLSpanElement>) => (
    <span data-testid="loader2-icon" {...props} />
  ),
  CheckCircle: (props: React.HTMLAttributes<HTMLSpanElement>) => (
    <span data-testid="check-circle-icon" {...props} />
  ),
  AlertCircle: (props: React.HTMLAttributes<HTMLSpanElement>) => (
    <span data-testid="alert-circle-icon" {...props} />
  ),
  Info: (props: React.HTMLAttributes<HTMLSpanElement>) => (
    <span data-testid="info-icon" {...props} />
  ),
  X: (props: React.HTMLAttributes<HTMLSpanElement>) => (
    <span data-testid="x-icon" {...props} />
  ),
}));

let mockOnConnectionStatus = vi.fn();
vi.mock('@/services/socket', () => ({
  onConnectionStatus: (...args: unknown[]) => mockOnConnectionStatus(...args),
}));

const mockUseToastStore = vi.fn();
vi.mock('@/stores/toast', () => ({
  useToastStore: (...args: unknown[]) => mockUseToastStore(...args),
}));

// ---------------------------------------------------------------------------
// Component imports (after mocks)
// ---------------------------------------------------------------------------

import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Spinner } from '@/components/common/Spinner';
import { Toast } from '@/components/common/Toast';
import { ToastContainer } from '@/components/common/ToastContainer';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { ConnectionStatus } from '@/components/common/ConnectionStatus';

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

describe('Button component', () => {
  it('renders children text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeDefined();
  });

  it('renders as a button element', () => {
    render(<Button>Test</Button>);
    expect(screen.getByRole('button')).toBeDefined();
  });

  it('applies default variant classes', () => {
    const { container } = render(<Button>Default</Button>);
    const el = container.firstElementChild!;
    expect(el.className).toContain('bg-gold-gradient');
  });

  it('applies secondary variant classes', () => {
    const { container } = render(<Button variant="secondary">Secondary</Button>);
    const el = container.firstElementChild!;
    expect(el.className).toContain('border');
    expect(el.className).toContain('text-primary');
  });

  it('applies destructive variant classes', () => {
    const { container } = render(<Button variant="destructive">Delete</Button>);
    const el = container.firstElementChild!;
    expect(el.className).toContain('bg-danger');
  });

  it('applies ghost variant classes', () => {
    const { container } = render(<Button variant="ghost">Ghost</Button>);
    const el = container.firstElementChild!;
    expect(el.className).toContain('bg-transparent');
    expect(el.className).toContain('text-muted-foreground');
  });

  it('applies outline variant classes', () => {
    const { container } = render(<Button variant="outline">Outline</Button>);
    const el = container.firstElementChild!;
    expect(el.className).toContain('border');
    expect(el.className).toContain('bg-transparent');
    expect(el.className).toContain('text-foreground');
  });

  it('applies sm size classes', () => {
    const { container } = render(<Button size="sm">Small</Button>);
    const el = container.firstElementChild!;
    expect(el.className).toContain('h-8');
    expect(el.className).toContain('px-3');
    expect(el.className).toContain('text-xs');
  });

  it('applies default size classes', () => {
    const { container } = render(<Button size="default">Medium</Button>);
    const el = container.firstElementChild!;
    expect(el.className).toContain('h-10');
    expect(el.className).toContain('px-5');
    expect(el.className).toContain('text-sm');
  });

  it('applies lg size classes', () => {
    const { container } = render(<Button size="lg">Large</Button>);
    const el = container.firstElementChild!;
    expect(el.className).toContain('h-12');
    expect(el.className).toContain('px-8');
    expect(el.className).toContain('text-base');
  });

  it('shows Loader2 icon when isLoading is true', () => {
    render(<Button isLoading>Loading</Button>);
    expect(screen.getByTestId('loader2-icon')).toBeDefined();
  });

  it('disables button when isLoading is true', () => {
    render(<Button isLoading>Loading</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveProperty('disabled', true);
  });

  it('does not show Loader2 icon when isLoading is false', () => {
    render(<Button isLoading={false}>Normal</Button>);
    expect(screen.queryByTestId('loader2-icon')).toBeNull();
  });

  it('disables button when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toHaveProperty('disabled', true);
  });

  it('fires onClick handler', () => {
    const handler = vi.fn();
    render(<Button onClick={handler}>Click</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('merges custom className', () => {
    const { container } = render(<Button className="extra-class">Ext</Button>);
    expect(container.firstElementChild!.className).toContain('extra-class');
  });

  it('has base inline-flex class', () => {
    const { container } = render(<Button>Base</Button>);
    expect(container.firstElementChild!.className).toContain('inline-flex');
  });

  it('forwards ref to button element', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Ref</Button>);
    expect(ref.current).not.toBeNull();
    expect(ref.current!.tagName).toBe('BUTTON');
  });

  it('has displayName set to Button', () => {
    expect(Button.displayName).toBe('Button');
  });
});

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

describe('Input component', () => {
  it('renders an input element', () => {
    render(<Input placeholder="Type here" />);
    expect(screen.getByPlaceholderText('Type here')).toBeDefined();
  });

  it('renders label when label prop is provided', () => {
    render(<Input label="Email" />);
    expect(screen.getByText('Email')).toBeDefined();
  });

  it('label is a <label> element', () => {
    render(<Input label="Username" />);
    const label = screen.getByText('Username');
    expect(label.tagName).toBe('LABEL');
  });

  it('associates label with input via htmlFor', () => {
    render(<Input label="Password" />);
    const label = screen.getByText('Password');
    expect(label.getAttribute('for')).toBe('password');
  });

  it('does not render label when label prop is absent', () => {
    const { container } = render(<Input />);
    const labels = container.querySelectorAll('label');
    expect(labels.length).toBe(0);
  });

  it('shows error text when error prop is provided', () => {
    render(<Input error="Required field" />);
    expect(screen.getByText('Required field')).toBeDefined();
  });

  it('error text has danger class', () => {
    render(<Input error="Invalid" />);
    const errEl = screen.getByText('Invalid');
    expect(errEl.className).toContain('text-danger');
  });

  it('applies border-danger class to input when error is set', () => {
    const { container } = render(<Input error="Oops" />);
    const input = container.querySelector('input')!;
    expect(input.className).toContain('border-danger');
  });

  it('does not show error text when error prop is absent', () => {
    const { container } = render(<Input />);
    const errorPs = container.querySelectorAll('p');
    expect(errorPs.length).toBe(0);
  });

  it('merges custom className', () => {
    const { container } = render(<Input className="my-input" />);
    const input = container.querySelector('input')!;
    expect(input.className).toContain('my-input');
  });

  it('forwards ref to input element', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input ref={ref} />);
    expect(ref.current).not.toBeNull();
    expect(ref.current!.tagName).toBe('INPUT');
  });

  it('has displayName set to Input', () => {
    expect(Input.displayName).toBe('Input');
  });

  it('uses provided id over generated id', () => {
    render(<Input label="Name" id="custom-id" />);
    const input = screen.getByRole('textbox');
    expect(input.id).toBe('custom-id');
  });

  it('input has base classes', () => {
    const { container } = render(<Input />);
    const input = container.querySelector('input')!;
    expect(input.className).toContain('rounded-lg');
    expect(input.className).toContain('bg-secondary');
  });
});

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------

describe('Spinner component', () => {
  it('renders with role="status"', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toBeDefined();
  });

  it('has aria-label="Loading"', () => {
    render(<Spinner />);
    expect(screen.getByRole('status').getAttribute('aria-label')).toBe('Loading');
  });

  it('applies sm size classes', () => {
    const { container } = render(<Spinner size="sm" />);
    const el = container.firstElementChild!;
    expect(el.className).toContain('w-4');
    expect(el.className).toContain('h-4');
    expect(el.className).toContain('border-2');
  });

  it('applies md size classes by default', () => {
    const { container } = render(<Spinner />);
    const el = container.firstElementChild!;
    expect(el.className).toContain('w-8');
    expect(el.className).toContain('h-8');
  });

  it('applies lg size classes', () => {
    const { container } = render(<Spinner size="lg" />);
    const el = container.firstElementChild!;
    expect(el.className).toContain('w-12');
    expect(el.className).toContain('h-12');
    expect(el.className).toContain('border-4');
  });

  it('has animate-spin class', () => {
    const { container } = render(<Spinner />);
    expect(container.firstElementChild!.className).toContain('animate-spin');
  });

  it('has rounded-full class', () => {
    const { container } = render(<Spinner />);
    expect(container.firstElementChild!.className).toContain('rounded-full');
  });

  it('merges custom className', () => {
    const { container } = render(<Spinner className="mt-4" />);
    expect(container.firstElementChild!.className).toContain('mt-4');
  });
});

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

describe('Toast component', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    onClose.mockReset();
    vi.useFakeTimers();
  });

  it('renders message text', () => {
    render(<Toast message="Saved!" type="success" onClose={onClose} />);
    expect(screen.getByText('Saved!')).toBeDefined();
  });

  it('renders success icon for success type', () => {
    render(<Toast message="OK" type="success" onClose={onClose} />);
    expect(screen.getByTestId('check-circle-icon')).toBeDefined();
  });

  it('renders alert icon for danger type', () => {
    render(<Toast message="Error" type="danger" onClose={onClose} />);
    expect(screen.getByTestId('alert-circle-icon')).toBeDefined();
  });

  it('renders info icon for info type', () => {
    render(<Toast message="Note" type="info" onClose={onClose} />);
    expect(screen.getByTestId('info-icon')).toBeDefined();
  });

  it('applies success color classes', () => {
    const { container } = render(<Toast message="OK" type="success" onClose={onClose} />);
    const el = container.firstElementChild!;
    expect(el.className).toContain('text-success');
    expect(el.className).toContain('bg-success/10');
  });

  it('applies danger color classes', () => {
    const { container } = render(<Toast message="Fail" type="danger" onClose={onClose} />);
    const el = container.firstElementChild!;
    expect(el.className).toContain('text-danger');
    expect(el.className).toContain('bg-danger/10');
  });

  it('applies info color classes', () => {
    const { container } = render(<Toast message="Info" type="info" onClose={onClose} />);
    const el = container.firstElementChild!;
    expect(el.className).toContain('text-primary');
    expect(el.className).toContain('bg-primary/10');
  });

  it('renders close button with X icon', () => {
    render(<Toast message="Close me" type="info" onClose={onClose} />);
    expect(screen.getByTestId('x-icon')).toBeDefined();
  });

  it('calls onClose when close button is clicked (after animation delay)', () => {
    render(<Toast message="Close" type="info" onClose={onClose} />);
    const closeBtn = screen.getByTestId('x-icon').parentElement!;
    fireEvent.click(closeBtn);
    // onClose is called after 300ms animation delay
    vi.advanceTimersByTime(300);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('auto-closes after timeout', () => {
    render(<Toast message="Auto" type="info" onClose={onClose} />);
    vi.advanceTimersByTime(5000);
    expect(onClose).toHaveBeenCalled();
  });

  it('has flex layout class', () => {
    const { container } = render(<Toast message="Flex" type="info" onClose={onClose} />);
    expect(container.firstElementChild!.className).toContain('flex');
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// ToastContainer
// ---------------------------------------------------------------------------

describe('ToastContainer component', () => {
  beforeEach(() => {
    mockUseToastStore.mockReset();
  });

  it('renders nothing when there are no toasts', () => {
    mockUseToastStore.mockImplementation((selector: (s: unknown) => unknown) => {
      const state = { toasts: [], removeToast: vi.fn() };
      return selector(state);
    });
    const { container } = render(<ToastContainer />);
    expect(container.innerHTML).toBe('');
  });

  it('renders toasts when present', () => {
    const removeToast = vi.fn();
    mockUseToastStore.mockImplementation((selector: (s: unknown) => unknown) => {
      const state = {
        toasts: [
          { id: '1', message: 'Toast One', type: 'success' as const },
          { id: '2', message: 'Toast Two', type: 'danger' as const },
        ],
        removeToast,
      };
      return selector(state);
    });
    render(<ToastContainer />);
    expect(screen.getByText('Toast One')).toBeDefined();
    expect(screen.getByText('Toast Two')).toBeDefined();
  });

  it('renders a single toast', () => {
    mockUseToastStore.mockImplementation((selector: (s: unknown) => unknown) => {
      const state = {
        toasts: [{ id: '1', message: 'Only One', type: 'info' as const }],
        removeToast: vi.fn(),
      };
      return selector(state);
    });
    render(<ToastContainer />);
    expect(screen.getByText('Only One')).toBeDefined();
  });

  it('container has fixed positioning class when toasts exist', () => {
    mockUseToastStore.mockImplementation((selector: (s: unknown) => unknown) => {
      const state = {
        toasts: [{ id: '1', message: 'Pos', type: 'info' as const }],
        removeToast: vi.fn(),
      };
      return selector(state);
    });
    const { container } = render(<ToastContainer />);
    const wrapper = container.firstElementChild!;
    expect(wrapper.className).toContain('fixed');
    expect(wrapper.className).toContain('bottom-6');
    expect(wrapper.className).toContain('right-6');
  });
});

// ---------------------------------------------------------------------------
// ErrorBoundary
// ---------------------------------------------------------------------------

describe('ErrorBoundary component', () => {
  // Suppress console.error from React and our ErrorBoundary during tests
  const originalConsoleError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
  });
  afterEach(() => {
    console.error = originalConsoleError;
  });

  // Helper that throws an error when rendered
  const ThrowError: React.FC<{ shouldThrow?: boolean }> = ({ shouldThrow = true }) => {
    if (shouldThrow) {
      throw new Error('Test explosion');
    }
    return <div>No error</div>;
  };

  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>All good</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('All good')).toBeDefined();
  });

  it('shows "Something went wrong" on error', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeDefined();
  });

  it('shows the explanatory paragraph on error', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    expect(
      screen.getByText('An unexpected error occurred. Please try reloading the page.')
    ).toBeDefined();
  });

  it('shows "Reload Page" button on error', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    expect(screen.getByText('Reload Page')).toBeDefined();
  });

  it('shows "Show error details" toggle on error', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    expect(screen.getByText('Show error details')).toBeDefined();
  });

  it('does not show error details by default', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    expect(screen.queryByText(/Test explosion/)).toBeNull();
  });

  it('shows error details after clicking toggle', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    fireEvent.click(screen.getByText('Show error details'));
    expect(screen.getAllByText(/Test explosion/).length).toBeGreaterThan(0);
  });

  it('changes toggle text to "Hide details" after expanding', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    fireEvent.click(screen.getByText('Show error details'));
    expect(screen.getByText('Hide details')).toBeDefined();
  });

  it('hides error details after toggling twice', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    const toggle = screen.getByText('Show error details');
    fireEvent.click(toggle);
    expect(screen.getAllByText(/Test explosion/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('Hide details'));
    // After hiding, the details section (with error name) should be gone
    expect(screen.getByText('Show error details')).toBeDefined();
  });

  it('shows exclamation icon in error state', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    expect(screen.getByText('!')).toBeDefined();
  });

  it('does not show error UI when children render fine', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText('No error')).toBeDefined();
    expect(screen.queryByText('Something went wrong')).toBeNull();
  });

  it('error name and message appear in details', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    fireEvent.click(screen.getByText('Show error details'));
    expect(screen.getAllByText(/Error: Test explosion/).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// ConnectionStatus
// ---------------------------------------------------------------------------

describe('ConnectionStatus component', () => {
  beforeEach(() => {
    mockOnConnectionStatus.mockReset();
    mockOnConnectionStatus.mockImplementation(() => vi.fn()); // return cleanup fn
  });

  it('shows "Offline" label by default (initial state is disconnected)', () => {
    render(<ConnectionStatus />);
    expect(screen.getByText('Offline')).toBeDefined();
  });

  it('shows "Live" when status changes to connected', () => {
    mockOnConnectionStatus.mockImplementation((cb: (s: string) => void) => {
      cb('connected');
      return vi.fn();
    });
    render(<ConnectionStatus />);
    expect(screen.getByText('Live')).toBeDefined();
  });

  it('shows "Connecting..." when status is connecting', () => {
    mockOnConnectionStatus.mockImplementation((cb: (s: string) => void) => {
      cb('connecting');
      return vi.fn();
    });
    render(<ConnectionStatus />);
    expect(screen.getByText('Connecting...')).toBeDefined();
  });

  it('shows "Reconnecting..." when status is reconnecting', () => {
    mockOnConnectionStatus.mockImplementation((cb: (s: string) => void) => {
      cb('reconnecting');
      return vi.fn();
    });
    render(<ConnectionStatus />);
    expect(screen.getByText('Reconnecting...')).toBeDefined();
  });

  it('shows colored dot element', () => {
    const { container } = render(<ConnectionStatus />);
    const dot = container.querySelector('.rounded-full');
    expect(dot).not.toBeNull();
  });

  it('dot has bg-danger class when disconnected', () => {
    const { container } = render(<ConnectionStatus />);
    const dot = container.querySelector('.rounded-full')!;
    expect(dot.className).toContain('bg-danger');
  });

  it('dot has bg-success class when connected', () => {
    mockOnConnectionStatus.mockImplementation((cb: (s: string) => void) => {
      cb('connected');
      return vi.fn();
    });
    const { container } = render(<ConnectionStatus />);
    const dot = container.querySelector('.rounded-full')!;
    expect(dot.className).toContain('bg-success');
  });

  it('dot has bg-primary class when connecting', () => {
    mockOnConnectionStatus.mockImplementation((cb: (s: string) => void) => {
      cb('connecting');
      return vi.fn();
    });
    const { container } = render(<ConnectionStatus />);
    const dot = container.querySelector('.rounded-full')!;
    expect(dot.className).toContain('bg-primary');
  });

  it('dot has bg-warning class when reconnecting', () => {
    mockOnConnectionStatus.mockImplementation((cb: (s: string) => void) => {
      cb('reconnecting');
      return vi.fn();
    });
    const { container } = render(<ConnectionStatus />);
    const dot = container.querySelector('.rounded-full')!;
    expect(dot.className).toContain('bg-warning');
  });

  it('dot pulses when connecting', () => {
    mockOnConnectionStatus.mockImplementation((cb: (s: string) => void) => {
      cb('connecting');
      return vi.fn();
    });
    const { container } = render(<ConnectionStatus />);
    const dot = container.querySelector('.rounded-full')!;
    expect(dot.className).toContain('animate-pulse');
  });

  it('dot pulses when reconnecting', () => {
    mockOnConnectionStatus.mockImplementation((cb: (s: string) => void) => {
      cb('reconnecting');
      return vi.fn();
    });
    const { container } = render(<ConnectionStatus />);
    const dot = container.querySelector('.rounded-full')!;
    expect(dot.className).toContain('animate-pulse');
  });

  it('dot does not pulse when connected', () => {
    mockOnConnectionStatus.mockImplementation((cb: (s: string) => void) => {
      cb('connected');
      return vi.fn();
    });
    const { container } = render(<ConnectionStatus />);
    const dot = container.querySelector('.rounded-full')!;
    expect(dot.className).not.toContain('animate-pulse');
  });

  it('dot does not pulse when disconnected', () => {
    const { container } = render(<ConnectionStatus />);
    const dot = container.querySelector('.rounded-full')!;
    expect(dot.className).not.toContain('animate-pulse');
  });

  it('has title attribute with WebSocket status', () => {
    const { container } = render(<ConnectionStatus />);
    const wrapper = container.firstElementChild!;
    expect(wrapper.getAttribute('title')).toBe('WebSocket: disconnected');
  });

  it('has flex layout class', () => {
    const { container } = render(<ConnectionStatus />);
    expect(container.firstElementChild!.className).toContain('flex');
  });

  it('calls onConnectionStatus on mount', () => {
    render(<ConnectionStatus />);
    expect(mockOnConnectionStatus).toHaveBeenCalledTimes(1);
  });
});
