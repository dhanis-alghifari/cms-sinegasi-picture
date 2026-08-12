import type { SupabaseClient } from '@supabase/supabase-js';
import type { DatabaseError, DatabaseRow } from '../../shared/database/database.types.js';
import type { BorrowingReadPage, BorrowingReadQuery, BorrowingReadRecord, BorrowingReadScope, BorrowingSummary } from './borrowing.read.types.js';

export interface BorrowingReadRepository {
  isConfigured(): boolean;
  list(query: BorrowingReadQuery, scope: BorrowingReadScope): Promise<{ data: BorrowingReadPage | null; error: DatabaseError | null }>;
  summary(scope: BorrowingReadScope): Promise<{ data: BorrowingSummary | null; error: DatabaseError | null }>;
}

type SupabaseLike = SupabaseClient | null;
type BorrowingDbRow = DatabaseRow;

export const BORROWING_SELECT = 'id,student_id,tanggal_pinjam,borrowed_at,rencana_kembali,due_at,returned_at,keperluan,status,catatan_persetujuan,catatan_pengembalian,total_denda,approved_by,processed_return_by,created_by,updated_by,created_at,updated_at,students(id,nis,nama,kelas),borrowing_items(id,borrowing_id,equipment_id,status,kondisi_awal,kondisi_kembali,denda,tanggal_diserahkan,tanggal_dikembalikan,catatan,equipment(id,kode_alat,kode_qr,nama_alat,kategori,kondisi,physical_condition,status,availability_status))';
const SUMMARY_SELECT = 'status,due_at,returned_at,student_id';
const STATUS_MAP: Record<string, BorrowingReadRecord['status']> = {
  pending: 'menunggu_persetujuan', approved: 'disetujui', rejected: 'ditolak', borrowed: 'dipinjam', returned: 'dikembalikan', partial: 'dipinjam',
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
  return typeof value === 'string' ? value : value == null ? fallback : String(value);
}

export function mapBorrowingRow(row: BorrowingDbRow): BorrowingReadRecord {
  if (typeof row.borrower_nama === 'string' && Array.isArray(row.items)) {
    return row as BorrowingReadRecord;
  }
  const student = relationObject(row.students);
  const rawItems = Array.isArray(row.borrowing_items) ? row.borrowing_items : [];
  const items = rawItems.map((itemValue) => {
    const item = asRow(itemValue);
    const equipment = relationObject(item.equipment);
    return {
      borrowing_item_id: text(item.id) || undefined,
      equipment_id: text(item.equipment_id),
      kode_alat: text(equipment.kode_alat ?? equipment.kode_qr ?? item.kode_alat),
      nama_alat: text(equipment.nama_alat ?? item.nama_alat),
      status: text(item.status, 'pending'),
      kondisi_awal: text(item.kondisi_awal ?? equipment.kondisi ?? equipment.physical_condition, 'bagus'),
      kondisi_kembali: typeof item.kondisi_kembali === 'string' ? item.kondisi_kembali : undefined,
      denda_kerusakan: Number(item.denda || 0),
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
  if (status === 'dipinjam' || status === 'terlambat') return 'borrowed'; if (status === 'dikembalikan') return 'returned'; return undefined;
}

function emptySummary(): BorrowingSummary { return { totalActive: 0, pendingApproval: 0, overdueCount: 0, returnedToday: 0 }; }

export function createBorrowingReadRepository(client: SupabaseLike, memoryRows: readonly BorrowingDbRow[] = []): BorrowingReadRepository {
  return {
    isConfigured: () => client !== null,
    async list(query, scope) {
      const { page, pageSize, from, to } = parsePage(query);
      if (!client) {
        let rows = memoryRows.map((row) => mapBorrowingRow(row));
        if (scope.studentId) rows = rows.filter((row) => row.borrower_id === scope.studentId);
        if (query.borrower_id && !scope.studentId) rows = rows.filter((row) => row.borrower_id === query.borrower_id);
        const requested = requestedStatus(query.status);
        if (query.status === 'terlambat') rows = rows.filter((row) => row.status === 'terlambat');
        else if (requested) rows = rows.filter((row) => ({
          pending: 'menunggu_persetujuan', approved: 'disetujui', rejected: 'ditolak', borrowed: 'dipinjam', returned: 'dikembalikan',
        } as Record<string, string>)[requested] === row.status);
        const search = query.search?.trim().toLowerCase();
        if (search) rows = rows.filter((row) => row.borrower_nama.toLowerCase().includes(search) || row.borrower_nis?.toLowerCase().includes(search) || row.items.some((item) => item.kode_alat.toLowerCase().includes(search) || item.nama_alat.toLowerCase().includes(search)));
        rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)) || b.id.localeCompare(a.id));
        const total = rows.length;
        return { data: { data: rows.slice(from, to + 1), total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 }, error: null };
      }
      let dbQuery = client.from('borrowings').select(BORROWING_SELECT, { count: 'exact' });
      const status = requestedStatus(query.status); if (status) dbQuery = dbQuery.eq('status', status);
      if (scope.studentId) dbQuery = dbQuery.eq('student_id', scope.studentId);
      if (query.borrower_id && !scope.studentId) dbQuery = dbQuery.eq('student_id', query.borrower_id);
      dbQuery = dbQuery.order('created_at', { ascending: false }).order('id', { ascending: false });
      const canRangeInDatabase = !query.search && query.status !== 'terlambat';
      if (canRangeInDatabase) dbQuery = dbQuery.range(from, to);
      const { data, count, error } = await dbQuery;
      if (error) return { data: null, error };
      let rows: BorrowingReadRecord[] = (data || []).map((row) => mapBorrowingRow(row as BorrowingDbRow));
      const search = query.search?.trim().toLowerCase();
      if (search) rows = rows.filter((record: BorrowingReadRecord) => record.borrower_nama.toLowerCase().includes(search) || record.borrower_nis?.toLowerCase().includes(search) || record.items.some((item) => item.kode_alat.toLowerCase().includes(search) || item.nama_alat.toLowerCase().includes(search)));
      if (query.status === 'terlambat') rows = rows.filter((record: BorrowingReadRecord) => record.status === 'terlambat');
      const total = canRangeInDatabase ? (count || 0) : rows.length;
      return { data: { data: canRangeInDatabase ? rows : rows.slice(from, to + 1), total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 }, error: null };
    },
    async summary(scope) {
      if (!client) {
        const rows = memoryRows.map((row) => mapBorrowingRow(row)).filter((row) => !scope.studentId || row.borrower_id === scope.studentId);
        const today = new Date().toISOString().slice(0, 10);
        return { data: {
          totalActive: rows.filter((row) => ['menunggu_persetujuan', 'disetujui', 'dipinjam', 'terlambat'].includes(row.status)).length,
          pendingApproval: rows.filter((row) => row.status === 'menunggu_persetujuan').length,
          overdueCount: rows.filter((row) => row.status === 'terlambat').length,
          returnedToday: rows.filter((row) => row.status === 'dikembalikan' && row.tanggal_dikembalikan?.slice(0, 10) === today).length,
        }, error: null };
      }
      let dbQuery = client.from('borrowings').select(SUMMARY_SELECT);
      if (scope.studentId) dbQuery = dbQuery.eq('student_id', scope.studentId);
      const { data, error } = await dbQuery;
      if (error) return { data: null, error };
      const rows: DatabaseRow[] = (data || []).map((row) => asRow(row)); const today = new Date().toISOString().slice(0, 10);
      return { data: {
        totalActive: rows.filter((row) => ['pending', 'approved', 'borrowed', 'partial'].includes(String(row.status))).length,
        pendingApproval: rows.filter((row) => row.status === 'pending').length,
        overdueCount: rows.filter((row) => row.status === 'borrowed' && row.due_at && new Date(String(row.due_at)).getTime() < Date.now()).length,
        returnedToday: rows.filter((row) => row.status === 'returned' && typeof row.returned_at === 'string' && row.returned_at.slice(0, 10) === today).length,
      }, error: null };
    },
  };
}
