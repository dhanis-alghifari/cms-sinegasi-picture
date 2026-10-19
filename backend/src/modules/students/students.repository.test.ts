import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createStudentsMemoryState } from './students.helpers.js';
import { createStudentRepository } from './students.repository.js';

test('profile update sends actor and reason in one audited RPC, without a separate session call', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      return { data: { id: 'student-1', nis: 'TEST-001', nama: 'Siswa Uji', kelas: 'X Uji', is_active: true }, error: null };
    },
  } as unknown as SupabaseClient;
  const repository = createStudentRepository(client, createStudentsMemoryState());
  const result = await repository.updateProfile!({
    id: 'student-1', changes: { nama: 'Siswa Uji', kelas: 'X Uji', peminatan: 'naskah', foto_url: '' },
    actorId: 'actor-1', changeReason: 'Memperbarui foto pengujian',
  });
  assert.equal(result.data?.id, 'student-1');
  assert.deepEqual(calls, [{
    name: 'update_student_profile_audited_atomic',
    args: {
      p_student_id: 'student-1', p_nama: 'Siswa Uji', p_kelas: 'X Uji', p_peminatan: 'naskah',
      p_no_telepon: null, p_foto_url: null, p_updated_by: 'actor-1',
      p_change_reason: 'Memperbarui foto pengujian',
    },
  }]);
});

test('profile RPC failure is returned without retrying the unaudited legacy RPC', async () => {
  const calls: string[] = [];
  const error = { code: 'P0001', message: 'Synthetic audit failure' };
  const client = {
    async rpc(name: string) { calls.push(name); return { data: null, error }; },
  } as unknown as SupabaseClient;
  const repository = createStudentRepository(client, createStudentsMemoryState());
  const result = await repository.updateProfile!({
    id: 'student-1', changes: { nama: 'Siswa Uji', kelas: 'X Uji' },
    actorId: 'actor-1', changeReason: 'Memperbarui foto pengujian',
  });
  assert.equal(result.error, error);
  assert.deepEqual(calls, ['update_student_profile_audited_atomic']);
});
