import assert from 'node:assert/strict';
import test from 'node:test';
import { createOverdueRepository } from './overdue.repository.js';
import type { OverdueBorrowing } from './overdue.types.js';

test('memory overdue repository adapter filters inactive rows and exposes bounded scan', async () => {
  const rows: OverdueBorrowing[] = [
    {
      id: 'bor-overdue',
      studentId: 'student-1',
      studentName: 'Siswa',
      studentUserId: 'user-1',
      namaAlat: 'Kamera',
      dueAt: '2026-08-01T00:00:00.000Z',
      status: 'borrowed',
    },
    {
      id: 'bor-returned',
      studentId: 'student-2',
      namaAlat: 'Tripod',
      dueAt: '2026-08-01T00:00:00.000Z',
      status: 'returned',
    },
  ];
  const repository = createOverdueRepository(null, rows);
  const captured: OverdueBorrowing[][] = [];

  const result = await repository.scanOverdueBorrowings(
    new Date('2026-08-11T00:00:00.000Z'),
    async (batch) => {
      captured.push([...batch]);
    },
  );

  assert.equal(repository.isConfigured(), false);
  assert.equal(result.error, null);
  assert.equal(result.checkedCount, 1);
  assert.deepEqual(captured.flat().map((row) => row.id), ['bor-overdue']);
  assert.deepEqual(await repository.listManagerIds(), { data: [], error: null });
  assert.deepEqual(await repository.listAuditedBorrowingIds(['bor-overdue']), { data: [], error: null });
  assert.deepEqual(
    await repository.createNotification({
      userId: 'user-1',
      borrowingId: 'bor-overdue',
      studentId: 'student-1',
      studentName: 'Siswa',
      equipment: 'Kamera',
      dueAt: '2026-08-01T00:00:00.000Z',
      daysOverdue: 10,
    }),
    { created: true, error: null },
  );
});
