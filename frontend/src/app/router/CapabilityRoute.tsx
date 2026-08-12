import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { hasAnyCapability, type Capability } from '@/shared/auth/capabilities';

export function CapabilityRoute({ capabilities }: { capabilities: readonly Capability[] }) {
  const { user } = useAuthStore();
  const location = useLocation();
  if (!user || !hasAnyCapability(user, capabilities)) {
    return <Navigate to="/dashboard" state={{ from: location, reason: 'forbidden' }} replace />;
  }
  return <Outlet />;
}
