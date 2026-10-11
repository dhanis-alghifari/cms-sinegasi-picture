import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseFreshRehearsalOptions } from './rehearseFreshProductionSchema.js';

test('reference rehearsal uses separate evidence and an explicit fee; old fresh mode is unchanged', () => {
  assert.deepEqual(parseFreshRehearsalOptions(['rehearse-fresh']), {
    referenceMode: false, amount: null, evidenceFile: 'production-reconciliation.fresh-rehearsal.json',
  });
  assert.deepEqual(parseFreshRehearsalOptions(['rehearse-reference', '--billing-amount', '5000']), {
    referenceMode: true, amount: 5000, evidenceFile: 'production-reference-data.rehearsal.json',
  });
});
test('unknown modes, missing fee, apply/URL/path flags and extra options are refused before SSH', () => {
  for (const args of [[], ['apply'], ['rehearse-fresh', '--billing-amount', '5000'],
    ['rehearse-reference'], ['rehearse-reference', '--billing-amount', '499'],
    ['rehearse-reference', '--billing-amount', '5000', '--apply'],
    ['rehearse-reference', '--database-url', 'postgres://secret'],
    ['rehearse-reference', '--evidence', '/arbitrary/file']]) {
    assert.throws(() => parseFreshRehearsalOptions(args));
  }
});
