import assert from 'node:assert/strict';
import test from 'node:test';
import { contestEditSchema, contestSchema } from '../src/features/contests/schemas/contestSchema';

const event = {
  nama_lomba: 'Festival Sintetis', kota: '', tingkat: 'nasional',
  status: 'selesai', tahun_event: 2020, deadline: '',
};

test('rollback can create or edit a finished or judging event without a deadline', () => {
  for (const status of ['selesai', 'proses_penjurian']) {
    assert.equal(contestEditSchema.safeParse({ ...event, status }).success, true);
    assert.equal(contestSchema.safeParse({ ...event, status }).success, true);
  }
});

test('rollback requires a deadline for open events and validates calendar dates', () => {
  assert.equal(contestEditSchema.safeParse({ ...event, status: 'buka' }).success, false);
  assert.equal(contestSchema.safeParse({ ...event, status: 'buka' }).success, false);
  assert.equal(contestEditSchema.safeParse({ ...event, deadline: '2028-02-31' }).success, false);
});
