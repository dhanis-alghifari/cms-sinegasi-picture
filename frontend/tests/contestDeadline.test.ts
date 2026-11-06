import assert from 'node:assert/strict';
import test from 'node:test';
import { contestBusinessToday, contestEditSchema, contestSchema } from '../src/features/contests/schemas/contestSchema';

const base = { nama_lomba: 'Festival Film', tingkat: 'nasional' as const, tahun_event: 2026, deadline: '' };

test('deadline is conditional on contest status', () => {
  assert.equal(contestSchema.safeParse({ ...base, status: 'selesai' }).success, true);
  assert.equal(contestSchema.safeParse({ ...base, status: 'proses_penjurian', deadline: '2000-01-01' }).success, true);
  assert.equal(contestSchema.safeParse({ ...base, status: 'buka' }).success, false);
  assert.equal(contestSchema.safeParse({ ...base, status: 'buka', deadline: '2000-01-01' }).success, false);
  assert.equal(contestSchema.safeParse({ ...base, status: 'buka', deadline: contestBusinessToday() }).success, true);
  assert.equal(contestEditSchema.safeParse({ ...base, status: 'buka', deadline: '2000-01-01' }).success, true);
});
