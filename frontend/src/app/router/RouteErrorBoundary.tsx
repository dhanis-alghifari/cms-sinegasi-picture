import { useRouteError } from 'react-router-dom';
import { AppErrorFallback } from '../components/AppErrorFallback';

// Keep this eager: recovery must not depend on another lazy chunk succeeding.
export function RouteErrorBoundary() {
  const error = useRouteError();
  return <AppErrorFallback error={error} />;
}
