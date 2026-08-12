// First-login-only route. It must remain protected, never public.

import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';

export function FirstLoginRoute() {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!user?.is_first_login) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
