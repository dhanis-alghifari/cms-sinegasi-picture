import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DatabaseError } from '../../shared/database/database.types.js';
import {
  mapStudentOption,
  mapStudentRow,
  parseStudentOptionsLimit,
  parseStudentPagination,
  sanitizeStudentSearch,
  STUDENT_SELECT,
} from './students.helpers.js';
import type {
  StudentAccountOperationResult,
  StudentCreateInput,
  StudentListQuery,
  StudentListResult,
  StudentOption,
  StudentOptionsQuery,
  StudentRecord,
  StudentLookupRecord,
  StudentRepository,
  StudentUpdateInput,
  StudentsMemoryState,
} from './students.types.js';

export type { StudentRepository, StudentRecord } from './students.types.js';

type SupabaseLike = SupabaseClient | null;
type RepositoryResult<T> = { data: T; error?: never } | { data?: never; error: DatabaseError };

function isUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
}

function accountResult(value: unknown, fallbackUsername: string): { userId: string; username: string; role: string; isFirstLogin: boolean } | null {
  const result = (Array.isArray(value) ? value[0] : value) as Record<string, unknown> | null;
  if (!result?.user_id) return null;
  return {
    userId: String(result.user_id),
    username: String(result.username || fallbackUsername),
    role: String(result.role || 'member'),
    isFirstLogin: result.is_first_login !== false,
  };
}

function mapAccountOperation(student: StudentRecord, rawAccount: { userId: string; username: string; role: string; isFirstLogin: boolean }): StudentAccountOperationResult {
  return {
    student,
    account: {
      user_id: rawAccount.userId,
      username: rawAccount.username,
      role: rawAccount.role,
      is_first_login: rawAccount.isFirstLogin,
    },
  };
}

export function createStudentRepository(client: SupabaseLike, state: StudentsMemoryState = { students: [] }): StudentRepository {
  return {
    isConfigured: () => client !== null,

    async findByIdentifier(identifier): Promise<{ data: StudentLookupRecord | null; error: DatabaseError | null }> {
      if (!client) return { data: state.students.find((student) => student.id === identifier || student.nis === identifier) || null, error: null };
      const query = client.from('students').select(STUDENT_SELECT);
      const result = isUuid(identifier)
        ? await query.eq('id', identifier).maybeSingle()
        : await query.eq('nis', identifier).maybeSingle();
      return { data: result.data ? mapStudentRow(result.data as Record<string, unknown>) : null, error: result.error || null };
    },

    async list(query: StudentListQuery): Promise<RepositoryResult<StudentListResult>> {
      const { page, pageSize, from, to } = parseStudentPagination(query.page, query.pageSize);
      const search = sanitizeStudentSearch(query.search).toLowerCase();
      if (!client) {
        let rows = state.students.filter((student) => {
          const haystack = `${student.nama} ${student.nis} ${student.kelas}`.toLowerCase();
          const matchesSearch = !search || haystack.includes(search);
          const classFilter = query.kelas && query.kelas !== 'all' ? query.kelas.toLowerCase() : '';
          const matchesClass = !classFilter || student.kelas.toLowerCase() === classFilter || student.kelas.toLowerCase().startsWith(`${classFilter} `);
          const matchesPeminatan = !query.peminatan || query.peminatan === 'all' || student.peminatan === query.peminatan;
          const matchesStatus = query.isActive === undefined || student.is_active === query.isActive;
          return matchesSearch && matchesClass && matchesPeminatan && matchesStatus;
        });
        rows = rows.sort((left, right) => right.created_at.localeCompare(left.created_at) || right.id.localeCompare(left.id));
        const total = rows.length;
        return { data: { data: rows.slice(from, to + 1).map((row) => ({ ...row })), total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 } };
      }

      let queryBuilder = client.from('students').select(STUDENT_SELECT, { count: 'exact' });
      if (search) queryBuilder = queryBuilder.or(`nama.ilike.%${search}%,nis.ilike.%${search}%,kelas.ilike.%${search}%`);
      if (query.kelas && query.kelas !== 'all') queryBuilder = queryBuilder.or(`kelas.eq.${query.kelas},kelas.ilike.${query.kelas} %`);
      if (query.peminatan && query.peminatan !== 'all') queryBuilder = queryBuilder.eq('peminatan', query.peminatan);
      if (query.isActive !== undefined) queryBuilder = queryBuilder.eq('is_active', query.isActive);
      const result = await queryBuilder.order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, to);
      if (result.error) return { error: result.error };
      const data = (result.data || []).map((row: Record<string, unknown>) => mapStudentRow(row));
      const total = result.count ?? data.length;
      return { data: { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 } };
    },

    async listOptions(query: StudentOptionsQuery): Promise<RepositoryResult<{ data: StudentOption[]; total: number }>> {
      const limit = parseStudentOptionsLimit(query.limit);
      const search = sanitizeStudentSearch(query.search).toLowerCase();
      const isActive = query.isActive ?? true;
      if (!client) {
        const rows = state.students
          .filter((student) => student.is_active === isActive)
          .filter((student) => !search || `${student.nama} ${student.nis} ${student.kelas}`.toLowerCase().includes(search))
          .sort((left, right) => left.nama.localeCompare(right.nama) || left.id.localeCompare(right.id));
        return { data: { data: rows.slice(0, limit).map(mapStudentOption), total: rows.length } };
      }
      let queryBuilder = client.from('students').select('id,nis,nama,kelas,is_active', { count: 'exact' }).eq('is_active', isActive);
      if (search) queryBuilder = queryBuilder.or(`nama.ilike.%${search}%,nis.ilike.%${search}%,kelas.ilike.%${search}%`);
      const result = await queryBuilder.order('nama', { ascending: true }).order('id', { ascending: true }).limit(limit);
      if (result.error) return { error: result.error };
      return { data: { data: (result.data || []).map((row: Record<string, unknown>) => mapStudentOption(row)), total: result.count ?? result.data?.length ?? 0 } };
    },

    async createWithAccount(input): Promise<RepositoryResult<StudentAccountOperationResult>> {
      if (!client) {
        if (state.students.some((student) => student.nis.toLowerCase() === input.nis.toLowerCase())) return { error: { code: '23505' } };
        const now = new Date().toISOString();
        const userId = crypto.randomUUID();
        const student: StudentRecord = {
          id: crypto.randomUUID(), user_id: userId, nis: input.nis, nama: input.nama, kelas: input.kelas,
          ...(input.peminatan ? { peminatan: input.peminatan } : {}),
          ...(input.no_telepon ? { no_telepon: input.no_telepon } : {}),
          ...(input.foto_url ? { foto_url: input.foto_url } : {}),
          is_active: true, created_at: now,
          ...(input.actorId ? { created_by: input.actorId, updated_by: input.actorId, updated_at: now } : {}),
        };
        state.students.unshift(student);
        return { data: mapAccountOperation(student, { userId, username: input.username, role: 'member', isFirstLogin: true }) };
      }
      const { data: accountData, error } = await client.rpc('create_student_with_account_atomic', {
        p_nis: input.nis, p_nama: input.nama, p_kelas: input.kelas, p_peminatan: input.peminatan || null,
        p_no_telepon: input.no_telepon || null, p_foto_url: input.foto_url || null, p_username: input.username,
        p_password_hash: input.passwordHash, p_created_by: input.actorId,
      });
      if (error) return { error };
      const account = accountResult(accountData, input.username);
      if (!account) return { error: { code: 'EMPTY_RESULT', message: 'Provisioning akun siswa tidak menghasilkan identitas akun.' } };
      const result = await client.from('students').select(STUDENT_SELECT).eq('id', (Array.isArray(accountData) ? accountData[0] : accountData)?.student_id).single();
      if (result.error || !result.data) return { error: result.error || { code: 'EMPTY_RESULT' } };
      return { data: mapAccountOperation(mapStudentRow(result.data as Record<string, unknown>), account) };
    },

    async provisionAccount(input): Promise<RepositoryResult<StudentAccountOperationResult>> {
      if (!client) return { error: { code: 'DATABASE_REQUIRED' } };
      const current = await client.from('students').select(STUDENT_SELECT).eq('id', input.id).maybeSingle();
      if (current.error) return { error: current.error };
      if (!current.data) return { error: { code: 'P0002', message: 'Siswa tidak ditemukan.' } };
      const currentStudent = mapStudentRow(current.data as Record<string, unknown>);
      if (currentStudent.user_id) return { error: { code: '23505', message: 'Siswa ini sudah memiliki akun.' } };
      const { data: accountData, error } = await client.rpc('provision_student_account_atomic', {
        p_student_id: input.id, p_username: input.username, p_password_hash: input.passwordHash, p_created_by: input.actorId,
      });
      if (error) return { error };
      const account = accountResult(accountData, input.username);
      if (!account) return { error: { code: 'EMPTY_RESULT', message: 'Provisioning akun siswa tidak menghasilkan identitas akun.' } };
      const refreshed = await client.from('students').select(STUDENT_SELECT).eq('id', input.id).single();
      if (refreshed.error || !refreshed.data) return { error: refreshed.error || { code: 'EMPTY_RESULT' } };
      return { data: mapAccountOperation(mapStudentRow(refreshed.data as Record<string, unknown>), account) };
    },

    async updateStatus(input): Promise<RepositoryResult<StudentRecord | null>> {
      if (!client) {
        const index = state.students.findIndex((student) => student.id === input.id);
        if (index === -1) return { data: null };
        state.students[index] = { ...state.students[index], is_active: input.isActive, ...(input.actorId ? { updated_by: input.actorId } : {}), updated_at: new Date().toISOString() };
        return { data: { ...state.students[index] } };
      }
      const { error } = await client.rpc('set_student_account_status_atomic', { p_student_id: input.id, p_is_active: input.isActive, p_updated_by: input.actorId });
      if (error) return { error };
      const refreshed = await client.from('students').select(STUDENT_SELECT).eq('id', input.id).maybeSingle();
      if (refreshed.error) return { error: refreshed.error };
      return { data: refreshed.data ? mapStudentRow(refreshed.data as Record<string, unknown>) : null };
    },

    async updateProfile(input): Promise<RepositoryResult<StudentRecord | null>> {
      if (!client) {
        const index = state.students.findIndex((student) => student.id === input.id);
        if (index === -1) return { data: null };
        const current = state.students[index];
        state.students[index] = {
          ...current,
          ...input.changes,
          updated_at: new Date().toISOString(),
          ...(input.actorId ? { updated_by: input.actorId } : {}),
        };
        return { data: { ...state.students[index] } };
      }
      const { data, error } = await client.rpc('update_student_profile_atomic', {
        p_student_id: input.id,
        p_nama: input.changes.nama,
        p_kelas: input.changes.kelas,
        p_peminatan: input.changes.peminatan || null,
        p_no_telepon: input.changes.no_telepon || null,
        p_foto_url: input.changes.foto_url || null,
        p_updated_by: input.actorId,
      });
      if (error) return { error };
      return { data: mapStudentRpcResult(data) };
    },
  };
}

function mapStudentRpcResult(data: unknown): StudentRecord | null {
  if (!data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return row && typeof row === 'object' ? mapStudentRow(row as Record<string, unknown>) : null;
}
