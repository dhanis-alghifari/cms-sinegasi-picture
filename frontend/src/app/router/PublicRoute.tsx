// src/app/router/PublicRoute.tsx
// Redirects already-authenticated users away from login page

import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { PageLoader } from '@/shared/ui/LoadingSpinner';

export function PublicRoute() {
  const { isAuthenticated, authHydrated, sessionChecked } = useAuthStore();

  if (!authHydrated || (isAuthenticated && !sessionChecked)) {
    return <PageLoader />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
