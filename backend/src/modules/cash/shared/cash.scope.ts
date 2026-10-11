import type { JwtPayload } from '../../../shared/auth/auth.types.js';
import { hasCapability } from '../../../middleware/capabilities.js';
import { resolveDatabaseStudentId } from '../../auth/auth.identity.js';

export type CashScope = 'own' | 'manage';

export type CashScopeResolution = {
  scope: CashScope;
  studentId: string | null;
  errorCode?: 'STUDENT_SCOPE_UNAVAILABLE' | 'CASH_SCOPE_FORBIDDEN';
};

/**
 * Centralizes the cash read seam. A role without global read can never widen
 * its scope through a query parameter; roles with global read may explicitly
 * switch to their own student ledger.
 */
export async function resolveCashScope(
  user: JwtPayload,
  requestedScope: unknown,
  fallbackStudentId?: string,
): Promise<CashScopeResolution> {
  const canReadOwn = hasCapability(user.role, 'cash.read.own');
  const canReadGlobal = hasCapability(user.role, 'cash.read');
  const wantsOwn = requestedScope === 'own' || (!canReadGlobal && requestedScope !== 'manage');

  if (wantsOwn) {
    if (!canReadOwn) return { scope: 'own', studentId: null, errorCode: 'CASH_SCOPE_FORBIDDEN' };
    const studentId = (await resolveDatabaseStudentId(user)) || fallbackStudentId || null;
    return studentId
      ? { scope: 'own', studentId }
      : { scope: 'own', studentId: null, errorCode: 'STUDENT_SCOPE_UNAVAILABLE' };
  }

  if (!canReadGlobal) return { scope: 'own', studentId: null, errorCode: 'CASH_SCOPE_FORBIDDEN' };
  return { scope: 'manage', studentId: null };
}

export function scopeErrorMessage(errorCode: CashScopeResolution['errorCode']): string {
  return errorCode === 'CASH_SCOPE_FORBIDDEN'
    ? 'Akun ini tidak memiliki akses ke ruang lingkup kas yang diminta.'
    : 'Akun belum terhubung ke data siswa aktif.';
}
