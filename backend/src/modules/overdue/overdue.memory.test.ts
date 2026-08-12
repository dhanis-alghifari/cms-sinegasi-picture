import assert from 'node:assert/strict';
import test from 'node:test';
import { createOverdueLogStore } from './overdue.memory.js';

test('overdue log store caps entries and manual response reads at most ten', () => {
  const store = createOverdueLogStore(2);
  const entry = (id: string) => ({
    id,
    borrowingId: id,
    studentName: 'Siswa',
    namaAlat: 'Kamera',
    dueAt: '2026-08-01T00:00:00.000Z',
    checkedAt: '2026-08-11T00:00:00.000Z',
    reason: 'SYSTEM:OVERDUE_CHECK',
  });

  for (let index = 0; index < 12; index++) store.add(entry(`log-${index}`));

  assert.deepEqual(store.recent(10).map((item) => item.id), ['log-11', 'log-10']);
  assert.deepEqual(store.recent(100).map((item) => item.id), ['log-11', 'log-10']);
});
