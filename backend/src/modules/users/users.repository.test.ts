import assert from 'node:assert/strict';
import test from 'node:test';
import { createUsersMemoryState } from './users.helpers.js';
import { createUsersRepository } from './users.repository.js';

test('production reset repository delegates to the atomic RPC and never issues a direct update', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      return {
        async maybeSingle() {
          return {
            data: {
              id: 'target-1', username: 'target', nama: 'Target', role: 'member',
              is_active: true, is_first_login: true,
              auth_version: 2, updated_at: new Date().toISOString(),
            },
            error: null,
          };
        },
      };
    },
  };
  const repository = createUsersRepository(client as never, createUsersMemoryState());
  const result = await repository.resetPassword(
    'target-1', 'scrypt$16384$8$1$abcdefghijklmnop$abcdefghijklmnop',
    'teacher-1', 'Reset karena lupa', 'reset-repository-key-001',
  );

  assert.equal('data' in result, true);
  assert.deepEqual(calls, [{
    name: 'reset_user_password_atomic',
    args: {
      p_user_id: 'target-1',
      p_password_hash: 'scrypt$16384$8$1$abcdefghijklmnop$abcdefghijklmnop',
      p_updated_by: 'teacher-1',
      p_change_reason: 'Reset karena lupa',
      p_operation_key: 'reset-repository-key-001',
      p_request_id: null,
      p_operation_id: null,
    },
  }]);
});

test('production user update delegates to the atomic RPC with audit context', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      return {
        async maybeSingle() {
          return {
            data: {
              id: 'target-1', username: 'target.updated', nama: 'Target', role: 'member',
              is_active: true, is_first_login: false,
              created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
              created_by: null, updated_by: 'teacher-1',
            },
            error: null,
          };
        },
      };
    },
  };
  const repository = createUsersRepository(client as never, createUsersMemoryState());
  const result = await repository.update(
    'target-1',
    { username: 'target.updated' },
    'teacher-1',
    'Menyesuaikan username login',
    { requestId: '11111111-1111-4111-a111-111111111111', operationId: '22222222-2222-4222-a222-222222222222' },
  );

  assert.equal('data' in result, true);
  assert.deepEqual(calls, [{
    name: 'update_user_account_atomic',
    args: {
      p_user_id: 'target-1',
      p_changes: { username: 'target.updated' },
      p_updated_by: 'teacher-1',
      p_change_reason: 'Menyesuaikan username login',
      p_request_id: '11111111-1111-4111-a111-111111111111',
      p_operation_id: '22222222-2222-4222-a222-222222222222',
    },
  }]);
});
