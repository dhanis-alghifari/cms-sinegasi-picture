import assert from 'node:assert/strict';
import test from 'node:test';
import { contestEditSchema, contestSchema } from '../src/features/contests/schemas/contestSchema';
import { rollbackDeadlinePatch } from '../src/features/contests/utils/rollbackDeadline';

const event = {
  nama_lomba: 'Festival Sintetis', kota: '', tingkat: 'nasional',
  status: 'selesai', tahun_event: 2020, deadline: '',
};

test('rollback can edit a finished or judging event without sending a null deadline', () => {
  for (const status of ['selesai', 'proses_penjurian']) {
    assert.equal(contestEditSchema.safeParse({ ...event, status }).success, true);
  }
  assert.deepEqual(rollbackDeadlinePatch('', null), {});
  assert.deepEqual(rollbackDeadlinePatch('2028-12-01', null), { deadline: '2028-12-01' });
  assert.deepEqual(rollbackDeadlinePatch('2028-12-01', '2028-12-01'), {});
});

test('rollback rejects clearing an existing deadline and still requires one for open events and creation', () => {
  assert.throws(() => rollbackDeadlinePatch('', '2028-12-01'), /tidak dapat dikosongkan/);
  assert.equal(contestEditSchema.safeParse({ ...event, status: 'buka' }).success, false);
  assert.equal(contestSchema.safeParse(event).success, false);
  assert.equal(contestEditSchema.safeParse({ ...event, deadline: '2028-02-31' }).success, false);
});
