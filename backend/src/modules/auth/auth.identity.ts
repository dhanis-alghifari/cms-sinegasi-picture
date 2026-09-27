import { supabase } from '../../services/supabaseClient.js';
import type { JwtPayload, UserRole } from '../../shared/auth/auth.types.js';

export const DATABASE_USERNAME_ALIASES: Readonly<Record<string, string>> = {
  guru_pembina: 'admin',
  ketua_budi: 'ketua',
  member_siswa: 'member_dewi',
};

function isUuid(value: string | undefined): value is string {
  return Boolean(value && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value));
}

export function shouldCheckAuthoritativeUser(userId: string | undefined): boolean {
  return Boolean(supabase && isUuid(userId));
}

export type AuthoritativeUser = {
  id: string;
  username: string;
  nama: string;
  role: UserRole;
  isFirstLogin: boolean;
  isActive: boolean;
  authVersion: number | null;
};

const AUTH_STATE_CACHE_TTL_MS = 5_000;
const authStateCache = new Map<string, { expiresAt: number; user: AuthoritativeUser }>();

function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && [
    'teacher', 'leader', 'vice_leader', 'treasurer', 'secretary',
    'equipment_team', 'contest_team', 'social_media_team', 'member',
  ].includes(value);
}

/** Loads the current account state used to revoke inactive or stale sessions. */
export async function getAuthoritativeUser(userId: string): Promise<AuthoritativeUser | null> {
  if (!supabase || !isUuid(userId)) return null;

  const cached = authStateCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.user;

  let result = await supabase
    .from('users')
    .select('id,username,nama,role,is_first_login,is_active,auth_version')
    .eq('id', userId)
    .maybeSingle();

  // Keep rollout safe when the additive migration has not been run yet.
  if (result.error?.code === '42703') {
    result = await supabase
      .from('users')
      .select('id,username,nama,role,is_first_login,is_active')
      .eq('id', userId)
      .maybeSingle();
  }

  if (result.error || !result.data || !isUserRole(result.data.role)) return null;
  const authoritative: AuthoritativeUser = {
    id: result.data.id,
    username: result.data.username,
    nama: result.data.nama,
    role: result.data.role,
    isFirstLogin: result.data.is_first_login === true,
    isActive: result.data.is_active !== false,
    authVersion: result.data.auth_version == null ? null : Number(result.data.auth_version),
  };
  authStateCache.set(userId, { expiresAt: Date.now() + AUTH_STATE_CACHE_TTL_MS, user: authoritative });
  return authoritative;
}

export function clearAuthStateCache(userId?: string): void {
  if (userId) authStateCache.delete(userId);
  else authStateCache.clear();
}

/** Resolves a legacy NIS path parameter to the canonical student UUID. */
export async function resolveCanonicalStudentId(identifier: string | undefined): Promise<string | undefined> {
  if (!identifier || isUuid(identifier) || !supabase) return identifier;
  const { data } = await supabase.from('students').select('id').eq('nis', identifier).maybeSingle();
  return data?.id || identifier;
}

/**
 * Resolves legacy demo usernames to the canonical database user id. Keeping
 * this adapter behind a small interface prevents every route from knowing
 * how old usernames are mapped.
 */
export async function resolveDatabaseUserId(
  user: Pick<JwtPayload, 'userId' | 'username'>,
): Promise<string | null> {
  if (isUuid(user.userId)) return user.userId;
  if (!supabase) return null;

  const usernames = [user.username, DATABASE_USERNAME_ALIASES[user.username]]
    .filter((username): username is string => Boolean(username));
  for (const username of usernames) {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    if (!error && data?.id && isUuid(data.id)) return data.id;
  }
  return null;
}

export async function resolveDatabaseStudentId(
  user: Pick<JwtPayload, 'userId' | 'username' | 'studentId'>,
  databaseUserId?: string | null,
): Promise<string | null> {
  if (!supabase) return user.studentId || null;
  const resolvedUserId = databaseUserId ?? await resolveDatabaseUserId(user);
  if (!resolvedUserId) return isUuid(user.studentId) ? user.studentId : null;

  const { data, error } = await supabase
    .from('students')
    .select('id')
    .eq('user_id', resolvedUserId)
    .eq('is_active', true)
    .maybeSingle();
  if (!error && data?.id && isUuid(data.id)) return data.id;
  return isUuid(user.studentId) ? user.studentId : null;
}
