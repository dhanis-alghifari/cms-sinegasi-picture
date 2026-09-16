import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createDashboardMemoryState } from './dashboard.helpers.js';
import { createDashboardRepository } from './dashboard.repository.js';

type QueryResult = { data: unknown; error: null; count?: number };

function query(result: QueryResult): unknown {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: async () => result,
    then: (resolve: (value: QueryResult) => unknown) => Promise.resolve(result).then(resolve),
  };
  return chain;
}

function createClient(): SupabaseClient {
  const tables: Record<string, QueryResult> = {
    v_student_dashboard_summary: {
      data: {
        student_id: 'student-1', nama: 'Ari', nis: '001', kelas: 'X TKJ',
        peminatan: 'Sinematografi', foto_url: '', total_tunggakan: 15000,
      }, error: null,
    },
    cash_transactions: {
      data: [{ id: 'tx-1', nominal: 5000, tanggal: '2026-09-01', keterangan: 'Iuran' }], error: null,
    },
    grades: {
      data: [{ id: 'grade-1', nilai: 'A', updated_at: '2026-09-02', assignments: { title: 'Tugas 1', category: 'class_task' } }], error: null,
    },
  };

  return {
    from: (table: string) => query(tables[table] || { data: [], error: null }),
    rpc: async () => ({
      data: { hadir: 8, sakit: 1, izin: 1, alpha: 0, total: 10 },
      error: null,
    }),
  } as unknown as SupabaseClient;
}

test('dashboard repository uses aggregate attendance and bounded history reads', async () => {
  const repository = createDashboardRepository(createDashboardMemoryState(), createClient());
  const result = await repository.getStudentSummary('student-1');

  if (!('data' in result) || !result.data) throw new Error('Expected dashboard data.');
  assert.equal(result.data.attendance.total, 10);
  assert.equal(result.data.attendance.hadir, 8);
  assert.equal(result.data.cash.totalTunggakan, 15000);
  assert.equal(result.data.cash.riwayat[0]?.nominal, 5000);
  assert.equal(result.data.grades.terakhir[0]?.taskTitle, 'Tugas 1');
});
