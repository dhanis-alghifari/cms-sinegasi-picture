import assert from 'node:assert/strict';
import test from 'node:test';
import { backgroundJobsEnabled, createBackgroundJobs } from './backgroundJobs.js';

test('production schedulers default disabled and invalid configuration fails closed', () => {
  assert.equal(backgroundJobsEnabled(undefined, true), false);
  assert.equal(backgroundJobsEnabled(undefined, false), true);
  assert.equal(backgroundJobsEnabled('false', false), false);
  assert.equal(backgroundJobsEnabled('true', true), true);
  assert.throws(() => backgroundJobsEnabled('yes', true));
});
test('disabled lifecycle never starts billing/overdue work even after repeated starts', () => {
  let started = 0;
  const jobs = createBackgroundJobs(false, () => { started += 1; return () => {}; });
  jobs.start(); jobs.start(); jobs.stop();
  assert.equal(started, 0);
});
test('enabled process starts once and stops once; fresh restart permitted', () => {
  let started = 0;
  let stopped = 0;
  const jobs = createBackgroundJobs(true, () => { started += 1; return () => { stopped += 1; }; });
  jobs.start(); jobs.start(); jobs.stop(); jobs.stop(); jobs.start(); jobs.stop();
  assert.equal(started, 2);
  assert.equal(stopped, 2);
});
