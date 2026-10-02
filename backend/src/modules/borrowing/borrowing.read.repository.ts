import type { SupabaseClient } from '@supabase/supabase-js';
import { asDatabaseError } from '../../shared/database/database.types.js';
import type { DatabaseError, DatabaseRow } from '../../shared/database/database.types.js';
import type { BorrowingReadPage, BorrowingReadQuery, BorrowingReadRecord, BorrowingReadScope, BorrowingSummary } from './borrowing.read.types.js';

export interface BorrowingReadRepository {
  isConfigured(): boolean;
  list(query: BorrowingReadQuery, scope: BorrowingReadScope): Promise<{ data: BorrowingReadPage | null; error: DatabaseError | null }>;
  summary(scope: BorrowingReadScope): Promise<{ data: BorrowingSummary | null; error: DatabaseError | null }>;
}

type SupabaseLike = SupabaseClient | null;
type BorrowingDbRow = DatabaseRow;
const VALUATION_LOOKUP_LIMIT = 5_000;

export const BORROWING_SELECT = 'id,student_id,tanggal_pinjam,borrowed_at,rencana_kembali,due_at,returned_at,keperluan,status,catatan_persetujuan,catatan_pengembalian,total_denda,approved_by,processed_return_by,created_by,updated_by,created_at,updated_at,return_reported_at,return_notes,return_verified_at,return_verified_by,students(id,nis,nama,kelas),borrowing_items(id,borrowing_id,equipment_id,status,kondisi_awal,kondisi_kembali,denda,tanggal_diserahkan,tanggal_dikembalikan,catatan,equipment(id,kode_alat,kode_qr,nama_alat,kategori,kondisi,physical_condition,status,availability_status))';
const STATUS_MAP: Record<string, BorrowingReadRecord['status']> = {
  pending: 'menunggu_persetujuan', approved: 'disetujui', rejected: 'ditolak', borrowed: 'dipinjam', pending_verification: 'menunggu_verifikasi', returned: 'dikembalikan', partial: 'dipinjam',
};

function asRow(value: unknown): DatabaseRow {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as DatabaseRow : {};
}

function relationObject(value: unknown): DatabaseRow {
  return Array.isArray(value) ? asRow(value[0]) : asRow(value);
}

function mapStatus(value: unknown, dueAt: unknown): BorrowingReadRecord['status'] {
  const status = String(value || 'pending');
  if (status === 'borrowed' && dueAt) {
    const dueTime = new Date(String(dueAt)).getTime();
    if (Number.isFinite(dueTime) && dueTime < Date.now()) return 'terlambat';
  }
  return STATUS_MAP[status] || 'menunggu_persetujuan';
}

function text(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function positiveNumber(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function withReplacementValues(record: BorrowingReadRecord, replacementValues?: ReadonlyMap<string, number>): BorrowingReadRecord {
  if (!replacementValues || replacementValues.size === 0) return record;
  return {
    ...record,
    items: record.items.map((item) => {
      if (item.replacement_value !== undefined) return item;
      const replacementValue = replacementValues.get(item.equipment_id);
      return replacementValue === undefined ? item : { ...item, replacement_value: replacementValue };
    }),
  };
}

function isMissingValuationSchemaError(error: DatabaseError | null): boolean {
  return Boolean(error && ['42P01', '42703', 'PGRST205'].includes(error.code || ''));
}

function equipmentIdsFromRows(rows: readonly DatabaseRow[]): string[] {
  const ids = new Set<string>();
  for (const row of rows) {
    const rawItems = Array.isArray(row.borrowing_items) ? row.borrowing_items : [];
    for (const itemValue of rawItems) {
      const item = asRow(itemValue);
      const equipment = relationObject(item.equipment);
      const id = text(item.equipment_id ?? equipment.id);
      if (id) ids.add(id);
    }
  }
  return [...ids];
}

export async function loadLatestReplacementValues(client: SupabaseClient, rows: readonly DatabaseRow[]): Promise<{ data: Map<string, number>; error: DatabaseError | null }> {
  const equipmentIds = equipmentIdsFromRows(rows);
  if (equipmentIds.length === 0) return { data: new Map(), error: null };

  const result = await client
    .from('equipment_valuations')
    .select('equipment_id,replacement_value,effective_at,created_at,id')
    .in('equipment_id', equipmentIds)
    .order('effective_at', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(Math.min(VALUATION_LOOKUP_LIMIT, Math.max(equipmentIds.length, equipmentIds.length * 10)));
  const resultError = asDatabaseError(result.error);
  if (resultError && !isMissingValuationSchemaError(resultError)) return { data: new Map(), error: resultError };

  const latest = new Map<string, number>();
  for (const row of (result.data || []) as unknown as DatabaseRow[]) {
    const equipmentId = text(row.equipment_id);
    const replacementValue = positiveNumber(row.replacement_value);
    if (equipmentId && replacementValue !== undefined && !latest.has(equipmentId)) latest.set(equipmentId, replacementValue);
  }
  return { data: latest, error: null };
}

export function mapBorrowingRow(row: BorrowingDbRow, replacementValues?: ReadonlyMap<string, number>): BorrowingReadRecord {
  if (typeof row.borrower_nama === 'string' && Array.isArray(row.items)) {
    return withReplacementValues(row as BorrowingReadRecord, replacementValues);
  }
  const student = relationObject(row.students);
  const rawItems = Array.isArray(row.borrowing_items) ? row.borrowing_items : [];
  const items = rawItems.map((itemValue) => {
    const item = asRow(itemValue);
    const equipment = relationObject(item.equipment);
    const equipmentId = text(item.equipment_id ?? equipment.id);
    return {
      borrowing_item_id: text(item.id) || undefined,
      equipment_id: equipmentId,
      kode_alat: text(equipment.kode_alat ?? equipment.kode_qr ?? item.kode_alat),
      nama_alat: text(equipment.nama_alat ?? item.nama_alat),
      status: text(item.status, 'pending'),
      kondisi_awal: text(item.kondisi_awal ?? equipment.kondisi ?? equipment.physical_condition, 'bagus'),
      kondisi_kembali: typeof item.kondisi_kembali === 'string' ? item.kondisi_kembali : undefined,
      denda_kerusakan: Number(item.denda || 0),
      replacement_value: replacementValues?.get(equipmentId) ?? positiveNumber(equipment.replacement_value),
    };
  });
  const dueAt = row.due_at ?? row.rencana_kembali;
  return {
    id: text(row.id), borrower_id: text(row.student_id), borrower_nama: text(student.nama, 'Siswa'), borrower_nis: text(student.nis) || undefined,
    kelas: text(student.kelas) || undefined, items, tanggal_pinjam: text(row.tanggal_pinjam ?? row.borrowed_at ?? row.created_at),
    rencana_kembali: text(row.rencana_kembali ?? row.due_at), tanggal_dikembalikan: typeof row.returned_at === 'string' ? row.returned_at : undefined,
    keperluan: text(row.keperluan), status: mapStatus(row.status, dueAt), catatan_persetujuan: typeof row.catatan_persetujuan === 'string' ? row.catatan_persetujuan : undefined,
    catatan_pengembalian: typeof row.catatan_pengembalian === 'string' ? row.catatan_pengembalian : undefined, total_denda: Number(row.total_denda || items.reduce((sum, item) => sum + item.denda_kerusakan, 0)),
    approved_by: typeof row.approved_by === 'string' ? row.approved_by : undefined, processed_return_by: typeof row.processed_return_by === 'string' ? row.processed_return_by : undefined, created_by: typeof row.created_by === 'string' ? row.created_by : undefined,
    updated_by: typeof row.updated_by === 'string' ? row.updated_by : undefined, created_at: text(row.created_at), updated_at: typeof row.updated_at === 'string' ? row.updated_at : undefined,
    return_reported_at: typeof row.return_reported_at === 'string' ? row.return_reported_at : undefined,
    return_notes: typeof row.return_notes === 'string' ? row.return_notes : undefined,
    return_verified_at: typeof row.return_verified_at === 'string' ? row.return_verified_at : undefined,
    return_verified_by: typeof row.return_verified_by === 'string' ? row.return_verified_by : undefined,
  };
}

function parsePage(query: BorrowingReadQuery) {
  const rawPage = Number(query.page); const rawSize = Number(query.pageSize);
  const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1;
  const pageSize = Number.isFinite(rawSize) ? Math.min(100, Math.max(1, Math.floor(rawSize))) : 20;
  return { page, pageSize, from: (page - 1) * pageSize, to: page * pageSize - 1 };
}

function requestedStatus(status?: string): string | undefined {
  if (status === 'menunggu_persetujuan') return 'pending'; if (status === 'disetujui') return 'approved'; if (status === 'ditolak') return 'rejected';
  if (status === 'dipinjam' || status === 'terlambat') return 'borrowed'; if (status === 'menunggu_verifikasi') return 'pending_verification'; if (status === 'dikembalikan') return 'returned'; return undefined;
}

function emptySummary(): BorrowingSummary { return { totalActive: 0, pendingApproval: 0, overdueCount: 0, returnedToday: 0 }; }

export function createBorrowingReadRepository(
  client: SupabaseLike,
  memoryRows: readonly BorrowingDbRow[] = [],
  memoryEquipment: readonly { id: string; replacement_value?: number }[] = [],
): BorrowingReadRepository {
  const getMemoryReplacementValues = () => new Map(
    memoryEquipment.flatMap((item) => {
      const replacementValue = positiveNumber(item.replacement_value);
      return replacementValue === undefined ? [] : [[item.id, replacementValue] as const];
    }),
  );
  return {
    isConfigured: () => client !== null,
    async list(query, scope) {
      const { page, pageSize, from, to } = parsePage(query);
      if (!client) {
        const replacementValues = getMemoryReplacementValues();
        let rows = memoryRows.map((row) => mapBorrowingRow(row, replacementValues));
        if (scope.studentId) rows = rows.filter((row) => row.borrower_id === scope.studentId);
        if (query.borrower_id && !scope.studentId) rows = rows.filter((row) => row.borrower_id === query.borrower_id);
        const requested = requestedStatus(query.status);
        if (query.status === 'terlambat') rows = rows.filter((row) => row.status === 'terlambat');
        else if (requested) rows = rows.filter((row) => ({
          pending: 'menunggu_persetujuan', approved: 'disetujui', rejected: 'ditolak', borrowed: 'dipinjam', pending_verification: 'menunggu_verifikasi', returned: 'dikembalikan',
        } as Record<string, string>)[requested] === row.status);
        const search = query.search?.trim().toLowerCase();
        if (search) rows = rows.filter((row) => row.borrower_nama.toLowerCase().includes(search) || row.borrower_nis?.toLowerCase().includes(search) || row.items.some((item) => item.kode_alat.toLowerCase().includes(search) || item.nama_alat.toLowerCase().includes(search)));
        rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)) || b.id.localeCompare(a.id));
        const total = rows.length;
        return { data: { data: rows.slice(from, to + 1), total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 }, error: null };
      }
      let dbQuery = client.from('borrowings').select(BORROWING_SELECT, { count: 'exact' });
      const status = requestedStatus(query.status);
      if (query.status === 'terlambat') {
        const now = new Date();
        const nowIso = now.toISOString();
        const todayUtc = nowIso.slice(0, 10);
        dbQuery = dbQuery.eq('status', 'borrowed')
          .or(`due_at.lt.${nowIso},and(due_at.is.null,rencana_kembali.lte.${todayUtc})`);
      } else if (status) dbQuery = dbQuery.eq('status', status);
      if (scope.studentId) dbQuery = dbQuery.eq('student_id', scope.studentId);
      if (query.borrower_id && !scope.studentId) dbQuery = dbQuery.eq('student_id', query.borrower_id);
      dbQuery = dbQuery.order('created_at', { ascending: false }).order('id', { ascending: false });
      const canRangeInDatabase = !query.search;
      if (canRangeInDatabase) dbQuery = dbQuery.range(from, to);
      const { data, count, error } = await dbQuery;
      if (error) return { data: null, error };
      const rawRows = (data || []) as unknown as DatabaseRow[];
      const replacementValues = await loadLatestReplacementValues(client, rawRows);
      if (replacementValues.error) return { data: null, error: replacementValues.error };
      let rows: BorrowingReadRecord[] = rawRows.map((row) => mapBorrowingRow(row, replacementValues.data));
      const search = query.search?.trim().toLowerCase();
      if (search) rows = rows.filter((record: BorrowingReadRecord) => record.borrower_nama.toLowerCase().includes(search) || record.borrower_nis?.toLowerCase().includes(search) || record.items.some((item) => item.kode_alat.toLowerCase().includes(search) || item.nama_alat.toLowerCase().includes(search)));
      if (query.status === 'terlambat') rows = rows.filter((record: BorrowingReadRecord) => record.status === 'terlambat');
      const total = canRangeInDatabase ? (count || 0) : rows.length;
      return { data: { data: canRangeInDatabase ? rows : rows.slice(from, to + 1), total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 }, error: null };
    },
    async summary(scope) {
      if (!client) {
        const replacementValues = getMemoryReplacementValues();
        const rows = memoryRows.map((row) => mapBorrowingRow(row, replacementValues)).filter((row) => !scope.studentId || row.borrower_id === scope.studentId);
        const today = new Date().toISOString().slice(0, 10);
        return { data: {
          totalActive: rows.filter((row) => ['menunggu_persetujuan', 'disetujui', 'dipinjam', 'menunggu_verifikasi', 'terlambat'].includes(row.status)).length,
          pendingApproval: rows.filter((row) => row.status === 'menunggu_persetujuan').length,
          overdueCount: rows.filter((row) => row.status === 'terlambat').length,
          returnedToday: rows.filter((row) => row.status === 'dikembalikan' && row.tanggal_dikembalikan?.slice(0, 10) === today).length,
        }, error: null };
      }
      const now = new Date();
      const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
      const tomorrowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
      const count = () => {
        let query = client.from('borrowings').select('id', { count: 'exact', head: true });
        if (scope.studentId) query = query.eq('student_id', scope.studentId);
        return query;
      };
      const [active, pending, overdue, returnedToday] = await Promise.all([
        count().in('status', ['pending', 'approved', 'borrowed', 'partial', 'pending_verification']),
        count().eq('status', 'pending'),
        count().eq('status', 'borrowed').lt('due_at', now.toISOString()),
        count().eq('status', 'returned').gte('returned_at', todayStart).lt('returned_at', tomorrowStart),
      ]);
      const failed = [active, pending, overdue, returnedToday].find((result) => result.error);
      if (failed?.error) return { data: null, error: failed.error };
      return { data: {
        totalActive: active.count ?? 0,
        pendingApproval: pending.count ?? 0,
        overdueCount: overdue.count ?? 0,
        returnedToday: returnedToday.count ?? 0,
      }, error: null };
    },
  };
}
