import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportClientError } from '@/shared/monitoring/reportClientError';
import { AppErrorFallback } from './AppErrorFallback';

interface RootErrorBoundaryProps {
  children: ReactNode;
}

type RootErrorBoundaryState = { hasError: false } | { hasError: true; error: unknown };

export class RootErrorBoundary extends Component<
  RootErrorBoundaryProps,
  RootErrorBoundaryState
> {
  state: RootErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: unknown): RootErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    reportClientError({ kind: 'render', code: 'RENDER_ERROR' });
    if (import.meta.env.DEV) {
      console.error('Unhandled application error', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return <AppErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}
