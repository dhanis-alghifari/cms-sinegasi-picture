import assert from 'node:assert/strict';
import test from 'node:test';
import { AuditService, AuditServiceError } from './audit.service.js';
import type { AuditRepository, AuditRepositoryResult, AuditLogRow } from './audit.types.js';

const row: AuditLogRow = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  user_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  action: 'UPDATE',
  table_name: 'students',
  record_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  change_reason: 'Koreksi nama siswa',
  created_at: '2026-08-11T00:00:00.000Z',
  changed_fields: ['nama'],
  metadata: { source: 'test' },
  actor_name_snapshot: 'Teacher',
};

function result<T>(data: T | null, count?: number, error: any = null): AuditRepositoryResult<T> {
  return { data, count, error };
}

function createRepository(overrides: Partial<AuditRepository> = {}): AuditRepository {
  return {
    isConfigured: () => true,
    list: async () => result([row], 1),
    getEntry: async () => result(row),
    listRecordHistory: async () => result([row], 1),
    persist: async () => undefined,
    ...overrides,
  };
}

test('audit service normalizes bounded filters and maps list response', async () => {
  let received: any;
  const service = new AuditService(createRepository({
    list: async (query) => {
      received = query;
      return result([row], 1);
    },
  }));

  const page = await service.list({ page: '2', pageSize: '500', action: 'update', search: 'student%,name' });
  assert.equal(received.page, 2);
  assert.equal(received.pageSize, 100);
  assert.equal(received.from, 100);
  assert.equal(received.action, 'UPDATE');
  assert.equal(received.search, 'student name');
  assert.equal(page.totalPages, 1);
  assert.equal(page.data[0]?.actor?.nama, 'Teacher');
  assert.deepEqual(page.data[0]?.changed_fields, ['nama']);
});

test('audit service rejects invalid filters, ids, and date ranges', async () => {
  const service = new AuditService(createRepository());

  await assert.rejects(() => service.list({ action: 'DROP' }), (error: unknown) => error instanceof AuditServiceError && error.statusCode === 422);
  await assert.rejects(() => service.list({ date_from: '2026-08-12', date_to: '2026-08-11' }), (error: unknown) => error instanceof AuditServiceError && error.statusCode === 422);
  await assert.rejects(() => service.getEntry('not-a-uuid'), (error: unknown) => error instanceof AuditServiceError && error.statusCode === 422);
  await assert.rejects(() => service.listRecordHistory('students;drop', 'record-1'), (error: unknown) => error instanceof AuditServiceError && error.statusCode === 422);
});

test('audit service maps missing schema and not-found errors', async () => {
  const unavailable = new AuditService(createRepository({ list: async () => result<AuditLogRow[]>(null, 0, { code: '42P01' }) }));
  await assert.rejects(() => unavailable.list(), (error: unknown) => error instanceof AuditServiceError && error.statusCode === 503);

  const missing = new AuditService(createRepository({ getEntry: async () => result<AuditLogRow>(null) }));
  await assert.rejects(() => missing.getEntry(row.id), (error: unknown) => error instanceof AuditServiceError && error.statusCode === 404);
});
