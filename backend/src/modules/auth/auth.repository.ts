import type { SupabaseClient } from '@supabase/supabase-js';
import type { DatabaseError } from '../../shared/database/database.types.js';
import { DATABASE_USERNAME_ALIASES } from './auth.identity.js';

export type AuthDatabaseUser = {
  id: string;
  username: string;
  password_hash: string;
  nama: string;
  role: string;
  is_first_login: boolean;
  is_active: boolean;
  auth_version?: number | null;
};

export type LinkedStudent = {
  id: string;
  is_active: boolean;
};

export interface AuthRepository {
  isConfigured(): boolean;
  findUserForLogin(username: string): Promise<{ data: AuthDatabaseUser | null; error: DatabaseError | null }>;
  findUserById(userId: string): Promise<{ data: AuthDatabaseUser | null; error: DatabaseError | null }>;
  findLinkedStudent(userId: string): Promise<{ data: LinkedStudent | null; error: DatabaseError | null }>;
  updatePasswordHash?(userId: string, passwordHash: string): Promise<void>;
  changePasswordAtomic(input: {
    userId: string;
    passwordHash: string;
    updatedBy: string;
    expectedAuthVersion: number;
  }): Promise<{ data: Record<string, unknown> | null; error: DatabaseError | null }>;
}

type SupabaseLike = SupabaseClient | null;

function selectUserQuery(client: SupabaseLike, username: string) {
  return client
    ?.from('users')
    .select('id,username,password_hash,nama,role,is_first_login,is_active,auth_version')
    .eq('username', username)
    .maybeSingle();
}

function selectUserByIdQuery(client: SupabaseLike, userId: string) {
  return client
    ?.from('users')
    .select('id,username,password_hash,nama,role,is_first_login,is_active,auth_version')
    .eq('id', userId)
    .maybeSingle();
}

export function createAuthRepository(client: SupabaseLike): AuthRepository {
  return {
    isConfigured: () => client !== null,

    async findUserForLogin(username) {
      if (!client) return { data: null, error: null };
      const candidates = [...new Set([
        username,
        DATABASE_USERNAME_ALIASES[username],
      ].filter((value): value is string => Boolean(value)))];

      for (const candidate of candidates) {
        let result = await selectUserQuery(client, candidate);
        if (result?.error?.code === '42703') {
          result = await client
            .from('users')
            .select('id,username,password_hash,nama,role,is_first_login,is_active')
            .eq('username', candidate)
            .maybeSingle();
        }
        if (result?.error) return { data: null, error: result.error };
        if (result?.data) return { data: result.data as AuthDatabaseUser, error: null };
      }
      return { data: null, error: null };
    },

    async findUserById(userId) {
      if (!client) return { data: null, error: null };
      let result = await selectUserByIdQuery(client, userId);
      if (result?.error?.code === '42703') {
        result = await client
          .from('users')
          .select('id,username,password_hash,nama,role,is_first_login,is_active')
          .eq('id', userId)
          .maybeSingle();
      }
      return {
        data: result?.data ? result.data as AuthDatabaseUser : null,
        error: result?.error || null,
      };
    },

    async findLinkedStudent(userId) {
      if (!client) return { data: null, error: null };
      const result = await client
        .from('students')
        .select('id,is_active')
        .eq('user_id', userId)
        .maybeSingle();
      return {
        data: result.data ? result.data as LinkedStudent : null,
        error: result.error || null,
      };
    },

    async updatePasswordHash(userId, passwordHash) {
      if (!client) return;
      await client
        .from('users')
        .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
        .eq('id', userId);
    },

    async changePasswordAtomic({ userId, passwordHash, updatedBy, expectedAuthVersion }) {
      if (!client) return { data: null, error: null };
      const result = await client.rpc('change_password_atomic', {
        p_user_id: userId,
        p_password_hash: passwordHash,
        p_updated_by: updatedBy,
        p_change_reason: 'Pengguna mengganti password akun',
        p_expected_auth_version: expectedAuthVersion,
      }).maybeSingle();
      return {
        data: result.data as Record<string, unknown> | null,
        error: result.error || null,
      };
    },
  };
}
