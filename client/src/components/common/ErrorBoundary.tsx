import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, showDetails: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  toggleDetails = (): void => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-card border border-border rounded-xl p-8 text-center space-y-5">
            {/* Icon */}
            <div className="mx-auto w-14 h-14 rounded-xl bg-danger/15 flex items-center justify-center">
              <span className="text-danger text-2xl font-bold">!</span>
            </div>

            {/* Message */}
            <div>
              <h1 className="text-lg font-bold text-foreground">Something went wrong</h1>
              <p className="text-sm text-muted-foreground mt-2">
                An unexpected error occurred. Please try reloading the page.
              </p>
            </div>

            {/* Reload button */}
            <button
              onClick={this.handleReload}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm transition-colors hover:bg-primary/90"
            >
              Reload Page
            </button>

            {/* Collapsible error details */}
            {this.state.error && (
              <div className="text-left">
                <button
                  onClick={this.toggleDetails}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {this.state.showDetails ? 'Hide details' : 'Show error details'}
                </button>

                {this.state.showDetails && (
                  <div className="mt-2 p-3 rounded-lg bg-secondary border border-border text-xs font-mono text-muted-foreground overflow-auto max-h-40">
                    <p className="font-semibold text-danger mb-1">{this.state.error.name}: {this.state.error.message}</p>
                    {this.state.error.stack && (
                      <pre className="whitespace-pre-wrap break-words opacity-70">
                        {this.state.error.stack}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
