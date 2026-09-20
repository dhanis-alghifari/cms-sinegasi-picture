import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { hasCapability } from '@/shared/auth/capabilities';

/** Keeps audit-only columns and controls aligned with the server capability. */
export function useCanViewAuditHistory(): boolean {
  const user = useAuthStore((state) => state.user);
  return hasCapability(user, 'audit.read');
}
