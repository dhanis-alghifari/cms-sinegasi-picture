import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  OverdueAuditInput,
  OverdueBorrowing,
  OverdueNotificationInput,
  OverdueRepository,
  OverdueRepositoryError,
} from './overdue.types.js';
import { MOCK_OVERDUE_BORROWINGS } from './overdue.memory.js';

type SupabaseLike = SupabaseClient | null;

export const OVERDUE_BATCH_SIZE = 500;

const OVERDUE_SELECT = 'id,student_id,status,due_at,students(user_id,nama),borrowing_items(equipment(nama_alat))';

type SupabaseBorrowing = {
  id: string;
  student_id: string;
  status: string;
  due_at: string | null;
  students?: { user_id?: string | null; nama?: string | null } | Array<{ user_id?: string | null; nama?: string | null }> | null;
  borrowing_items?: Array<{ equipment?: { nama_alat?: string | null } | Array<{ nama_alat?: string | null }> | null }> | null;
};

type FallbackBorrowing = OverdueBorrowing;

function toError(error: unknown): OverdueRepositoryError | null {
  if (!error) return null;
  const candidate = error as OverdueRepositoryError;
  return { code: candidate.code, message: candidate.message, details: candidate.details };
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] || null : value || null;
}

function mapBorrowing(row: SupabaseBorrowing): OverdueBorrowing | null {
  if (!row.due_at) return null;
  const student = firstRelation(row.students);
  const equipmentNames = (row.borrowing_items || [])
    .map((item) => firstRelation(item.equipment)?.nama_alat)
    .filter((name): name is string => Boolean(name));

  return {
    id: row.id,
    studentId: row.student_id,
    studentName: student?.nama || undefined,
    studentUserId: student?.user_id || undefined,
    namaAlat: equipmentNames.join(', ') || 'alat pinjaman',
    dueAt: row.due_at,
    status: row.status,
  };
}

export function createOverdueRepository(
  client: SupabaseLike,
  fallbackBorrowings: readonly FallbackBorrowing[] = MOCK_OVERDUE_BORROWINGS,
): OverdueRepository {
  return {
    isConfigured: () => client !== null,

    async scanOverdueBorrowings(now, onBatch) {
      if (!client) {
        const rows = fallbackBorrowings.filter((row) => row.status === 'borrowed');
        for (let offset = 0; offset < rows.length; offset += OVERDUE_BATCH_SIZE) {
          await onBatch(rows.slice(offset, offset + OVERDUE_BATCH_SIZE));
        }
        return { checkedCount: rows.length, error: null };
      }

      let offset = 0;
      let checkedCount = 0;
      while (true) {
        const { data, error } = await client
          .from('borrowings')
          .select(OVERDUE_SELECT)
          .eq('status', 'borrowed')
          .lt('due_at', now.toISOString())
          .order('due_at', { ascending: true })
          .order('id', { ascending: true })
          .range(offset, offset + OVERDUE_BATCH_SIZE - 1);
        if (error) return { checkedCount, error: toError(error) };

        const rows = (data || [])
          .map((row) => mapBorrowing(row as SupabaseBorrowing))
          .filter((row): row is OverdueBorrowing => row !== null);
        if (rows.length === 0) break;

        await onBatch(rows);
        checkedCount += rows.length;
        if (rows.length < OVERDUE_BATCH_SIZE) break;
        offset += rows.length;
      }

      return { checkedCount, error: null };
    },

    async listManagerIds() {
      if (!client) return { data: [], error: null };
      const managerIds: string[] = [];
      let offset = 0;
      while (true) {
        const { data, error } = await client
          .from('users')
          .select('id')
          .in('role', ['teacher', 'leader'])
          .eq('is_active', true)
          .order('id', { ascending: true })
          .range(offset, offset + OVERDUE_BATCH_SIZE - 1);
        if (error) return { data: managerIds, error: toError(error) };

        const page = data || [];
        managerIds.push(...page.map((manager) => manager.id).filter((id): id is string => Boolean(id)));
        if (page.length < OVERDUE_BATCH_SIZE) break;
        offset += page.length;
      }
      return { data: managerIds, error: null };
    },

    async createNotification(input: OverdueNotificationInput) {
      if (!client) return { created: true, error: null };
      const eventKey = `${input.borrowingId}:overdue:${input.userId}`;
      const { error } = await client.from('notifications').insert({
        user_id: input.userId,
        type: 'borrowing_overdue',
        title: '⚠️ Alat Pinjaman Telat Dikembalikan!',
        body: `${input.equipment} milik ${input.studentName} melewati batas pengembalian ${input.dueAt.slice(0, 10)} (${input.daysOverdue} hari terlambat).`,
        is_read: false,
        metadata: {
          borrowing_id: input.borrowingId,
          student_id: input.studentId,
          equipment: input.equipment,
          due_at: input.dueAt,
          days_overdue: input.daysOverdue,
          event_key: eventKey,
          link_url: '/borrowing',
        },
      });
      if (error?.code === '23505') return { created: false, error: null };
      return { created: !error, error: toError(error) };
    },

    async listAuditedBorrowingIds(borrowingIds) {
      if (!client || borrowingIds.length === 0) return { data: [], error: null };
      const { data, error } = await client
        .from('activity_logs')
        .select('record_id')
        .eq('table_name', 'borrowings')
        .eq('change_reason', 'SYSTEM:OVERDUE_CHECK')
        .in('record_id', [...borrowingIds]);
      return {
        data: (data || [])
          .map((row) => row.record_id)
          .filter((id): id is string => Boolean(id)),
        error: toError(error),
      };
    },

    async recordAudit(input: OverdueAuditInput) {
      if (!client) return { error: null };
      const { error } = await client.from('activity_logs').insert({
        user_id: null,
        action: 'SYSTEM_CHECK',
        table_name: 'borrowings',
        record_id: input.borrowingId,
        new_values: {
          status: 'borrowed',
          due_at: input.dueAt,
          days_overdue: input.daysOverdue,
          notification_recipient_count: input.recipientCount,
        },
        change_reason: 'SYSTEM:OVERDUE_CHECK',
      });
      return { error: toError(error) };
    },
  };
}
