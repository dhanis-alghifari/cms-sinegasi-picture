import { useEffect } from 'react';
import { useRouteError } from 'react-router-dom';
import { reportClientError } from '@/shared/monitoring/reportClientError';
import { AppErrorFallback } from '../components/AppErrorFallback';

// Keep this eager: recovery must not depend on another lazy chunk succeeding.
export function RouteErrorBoundary() {
  const error = useRouteError();
  useEffect(() => {
    reportClientError({ kind: 'render', code: 'RENDER_ERROR' });
  }, [error]);
  return <AppErrorFallback error={error} />;
}
