import { Component, type ErrorInfo, type ReactNode } from 'react';

interface RootErrorBoundaryProps {
  children: ReactNode;
}

interface RootErrorBoundaryState {
  hasError: boolean;
}

interface RootErrorFallbackProps {
  onReload: () => void;
}

function RootErrorFallback({ onReload }: RootErrorFallbackProps) {
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-canvas px-6 py-12 text-ink"
      role="alert"
    >
      <section className="w-full max-w-md rounded-xl border border-hairline bg-surface-1 p-6 text-center shadow-sm">
        <div
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-semantic-danger/10 text-xl text-semantic-danger"
          aria-hidden="true"
        >
          !
        </div>
        <h1 className="text-lg font-semibold">Aplikasi mengalami gangguan</h1>
        <p className="mt-2 text-sm leading-6 text-ink-subtle">
          Halaman tidak dapat ditampilkan saat ini. Muat ulang halaman untuk mencoba lagi.
        </p>
        <button
          type="button"
          onClick={onReload}
          className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-focus focus-visible:ring-offset-2"
        >
          Muat ulang halaman
        </button>
      </section>
    </main>
  );
}

export class RootErrorBoundary extends Component<
  RootErrorBoundaryProps,
  RootErrorBoundaryState
> {
  state: RootErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RootErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('Unhandled application error', error, errorInfo);
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return <RootErrorFallback onReload={this.handleReload} />;
    }

    return this.props.children;
  }
}
