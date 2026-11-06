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

test('changing or clearing NIS uses the new audited RPC and passes the explicit value', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      return { data: { id: 'student-1', nis: args.p_nis, nama: 'Siswa Uji', kelas: 'X Uji', is_active: true }, error: null };
    },
  } as unknown as SupabaseClient;
  const repository = createStudentRepository(client, createStudentsMemoryState());
  for (const nis of ['00123', null]) {
    const result = await repository.updateProfile!({
      id: 'student-1', changes: { nis, nama: 'Siswa Uji', kelas: 'X Uji' }, actorId: 'actor-1', changeReason: 'Koreksi NIS siswa',
    });
    assert.equal(result.data?.nis, nis);
    assert.equal(calls.at(-1)?.name, 'update_student_profile_nis_audited_atomic');
    assert.equal(calls.at(-1)?.args.p_nis, nis);
  }
});

test('database student projection maps NULL NIS and the explicitly linked account only', async () => {
  const selections: string[] = [];
  const row = { id: 'student-1', user_id: 'user-1', nis: null, nama: 'Siswa Uji', kelas: 'X Uji', is_active: true, account: { username: 'akun.siswa' } };
  const query = {
    select(columns: string) { selections.push(columns); return this; },
    eq() { return this; },
    async maybeSingle() { return { data: row, error: null }; },
  };
  const repository = createStudentRepository({ from: () => query } as never);
  const result = await repository.findByIdentifier('student-1', true);
  assert.equal(result.data?.nis, null);
  assert.equal(result.data?.username, 'akun.siswa');
  assert.match(selections[0], /account:users!students_user_id_fkey\(username\)/);
});
