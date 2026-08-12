import assert from 'node:assert/strict';
import test from 'node:test';
import { createBillingRepository } from './billing.repository.js';

test('billing repository returns a safe result when Supabase is unavailable', async () => {
  const repository = createBillingRepository(null);

  assert.equal(repository.isConfigured(), false);
  assert.deepEqual(await repository.generateWeeklyBilling('2026-08-10'), {
    data: { studentsBilled: 0, totalNominal: 0, status: 'database_unavailable' },
    error: null,
  });
});

test('billing repository calls the database RPC and normalizes its row result', async () => {
  let rpcName = '';
  let rpcArguments: unknown;
  const client = {
    rpc: async (name: string, args: unknown) => {
      rpcName = name;
      rpcArguments = args;
      return {
        data: [{ students_billed: '12', total_nominal: '1500.50', status: 'completed', billing_week: '2026-W32' }],
        error: null,
      };
    },
  };

  const repository = createBillingRepository(client as any);
  const result = await repository.generateWeeklyBilling('2026-08-10');

  assert.equal(repository.isConfigured(), true);
  assert.equal(rpcName, 'generate_weekly_cash_billing');
  assert.deepEqual(rpcArguments, { p_run_date: '2026-08-10' });
  assert.deepEqual(result, {
    data: { studentsBilled: 12, totalNominal: 1500.5, status: 'completed', billingWeek: '2026-W32' },
    error: null,
  });
});

test('billing repository maps RPC errors without a client dependency', async () => {
  const repository = createBillingRepository({
    rpc: async () => ({ data: null, error: { code: 'PGRST500', message: 'rpc failed', details: 'internal' } }),
  } as any);

  assert.deepEqual(await repository.generateWeeklyBilling('2026-08-10'), {
    data: null,
    error: { code: 'PGRST500', message: 'rpc failed', details: 'internal' },
  });
});
