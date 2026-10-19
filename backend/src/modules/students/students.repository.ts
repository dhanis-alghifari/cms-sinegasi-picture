import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DatabaseError } from '../../shared/database/database.types.js';
import {
  mapStudentOption,
  mapStudentRow,
  parseStudentOptionsLimit,
  parseStudentPagination,
  sanitizeStudentSearch,
  STUDENT_LIST_SELECT,
  STUDENT_SELECT,
} from './students.helpers.js';
import type {
  StudentAccountOperationResult,
  StudentAccountLinkInput,
  StudentAccountLinkResult,
  StudentExistingProfileLinkInput,
  StudentAccount,
  StudentCreateInput,
  StudentListQuery,
  StudentListResult,
  StudentOption,
  StudentOptionsQuery,
  StudentRecord,
  StudentLookupRecord,
  StudentPurgeResult,
  StudentRepository,
  UnlinkedStudentAccount,
  StudentUpdateInput,
  StudentsMemoryState,
} from './students.types.js';
import { STUDENT_ACCOUNT_ROLE_VALUES } from './students.types.js';

export type { StudentRepository, StudentRecord } from './students.types.js';

type SupabaseLike = SupabaseClient | null;
type RepositoryResult<T> = { data: T; error?: never } | { data?: never; error: DatabaseError };

function isUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
}

function accountResult(value: unknown, fallbackUsername: string): { userId: string; username: string; role: string; isFirstLogin: boolean; operationReplayed: boolean } | null {
  const result = (Array.isArray(value) ? value[0] : value) as Record<string, unknown> | null;
  if (!result?.user_id) return null;
  return {
    userId: String(result.user_id),
    username: String(result.username || fallbackUsername),
    role: String(result.role || 'member'),
    isFirstLogin: result.is_first_login !== false,
    operationReplayed: result.operation_replayed === true,
  };
}

function mapAccountOperation(student: StudentRecord, rawAccount: { userId: string; username: string; role: string; isFirstLogin: boolean; operationReplayed?: boolean }): StudentAccountOperationResult {
  return {
    student,
    account: {
      user_id: rawAccount.userId,
      username: rawAccount.username,
      role: rawAccount.role,
      is_first_login: rawAccount.isFirstLogin,
      ...(rawAccount.operationReplayed === undefined ? {} : { operation_replayed: rawAccount.operationReplayed }),
    },
  };
}

export function createStudentRepository(client: SupabaseLike, state: StudentsMemoryState = { students: [], accounts: [] }): StudentRepository {
  const accountOperations = new Map<string, { fingerprint: string; result: StudentAccountOperationResult }>();
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

    async findPhoto(id): Promise<{ data: { foto_url: string | null } | null; error: DatabaseError | null }> {
      if (!client) {
        const student = state.students.find((item) => item.id === id);
        return { data: student ? { foto_url: student.foto_url ?? null } : null, error: null };
      }
      const result = await client.from('students').select('foto_url').eq('id', id).maybeSingle();
      return {
        data: result.data ? { foto_url: typeof result.data.foto_url === 'string' ? result.data.foto_url : null } : null,
        error: result.error || null,
      };
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
        return { data: { data: rows.slice(from, to + 1).map(({ foto_url: _fotoUrl, ...row }) => ({ ...row })), total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 } };
      }

      let queryBuilder = client.from('students').select(STUDENT_LIST_SELECT, { count: 'exact' });
      if (search) queryBuilder = queryBuilder.or(`nama.ilike.%${search}%,nis.ilike.%${search}%,kelas.ilike.%${search}%`);
      if (query.kelas && query.kelas !== 'all') queryBuilder = queryBuilder.or(`kelas.eq.${query.kelas},kelas.ilike.${query.kelas} %`);
      if (query.peminatan && query.peminatan !== 'all') queryBuilder = queryBuilder.eq('peminatan', query.peminatan);
      if (query.isActive !== undefined) queryBuilder = queryBuilder.eq('is_active', query.isActive);
      const result = await queryBuilder.order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, to);
      if (result.error) return { error: result.error };
      const data = (result.data || []).map((row: Record<string, unknown>) => {
        const { foto_url: _fotoUrl, ...student } = mapStudentRow(row);
        return student;
      });
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

    async listUnlinkedAccounts(query): Promise<RepositoryResult<UnlinkedStudentAccount[]>> {
      const limit = Math.min(20, Math.max(1, Math.floor(query.limit || 20)));
      const search = sanitizeStudentSearch(query.search).toLowerCase();
      if (!client) {
        const linkedUserIds = new Set(state.students.flatMap((student) => student.user_id ? [student.user_id] : []));
        const accounts = state.accounts
          .filter((account) => account.is_active && !linkedUserIds.has(account.id) && account.id !== query.actorId)
          .filter((account) => STUDENT_ACCOUNT_ROLE_VALUES.includes(account.role as typeof STUDENT_ACCOUNT_ROLE_VALUES[number]))
          .filter((account) => !search || `${account.nama} ${account.username}`.toLowerCase().includes(search))
          .sort((left, right) => left.nama.localeCompare(right.nama) || left.id.localeCompare(right.id))
          .slice(0, limit)
          .map(({ id, username, nama, role }) => ({ id, username, nama, role }));
        return { data: accounts };
      }
      const { data, error } = await client.rpc('list_unlinked_student_accounts', {
        p_search: search || null,
        p_limit: limit,
        p_actor_id: query.actorId,
      });
      if (error) return { error };
      const rows = Array.isArray(data) ? data : [];
      return {
        data: rows.map((row: Record<string, unknown>) => ({
          id: String(row.id),
          username: String(row.username),
          nama: String(row.nama),
          role: String(row.role),
        })),
      };
    },

    async createWithAccount(input): Promise<RepositoryResult<StudentAccountOperationResult>> {
      if (!client) {
        const operationMapKey = `${input.actorId ?? 'anonymous'}:${input.operationKey}`;
        const previousOperation = accountOperations.get(operationMapKey);
        if (previousOperation) {
          if (previousOperation.fingerprint !== input.requestFingerprint) {
            return { error: { code: 'STUDENT_OPERATION_KEY_REUSED', message: 'STUDENT_OPERATION_KEY_REUSED' } };
          }
          return { data: { ...previousOperation.result, account: { ...previousOperation.result.account, operation_replayed: true } } };
        }
        if (state.students.some((student) => student.nis.toLowerCase() === input.nis.toLowerCase())) return { error: { code: '23505' } };
        if (state.accounts.some((account) => account.username.trim().toLowerCase() === input.username)) {
          return { error: { code: '23505', message: 'duplicate key value violates unique constraint "uq_users_username_normalized"' } };
        }
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
        state.accounts.push({
          id: userId,
          username: input.username,
          nama: input.nama,
          role: input.role || 'member',
          is_active: true,
          is_first_login: true,
        });
        const operationResult = mapAccountOperation(student, { userId, username: input.username, role: input.role || 'member', isFirstLogin: true, operationReplayed: false });
        accountOperations.set(operationMapKey, { fingerprint: input.requestFingerprint, result: operationResult });
        return { data: operationResult };
      }
      const { data: accountData, error } = await client.rpc('create_student_with_account_v2', {
        p_nis: input.nis, p_nama: input.nama, p_kelas: input.kelas, p_peminatan: input.peminatan || null,
        p_no_telepon: input.no_telepon || null, p_foto_url: input.foto_url || null, p_username: input.username,
        p_password_hash: input.passwordHash, p_created_by: input.actorId, p_role: input.role || 'member',
        p_operation_key: input.operationKey, p_request_fingerprint: input.requestFingerprint,
        p_change_reason: input.changeReason, p_request_id: input.requestId || null,
        p_operation_id: input.operationId || null, p_user_agent: input.userAgent || null,
      });
      if (error) return { error };
      const account = accountResult(accountData, input.username);
      if (!account) return { error: { code: 'EMPTY_RESULT', message: 'Provisioning akun siswa tidak menghasilkan identitas akun.' } };
      const result = await client.from('students').select(STUDENT_SELECT).eq('id', (Array.isArray(accountData) ? accountData[0] : accountData)?.student_id).single();
      if (result.error || !result.data) return { error: result.error || { code: 'EMPTY_RESULT' } };
      return { data: mapAccountOperation(mapStudentRow(result.data as Record<string, unknown>), account) };
    },

    async linkExistingAccount(input: StudentAccountLinkInput): Promise<RepositoryResult<StudentAccountLinkResult>> {
      if (!client) {
        const account = state.accounts.find((candidate) => candidate.id === input.userId);
        if (!account || !account.is_active || account.id === input.actorId
          || !STUDENT_ACCOUNT_ROLE_VALUES.includes(account.role as typeof STUDENT_ACCOUNT_ROLE_VALUES[number])
          || state.students.some((student) => student.user_id === account.id)) {
          return { error: { code: 'STUDENT_ACCOUNT_NOT_ELIGIBLE', message: 'STUDENT_ACCOUNT_NOT_ELIGIBLE' } };
        }
        if (state.students.some((student) => student.nis.toLowerCase() === input.nis.toLowerCase())) return { error: { code: '23505' } };
        const previousAccount = { id: account.id, username: account.username, nama: account.nama, role: account.role };
        const now = new Date().toISOString();
        const student: StudentRecord = {
          id: crypto.randomUUID(), user_id: account.id, nis: input.nis, nama: input.nama, kelas: input.kelas,
          ...(input.peminatan ? { peminatan: input.peminatan } : {}),
          ...(input.no_telepon ? { no_telepon: input.no_telepon } : {}),
          ...(input.foto_url ? { foto_url: input.foto_url } : {}),
          is_active: account.is_active, created_at: now,
        };
        account.nama = input.nama;
        state.students.unshift(student);
        return {
          data: {
            student,
            account: { user_id: account.id, username: account.username, role: account.role, is_first_login: account.is_first_login },
            previousAccount,
          },
        };
      }
      const { data: rawData, error } = await client.rpc('link_existing_student_account_atomic', {
        p_user_id: input.userId,
        p_nis: input.nis,
        p_nama: input.nama,
        p_kelas: input.kelas,
        p_peminatan: input.peminatan || null,
        p_no_telepon: input.no_telepon || null,
        p_foto_url: input.foto_url || null,
        p_actor_id: input.actorId,
        p_change_reason: input.changeReason,
      });
      if (error) return { error };
      const raw = (Array.isArray(rawData) ? rawData[0] : rawData) as Record<string, unknown> | null;
      if (!raw?.student_id || !raw.user_id) return { error: { code: 'EMPTY_RESULT', message: 'Pengaitan akun siswa tidak menghasilkan identitas.' } };
      const studentResult = await client.from('students').select(STUDENT_SELECT).eq('id', String(raw.student_id)).single();
      if (studentResult.error || !studentResult.data) return { error: studentResult.error || { code: 'EMPTY_RESULT' } };
      const account: StudentAccount = {
        user_id: String(raw.user_id),
        username: String(raw.username),
        role: String(raw.role),
        is_first_login: raw.is_first_login === true,
      };
      const previousRaw = raw.previous_account as Record<string, unknown> | undefined;
      return {
        data: {
          student: mapStudentRow(studentResult.data as Record<string, unknown>),
          account,
          previousAccount: {
            id: account.user_id,
            username: String(previousRaw?.username ?? raw.username),
            nama: String(previousRaw?.nama ?? raw.nama),
            role: String(previousRaw?.role ?? raw.role),
          },
        },
      };
    },

    async linkAccountToExistingProfile(input: StudentExistingProfileLinkInput): Promise<RepositoryResult<StudentAccountLinkResult>> {
      if (!client) {
        const account = state.accounts.find((candidate) => candidate.id === input.userId);
        const student = state.students.find((candidate) => candidate.id === input.studentId);
        if (!student) return { error: { code: 'STUDENT_NOT_FOUND', message: 'STUDENT_NOT_FOUND' } };
        if (!account || !account.is_active || !student.is_active || account.id === input.actorId
          || !STUDENT_ACCOUNT_ROLE_VALUES.includes(account.role as typeof STUDENT_ACCOUNT_ROLE_VALUES[number])
          || student.user_id || state.students.some((candidate) => candidate.user_id === account.id)) {
          return { error: { code: 'STUDENT_LINK_TARGET_NOT_ELIGIBLE', message: 'STUDENT_LINK_TARGET_NOT_ELIGIBLE' } };
        }
        const previousAccount = { id: account.id, username: account.username, nama: account.nama, role: account.role };
        student.user_id = account.id;
        account.nama = student.nama;
        return {
          data: {
            student: { ...student },
            account: { user_id: account.id, username: account.username, role: account.role, is_first_login: account.is_first_login },
            previousAccount,
          },
        };
      }
      const { data: rawData, error } = await client.rpc('link_account_to_existing_student_atomic', {
        p_student_id: input.studentId,
        p_user_id: input.userId,
        p_actor_id: input.actorId,
        p_change_reason: input.changeReason,
      });
      if (error) return { error };
      const raw = (Array.isArray(rawData) ? rawData[0] : rawData) as Record<string, unknown> | null;
      if (!raw?.student_id || !raw.user_id) return { error: { code: 'EMPTY_RESULT', message: 'Pengaitan profil siswa tidak menghasilkan identitas.' } };
      const studentResult = await client.from('students').select(STUDENT_SELECT).eq('id', String(raw.student_id)).single();
      if (studentResult.error || !studentResult.data) return { error: studentResult.error || { code: 'EMPTY_RESULT' } };
      const previousRaw = raw.previous_account as Record<string, unknown> | undefined;
      const account: StudentAccount = {
        user_id: String(raw.user_id),
        username: String(raw.username),
        role: String(raw.role),
        is_first_login: raw.is_first_login === true,
      };
      return {
        data: {
          student: mapStudentRow(studentResult.data as Record<string, unknown>),
          account,
          previousAccount: {
            id: account.user_id,
            username: String(previousRaw?.username ?? raw.username),
            nama: String(previousRaw?.nama ?? raw.nama),
            role: String(previousRaw?.role ?? raw.role),
          },
        },
      };
    },

    async provisionAccount(input): Promise<RepositoryResult<StudentAccountOperationResult>> {
      if (!client) return { error: { code: 'DATABASE_REQUIRED' } };
      const { data: accountData, error } = await client.rpc('provision_student_account_v2', {
        p_student_id: input.id, p_username: input.username, p_password_hash: input.passwordHash,
        p_no_telepon: input.phoneNumber, p_created_by: input.actorId,
        p_operation_key: input.operationKey, p_request_fingerprint: input.requestFingerprint,
        p_change_reason: input.changeReason, p_request_id: input.requestId || null,
        p_operation_id: input.operationId || null, p_user_agent: input.userAgent || null,
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
      const { data, error } = await client.rpc('update_student_profile_audited_atomic', {
        p_student_id: input.id,
        p_nama: input.changes.nama,
        p_kelas: input.changes.kelas,
        p_peminatan: input.changes.peminatan || null,
        p_no_telepon: input.changes.no_telepon || null,
        p_foto_url: input.changes.foto_url || null,
        p_updated_by: input.actorId,
        p_change_reason: input.changeReason,
      });
      if (error) return { error };
      return { data: mapStudentRpcResult(data) };
    },

    async purge(input): Promise<RepositoryResult<StudentPurgeResult>> {
      if (!client) {
        const index = state.students.findIndex((student) => student.id === input.id);
        if (index === -1) return { error: { code: 'P0002', message: 'Siswa tidak ditemukan.' } };
        const student = state.students[index];
        if (student.is_active) return { error: { code: 'STUDENT_PURGE_ACTIVE', message: 'Siswa aktif tidak dapat dihapus.' } };
        state.students.splice(index, 1);
        let deletedUser = false;
        if (student.user_id) {
          const accountIndex = state.accounts.findIndex((account) => account.id === student.user_id);
          if (accountIndex >= 0) {
            state.accounts.splice(accountIndex, 1);
            deletedUser = true;
          }
        }
        return {
          data: {
            student_id: student.id,
            user_id: student.user_id || null,
            deleted_user: deletedUser,
            account_deactivated: false,
            deleted_attendance: 0,
            deleted_debt_records: 0,
            deleted_billing_transactions: 0,
            deleted_equipment_charges: 0,
            preserved_cash_transactions: 0,
          },
        };
      }
      const { data, error } = await client.rpc('purge_student_history_atomic', {
        p_student_id: input.id,
        p_actor_id: input.actorId,
        p_change_reason: input.changeReason,
      });
      if (error) return { error };
      const raw = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
      if (!raw?.student_id) return { error: { code: 'EMPTY_RESULT', message: 'Penghapusan siswa tidak menghasilkan ringkasan.' } };
      return {
        data: {
          student_id: String(raw.student_id),
          user_id: raw.user_id ? String(raw.user_id) : null,
          deleted_user: raw.deleted_user === true,
          account_deactivated: raw.account_deactivated === true,
          deleted_attendance: Number(raw.deleted_attendance || 0),
          deleted_debt_records: Number(raw.deleted_debt_records || 0),
          deleted_billing_transactions: Number(raw.deleted_billing_transactions || 0),
          deleted_equipment_charges: Number(raw.deleted_equipment_charges || 0),
          preserved_cash_transactions: Number(raw.preserved_cash_transactions || 0),
        },
      };
    },
  };
}

function mapStudentRpcResult(data: unknown): StudentRecord | null {
  if (!data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return row && typeof row === 'object' ? mapStudentRow(row as Record<string, unknown>) : null;
}
