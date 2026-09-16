import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  linkedStudentFor,
  mapMemoryUser,
  mapUserRow,
  parseUserPagination,
  sanitizeUserSearch,
  USER_SELECT,
} from './users.helpers.js';
import type {
  LinkedStudent,
  RepositoryResult,
  UserAccount,
  UserListQuery,
  UserListResult,
  UserMemoryState,
  UsersRepository,
  PasswordResetAuditContext,
  UserUpdateAuditContext,
} from './users.types.js';

type SupabaseLike = SupabaseClient | null;

export function createUsersRepository(client: SupabaseLike, state: UserMemoryState): UsersRepository {
  const findLinkedStudent = async (id: string): Promise<RepositoryResult<LinkedStudent | null>> => {
    if (!client) return { data: linkedStudentFor(state, id) };
    const result = await client.from('students').select('id,user_id,nama,is_active').eq('user_id', id).maybeSingle();
    if (result.error) return { error: result.error };
    return {
      data: result.data
        ? {
            id: String(result.data.id),
            student_id: String(result.data.id),
            nama: result.data.nama == null ? undefined : String(result.data.nama),
            is_active: result.data.is_active !== false,
          }
        : null,
    };
  };

  const attachStudentLinks = async (users: UserAccount[]): Promise<RepositoryResult<UserAccount[]>> => {
    if (!client || users.length === 0) return { data: users };
    const result = await client
      .from('students')
      .select('id,user_id,nama,is_active')
      .in('user_id', users.map((user) => user.id));
    if (result.error) return { error: result.error };
    const links = new Map<string, LinkedStudent>();
    for (const row of result.data || []) {
      if (!row.user_id) continue;
      links.set(String(row.user_id), {
        id: String(row.id),
        student_id: String(row.id),
        nama: row.nama == null ? undefined : String(row.nama),
        is_active: row.is_active !== false,
      });
    }
    return { data: users.map((user) => mapUserRow(user as unknown as Record<string, unknown>, links.get(user.id) || null)) };
  };

  return {
    isConfigured: () => client !== null,

    async list(query): Promise<RepositoryResult<UserListResult>> {
      const { page, pageSize, from, to } = parseUserPagination(query);
      const search = sanitizeUserSearch(query.search).toLowerCase();
      if (!client) {
        let rows = state.users.filter((user) => {
          const matchesSearch = !search || `${user.nama} ${user.username}`.toLowerCase().includes(search);
          const matchesRole = !query.role || query.role === 'all' || user.role === query.role;
          const matchesStatus = query.isActive === undefined || user.is_active === query.isActive;
          return matchesSearch && matchesRole && matchesStatus;
        });
        rows = rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || b.id.localeCompare(a.id));
        const total = rows.length;
        return {
          data: {
            data: rows.slice(from, to + 1).map((user) => {
              const linked = linkedStudentFor(state, user.id);
              return mapUserRow(mapMemoryUser(user) as unknown as Record<string, unknown>, linked);
            }),
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize) || 1,
          },
        };
      }

      let queryBuilder = client.from('users').select(USER_SELECT, { count: 'exact' });
      if (search) queryBuilder = queryBuilder.or(`nama.ilike.%${search}%,username.ilike.%${search}%`);
      if (query.role && query.role !== 'all') queryBuilder = queryBuilder.eq('role', query.role);
      if (query.isActive !== undefined) queryBuilder = queryBuilder.eq('is_active', query.isActive);
      const result = await queryBuilder
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to);
      if (result.error) return { error: result.error };
      const data = (result.data || []).map((row: Record<string, unknown>) => mapUserRow(row));
      const linkedUsers = await attachStudentLinks(data);
      if ('error' in linkedUsers) return { error: linkedUsers.error };
      const total = result.count ?? data.length;
      return { data: { data: linkedUsers.data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 } };
    },

    async findById(id): Promise<RepositoryResult<UserAccount | null>> {
      if (!client) {
        const user = state.users.find((candidate) => candidate.id === id);
        if (!user) return { data: null };
        return { data: mapUserRow(mapMemoryUser(user) as unknown as Record<string, unknown>, linkedStudentFor(state, id)) };
      }
      const result = await client.from('users').select(USER_SELECT).eq('id', id).maybeSingle();
      if (result.error) return { error: result.error };
      if (!result.data) return { data: null };
      const linked = await findLinkedStudent(id);
      if ('error' in linked) return { error: linked.error };
      return { data: mapUserRow(result.data as Record<string, unknown>, linked.data) };
    },

    async findLinkedStudent(id): Promise<RepositoryResult<LinkedStudent | null>> { return findLinkedStudent(id); },

    async create(input): Promise<RepositoryResult<UserAccount>> {
      if (!client) {
        const now = new Date().toISOString();
        const user: UserAccount = {
          id: crypto.randomUUID(),
          username: input.username,
          nama: input.nama,
          role: input.role,
          is_first_login: true,
          is_active: true,
          created_at: now,
          updated_at: now,
          is_linked_student: false,
          student_id: null,
          ...(input.actorId ? { created_by: input.actorId, updated_by: input.actorId } : {}),
        };
        state.users.unshift(user);
        state.passwordHashes.set(user.id, input.passwordHash);
        return { data: mapMemoryUser(user) };
      }
      const result = await client.from('users').insert([{
        username: input.username,
        password_hash: input.passwordHash,
        nama: input.nama,
        role: input.role,
        is_first_login: true,
        is_active: true,
        created_by: input.actorId,
        updated_by: input.actorId,
        updated_at: new Date().toISOString(),
      }]).select(USER_SELECT).single();
      if (result.error) return { error: result.error };
      return { data: mapUserRow(result.data as Record<string, unknown>, null) };
    },

    async update(id, changes, actorId, changeReason, auditContext?: UserUpdateAuditContext): Promise<RepositoryResult<UserAccount | null>> {
      if (!client) {
        const index = state.users.findIndex((user) => user.id === id);
        if (index === -1) return { data: null };
        if (changes.username && state.users.some((user) => user.id !== id && user.username === changes.username)) {
          return { error: { code: '23505', message: 'users_username_key' } };
        }
        const current = state.users[index];
        state.users[index] = { ...current, ...changes, ...(actorId ? { updated_by: actorId } : {}), updated_at: new Date().toISOString() };
        return { data: mapUserRow(mapMemoryUser(state.users[index]) as unknown as Record<string, unknown>, linkedStudentFor(state, id)) };
      }
      const result = await client.rpc('update_user_account_atomic', {
        p_user_id: id,
        p_changes: changes,
        p_updated_by: actorId,
        p_change_reason: changeReason,
        p_request_id: auditContext?.requestId || null,
        p_operation_id: auditContext?.operationId || null,
      }).maybeSingle();
      if (result.error) return { error: result.error };
      if (!result.data) return { data: null };
      const linked = await findLinkedStudent(id);
      if ('error' in linked) return { error: linked.error };
      return { data: mapUserRow(result.data as Record<string, unknown>, linked.data) };
    },

    async remove(id): Promise<RepositoryResult<boolean>> {
      if (!client) {
        const index = state.users.findIndex((user) => user.id === id);
        if (index === -1) return { data: false };
        state.users.splice(index, 1);
        state.passwordHashes.delete(id);
        return { data: true };
      }
      const result = await client.from('users').delete().eq('id', id);
      if (result.error) return { error: result.error };
      return { data: true };
    },

    async resetPassword(id, passwordHash, actorId, changeReason, operationKey, auditContext?: PasswordResetAuditContext): Promise<RepositoryResult<UserAccount | null>> {
      if (!client) {
        const index = state.users.findIndex((user) => user.id === id);
        if (index === -1) return { data: null };
        const operationScope = `${actorId || 'anonymous'}:${id}:${operationKey}`;
        if (state.passwordResetOperations.has(operationScope)) {
          return { error: { code: 'RESET_OPERATION_REPLAY', message: 'RESET_OPERATION_REPLAY' } };
        }
        state.passwordResetOperations.add(operationScope);
        const current = state.users[index];
        state.users[index] = {
          ...current,
          is_first_login: true,
          updated_at: new Date().toISOString(),
          ...(actorId ? { updated_by: actorId } : {}),
        };
        state.passwordHashes.set(id, passwordHash);
        return { data: mapUserRow(mapMemoryUser(state.users[index]) as unknown as Record<string, unknown>, linkedStudentFor(state, id)) };
      }
      const result = await client.rpc('reset_user_password_atomic', {
        p_user_id: id,
        p_password_hash: passwordHash,
        p_updated_by: actorId,
        p_change_reason: changeReason,
        p_operation_key: operationKey,
        p_request_id: auditContext?.requestId || null,
        p_operation_id: auditContext?.operationId || null,
      }).maybeSingle();
      if (result.error) return { error: result.error };
      return { data: result.data ? mapUserRow(result.data as Record<string, unknown>, null) : null };
    },
  };
}
