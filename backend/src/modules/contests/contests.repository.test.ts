import assert from 'node:assert/strict';
import test from 'node:test';
import { createContestsRepository } from './contests.repository.js';

test('production contest update delegates to the atomic RPC with audit context', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      return {
        async maybeSingle() {
          return {
            data: {
              id: 'contest-1',
              nama: 'Festival Film',
              nama_lomba: 'Festival Film',
              jenis: 'Festival / Perlombaan',
              level: 'nasional',
              tingkat: 'Nasional',
              tanggal: '2026-09-01',
              deadline: '2026-09-01',
              status: 'progres',
              status_public: 'proses_penjurian',
              hasil: null,
              kota: 'Bekasi',
              tahun_event: 2026,
            },
            error: null,
          };
        },
      };
    },
  };
  const repository = createContestsRepository(client as never, { contests: [], submissions: [] });
  const result = await repository.update('contest-1', {
    changes: { nama_lomba: 'Festival Film Bekasi', status: 'progres', status_public: 'proses_penjurian' },
    actorId: '11111111-1111-4111-a111-111111111111',
    changeReason: 'Memperbarui status event',
    auditContext: {
      requestId: '22222222-2222-4222-a222-222222222222',
      operationId: '33333333-3333-4333-a333-333333333333',
      userAgent: 'test-agent',
    },
  });

  const dataResult = result as { data?: { nama?: string } | null };
  assert.equal(dataResult.data?.nama, 'Festival Film');
  assert.deepEqual(calls, [{
    name: 'update_contest_atomic',
    args: {
      p_contest_id: 'contest-1',
      p_changes: { nama_lomba: 'Festival Film Bekasi', status: 'progres', status_public: 'proses_penjurian' },
      p_updated_by: '11111111-1111-4111-a111-111111111111',
      p_change_reason: 'Memperbarui status event',
      p_request_id: '22222222-2222-4222-a222-222222222222',
      p_operation_id: '33333333-3333-4333-a333-333333333333',
      p_user_agent: 'test-agent',
    },
  }]);
});
