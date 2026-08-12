import assert from 'node:assert/strict';
import test from 'node:test';
import { collectActorIds, enrichActorReferences } from './actors.enrichment.js';
import { ActorDirectory } from './actors.repository.js';

test('actor enrichment preserves UUIDs and adds one additive identity projection', () => {
  const payload = {
    data: [{ created_by: '11111111-1111-4111-a111-111111111111', updated_by: null }],
  } as { data: Array<Record<string, unknown>> };
  const ids = collectActorIds(payload);
  assert.deepEqual(ids, ['11111111-1111-4111-a111-111111111111']);
  enrichActorReferences(payload, new Map([
    ['11111111-1111-4111-a111-111111111111', {
      id: '11111111-1111-4111-a111-111111111111', nama: 'Guru', username: 'admin', role: 'teacher',
    }],
  ]));
  assert.equal(payload.data[0].created_by, '11111111-1111-4111-a111-111111111111');
  assert.deepEqual(payload.data[0].created_actor, {
    id: '11111111-1111-4111-a111-111111111111', nama: 'Guru', username: 'admin', role: 'teacher',
  });
});

test('actor enrichment does not overwrite an immutable audit projection', () => {
  const payload = {
    actor_user_id: '11111111-1111-4111-a111-111111111111',
    actor: { id: '11111111-1111-4111-a111-111111111111', nama: 'Nama saat kejadian', role: 'teacher' },
  } as { actor_user_id: string; actor: { id: string; nama: string; role: string } };
  enrichActorReferences(payload, new Map([
    ['11111111-1111-4111-a111-111111111111', { id: '11111111-1111-4111-a111-111111111111', nama: 'Nama baru', role: 'teacher' }],
  ]));
  assert.equal(payload.actor.nama, 'Nama saat kejadian');
});

test('actor directory batches misses and reuses its short-lived cache', async () => {
  const calls: string[][] = [];
  const client = {
    from() {
      return {
        select() {
          return {
            in(_column: string, ids: string[]) {
              calls.push(ids);
              return Promise.resolve({
                data: ids.map((id) => ({ id, nama: `Nama ${id.slice(0, 4)}`, username: `user-${id.slice(0, 4)}`, role: 'teacher', is_active: true })),
                error: null,
              });
            },
          };
        },
      };
    },
  } as never;
  const directory = new ActorDirectory(client);
  const first = await directory.resolve([
    '11111111-1111-4111-a111-111111111111',
    '22222222-2222-4222-a222-222222222222',
  ]);
  const second = await directory.resolve(['11111111-1111-4111-a111-111111111111']);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], [
    '11111111-1111-4111-a111-111111111111',
    '22222222-2222-4222-a222-222222222222',
  ]);
  assert.equal(first.get('11111111-1111-4111-a111-111111111111')?.username, 'user-1111');
  assert.equal(second.get('11111111-1111-4111-a111-111111111111')?.role, 'teacher');
});
