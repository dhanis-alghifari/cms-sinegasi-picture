// src/app/router/ProtectedRoute.tsx
// Guards authenticated routes — redirects to /login if not authenticated
// PRD: First-login enforcement — redirects to /ganti-password if is_first_login=true

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { PageLoader } from '@/components/common/LoadingSpinner';

export function ProtectedRoute() {
  const { isAuthenticated, user, authHydrated, sessionChecked } = useAuthStore();
  const location = useLocation();

  if (!authHydrated || (isAuthenticated && !sessionChecked)) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // PRD: First-login must be resolved before accessing any other route
  if (user?.is_first_login && location.pathname !== '/ganti-password') {
    return <Navigate to="/ganti-password" replace />;
  }

  return <Outlet />;
}
