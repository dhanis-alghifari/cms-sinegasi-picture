import assert from 'node:assert/strict';
import test from 'node:test';
import { createCashDisputesRepository } from './cash.disputes.repository.js';
import type { CashDisputeMemoryState } from './cash.disputes.types.js';

test('cash dispute repository creates through the atomic RPC contract', async () => {
  const row = {
    id: 'dispute-1',
    transaction_id: null,
    debt_record_id: 'debt-1',
    student_id: 'student-1',
    reason: 'Pembayaran sudah dilakukan',
    alasan_sanggahan: 'Pembayaran sudah dilakukan',
    bukti_sanggahan_url: 'data:image/jpeg;base64,proof',
    status: 'pending',
    created_by: 'member-1',
    created_at: '2026-08-15T00:00:00.000Z',
  };
  const client = {
    from(table: string) {
      assert.equal(table, 'cash_disputes');
      return { select: () => ({}) };
    },
    rpc(name: string, args: Record<string, unknown>) {
      assert.equal(name, 'create_cash_dispute_atomic');
      assert.deepEqual(args, {
        p_student_id: 'student-1',
        p_transaction_id: null,
        p_debt_record_id: 'debt-1',
        p_reason: 'Pembayaran sudah dilakukan',
        p_evidence_value: 'data:image/jpeg;base64,proof',
        p_actor_id: 'member-1',
        p_idempotency_key: 'key-0001',
      });
      return Promise.resolve({ data: { dispute: row, quota: { period: '2026-08', period_start: '2026-08-01', limit: 2, used: 1, remaining: 1, resets_at: '2026-09-01T00:00:00.000Z' }, idempotent_replay: false }, error: null });
    },
  } as any;

  const repository = createCashDisputesRepository(client, { transactions: [] });
  const result = await repository.createAtomic({
    debtRecordId: 'debt-1',
    studentId: 'student-1',
    reason: 'Pembayaran sudah dilakukan',
    proofUrl: 'data:image/jpeg;base64,proof',
    actorId: 'member-1',
    idempotencyKey: 'key-0001',
  });
  assert.equal(result.error, null);
  assert.equal(result.data?.dispute.debt_record_id, 'debt-1');
});

test('cash dispute repository disambiguates the transaction relationship', async () => {
  let selection = '';
  const query: any = {
    eq: () => query,
    or: () => query,
    order: () => query,
    range: () => Promise.resolve({ data: [], count: 0, error: null }),
  };
  const client = {
    from(table: string) {
      assert.equal(table, 'cash_disputes');
      return {
        select(select: string) {
          selection = select;
          return query;
        },
      };
    },
  } as any;

  const repository = createCashDisputesRepository(client, { transactions: [] });
  await repository.list({ page: '1', pageSize: '5' }, null);

  assert.match(selection, /cash_transactions!cash_disputes_transaction_id_fkey\(/);
});

test('cash dispute repository settles an unpaid debt using its recorded amount', async () => {
  const debt = {
    id: 'debt-1',
    student_id: 'student-1',
    amount: 26998,
    status: 'unpaid' as const,
    keterangan: 'Iuran tertunggak',
    periode: '2026-09',
    idempotency_key: 'debt-key-1',
    created_at: '2026-09-01T00:00:00.000Z',
  };
  const dispute = {
    id: 'dispute-1',
    debt_record_id: debt.id,
    student_id: debt.student_id,
    reason: 'Pembayaran sudah dilakukan',
    has_evidence: true,
    status: 'pending' as const,
    quota_period_start: '2026-09-01',
    attempt_number: 1,
    created_at: '2026-09-15T00:00:00.000Z',
  };
  const memory: CashDisputeMemoryState = { transactions: [], debts: [debt], disputes: [dispute] };
  const repository = createCashDisputesRepository(null, memory);

  const result = await repository.reviewAtomic({
    id: dispute.id,
    status: 'approved',
    reviewNote: 'Bukti pembayaran sesuai.',
    actorId: 'teacher-1',
    resolutionDate: '2026-09-20',
    paymentMethodCode: 'cash',
  });

  assert.equal(result.error, null);
  assert.equal(memory.transactions[0]?.nominal, debt.amount);
  assert.equal(debt.status, 'paid');
});
