import assert from 'node:assert/strict';
import test from 'node:test';

import { getDisputeAction, getDisputeStatus } from '../src/features/cash/utils/disputeState';

test('dispute status is read from the row target only', () => {
  assert.equal(getDisputeStatus(undefined), undefined);
  assert.equal(getDisputeStatus({ id: 'dispute-1', status: 'pending' }), 'pending');
});

test('a different target remains submittable while another target is pending', () => {
  const action = getDisputeAction({
    quota: { period: '2026-09', period_start: '2026-09-01', limit: 2, used: 1, remaining: 1, resets_at: '2026-10-01T00:00:00.000Z' },
  });

  assert.equal(action.canSubmit, true);
  assert.equal(action.label, 'Sanggah kas');
});

test('matching pending target shows the review status', () => {
  const action = getDisputeAction({
    dispute: { id: 'dispute-1', status: 'pending' },
  });

  assert.equal(action.canSubmit, false);
  assert.equal(action.label, 'Menunggu pemeriksaan');
});

test('rejected target can be submitted again while quota remains', () => {
  const action = getDisputeAction({
    dispute: { id: 'dispute-1', status: 'rejected' },
    quota: { period: '2026-09', period_start: '2026-09-01', limit: 2, used: 1, remaining: 1, resets_at: '2026-10-01T00:00:00.000Z' },
  });

  assert.equal(action.canSubmit, true);
  assert.equal(action.label, 'Ajukan ulang');
});
