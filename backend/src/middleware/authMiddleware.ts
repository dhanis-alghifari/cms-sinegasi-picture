import { FastifyRequest, FastifyReply } from 'fastify';
import { CAPABILITY_VALUES, getCapabilities, hasCapability, setRoleCapabilities, type Capability } from './capabilities.js';
import { supabase } from '../services/supabaseClient.js';
import type { JwtPayload, UserRole } from '../shared/auth/auth.types.js';
import {
  clearAuthStateCache,
  getAuthoritativeUser,
  resolveCanonicalStudentId,
  shouldCheckAuthoritativeUser,
} from '../modules/auth/auth.identity.js';

// Compatibility export: existing services invalidate the same identity cache.
export { clearAuthStateCache };

// Compatibility exports keep existing feature imports stable while the
// canonical contracts live in the shared auth seam.
export type { JwtPayload, UserRole } from '../shared/auth/auth.types.js';

function isFirstLoginAllowedPath(requestUrl: string): boolean {
  const pathname = requestUrl.split('?')[0];
  return pathname === '/api/auth/change-password'
    || pathname === '/api/auth/me'
    || pathname === '/api/auth/logout';
}

// Avoid an extra policy-table round trip on every authenticated request while
// still picking up teacher changes quickly across long-lived Fastify workers.
const capabilityCacheExpiry = new Map<UserRole, number>();
const CAPABILITY_CACHE_TTL_MS = 5_000;

async function refreshPersistedCapabilities(role: UserRole): Promise<void> {
  if (!supabase) return;
  const now = Date.now();
  if ((capabilityCacheExpiry.get(role) ?? 0) > now) return;
  const result = await supabase
    .from('access_role_permissions')
    .select('permission_key')
    .eq('role_key', role);
  if (result.error || !result.data) {
    // A short negative cache prevents a database outage from becoming a
    // database-amplification loop. The in-process baseline remains active.
    capabilityCacheExpiry.set(role, now + 1_000);
    return;
  }
  const capabilities = (result.data as Array<{ permission_key: string }>)
    .map((row) => row.permission_key)
    .filter((value): value is Capability => CAPABILITY_VALUES.includes(value as Capability));
  // Keep the final teacher guard available even if a partial rollout has an
  // incomplete seed; other roles may intentionally have an empty policy.
  if (role === 'teacher' && !capabilities.includes('access_control.manage')) {
    capabilityCacheExpiry.set(role, now + CAPABILITY_CACHE_TTL_MS);
    return;
  }
  setRoleCapabilities(role, capabilities);
  capabilityCacheExpiry.set(role, now + CAPABILITY_CACHE_TTL_MS);
}

// Role hierarchy: higher index = higher permission
const ROLE_HIERARCHY: UserRole[] = [
  'member',
  'contest_team',
  'equipment_team',
  'secretary',
  'treasurer',
  'vice_leader',
  'leader',
  'teacher'
];

/**
 * Memeriksa apakah role pengguna memenuhi minimum role yang diperlukan
 */
export function hasMinRole(userRole: UserRole, minRole: UserRole): boolean {
  const userLevel = ROLE_HIERARCHY.indexOf(userRole);
  const minLevel = ROLE_HIERARCHY.indexOf(minRole);
  // Specialized roles intentionally omitted from the rank ladder must never
  // inherit a minimum-role permission through the `-1 >= -1` comparison.
  return userLevel >= 0 && minLevel >= 0 && userLevel >= minLevel;
}

/**
 * Middleware autentikasi JWT — digunakan di tiap protected route
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  // Always skip OPTIONS preflight requests
  if (request.method === 'OPTIONS') return;

  try {
    await request.jwtVerify();

    const tokenUser = request.user as JwtPayload;
    if (shouldCheckAuthoritativeUser(tokenUser.userId)) {
      const authoritative = await getAuthoritativeUser(tokenUser.userId);
      if (!authoritative || !authoritative.isActive) {
        return reply.status(401).send({
          success: false,
          error: 'Unauthorized',
          message: 'Akun tidak aktif atau tidak ditemukan. Silakan login kembali.',
        });
      }

      if (authoritative.authVersion !== null && tokenUser.authVersion !== authoritative.authVersion) {
        return reply.status(401).send({
          success: false,
          error: 'SESSION_REVOKED',
          message: 'Sesi keamanan berubah. Silakan login kembali.',
        });
      }

      request.user = {
        ...tokenUser,
        username: authoritative.username,
        nama: authoritative.nama,
        role: authoritative.role,
        isFirstLogin: authoritative.isFirstLogin,
        isActive: authoritative.isActive,
        ...(authoritative.authVersion === null ? {} : { authVersion: authoritative.authVersion }),
        capabilities: getCapabilities(authoritative.role),
      } satisfies JwtPayload;
    }

    const currentUser = request.user as JwtPayload;
    if (currentUser) await refreshPersistedCapabilities(currentUser.role);
    if (currentUser) {
      // Never trust capability claims from an old token after a policy change.
      currentUser.capabilities = getCapabilities(currentUser.role);
    }
    if (currentUser?.isFirstLogin && !isFirstLoginAllowedPath(request.url)) {
      return reply.status(403).send({
        success: false,
        error: 'FORCE_PASSWORD_CHANGE',
        message: 'Anda wajib mengganti password default sebelum dapat menggunakan aplikasi.',
      });
    }
  } catch (err) {
    request.log.error({ err }, 'Authentication middleware failed');
    return reply.status(401).send({
      success: false,
      error: 'Unauthorized',
      message: 'Token JWT tidak valid atau sudah kadaluarsa. Silakan login kembali.'
    });
  }
}

/**
 * Guard RBAC: Memastikan pengguna memiliki role minimal yang dibutuhkan
 */
export function requireRole(minRole: UserRole) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.method === 'OPTIONS') return;

    const user = request.user as JwtPayload;

    if (!user) {
      return reply.status(401).send({
        success: false,
        error: 'Unauthorized',
        message: 'Pengguna belum terautentikasi.'
      });
    }

    if (!hasMinRole(user.role, minRole)) {
      return reply.status(403).send({
        success: false,
        error: 'Forbidden',
        message: `Akses ditolak. Fitur ini memerlukan hak akses minimal "${minRole}". Peran Anda saat ini: "${user.role}".`
      });
    }
  };
}

/** Guard untuk endpoint yang hanya boleh diakses role tertentu secara eksplisit. */
export function requireAnyRole(...allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.method === 'OPTIONS') return;

    const user = request.user as JwtPayload;
    if (!user) {
      return reply.status(401).send({
        success: false,
        error: 'Unauthorized',
        message: 'Pengguna belum terautentikasi.',
      });
    }

    if (!allowedRoles.includes(user.role)) {
      return reply.status(403).send({
        success: false,
        error: 'Forbidden',
        message: 'Akses ditolak untuk peran pengguna saat ini.',
      });
    }
  };
}

/**
 * Guard Otorisasi Data Siswa:
 * - Pengguna dengan role teacher/leader/vice_leader bisa melihat data siswa manapun.
 * - Pengguna lain (member, dll.) hanya bisa melihat data dirinya sendiri (student_id harus cocok).
 */
export async function authorizeStudentDataAccess(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as JwtPayload | undefined;
  if (!user) {
    return reply.status(401).send({
      success: false,
      error: 'Unauthorized',
      message: 'Pengguna belum terautentikasi.',
    });
  }
  const params = request.params as { id?: string };
  const targetStudentId = params.id;

  // Only explicitly privileged roles can inspect another student's record.
  // A numeric hierarchy is intentionally not used for data ownership checks.
  if (hasCapability(user.role, 'students.read')) {
    return; // authorized
  }

  // Siswa biasa: hanya boleh akses data diri sendiri. Routes historically
  // accepted either students.id (UUID) or NIS, so normalize NIS before the
  // ownership comparison instead of comparing unlike identifiers.
  const canonicalTargetStudentId = await resolveCanonicalStudentId(targetStudentId);
  if (user.studentId && user.studentId === canonicalTargetStudentId) {
    return; // authorized
  }

  return reply.status(403).send({
    success: false,
    error: 'Forbidden',
    message: 'Anda hanya dapat mengakses data diri sendiri.'
  });
}

export { hasCapability } from './capabilities.js';

export function requireCapabilityGuard(capability: Capability) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.method === 'OPTIONS') return;
    const user = request.user as JwtPayload | undefined;
    if (!user) {
      return reply.status(401).send({ success: false, error: 'Unauthorized', message: 'Pengguna belum terautentikasi.' });
    }
    if (!hasCapability(user.role, capability)) {
      return reply.status(403).send({ success: false, error: 'Forbidden', message: 'Akses ditolak untuk kemampuan akun saat ini.' });
    }
  };
}

/**
 * Guard First-Login Check:
 * Menolak akses ke semua endpoint kecuali /api/auth/change-password jika is_first_login = true
 */
export async function enforceFirstLoginPasswordChange(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as JwtPayload;

  if (user?.isFirstLogin && !isFirstLoginAllowedPath(request.url)) {
    return reply.status(403).send({
      success: false,
      error: 'FORCE_PASSWORD_CHANGE',
      message: 'Anda wajib mengganti password default sebelum dapat menggunakan aplikasi.'
    });
  }
}
