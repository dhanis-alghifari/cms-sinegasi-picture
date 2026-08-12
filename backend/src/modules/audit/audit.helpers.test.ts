import assert from 'node:assert/strict';
import test from 'node:test';
import { mapAuditLogRow, redactAuditValues } from './audit.helpers.js';

test('audit responses redact legacy and nested credential fields', () => {
  assert.deepEqual(redactAuditValues({
    username: 'user', password_hash: 'scrypt$secret', nested: { token: 'jwt' },
    items: [{ api_key: 'key', value: 1 }],
  }), {
    username: 'user', password_hash: '[REDACTED]', nested: { token: '[REDACTED]' },
    items: [{ api_key: '[REDACTED]', value: 1 }],
  });
});

test('mapped audit entries never expose a password hash', () => {
  const row = mapAuditLogRow({
    id: 'audit-1', action: 'UPDATE', table_name: 'users', created_at: new Date().toISOString(),
    old_values: { password_hash: 'old-hash' }, new_values: { password_hash: 'new-hash' },
  });
  assert.equal(row.old_values?.password_hash, '[REDACTED]');
  assert.equal(row.new_values?.password_hash, '[REDACTED]');
});
