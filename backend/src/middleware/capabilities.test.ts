import assert from 'node:assert/strict';
import test from 'node:test';
import { hasCapability } from './capabilities.js';

test('member capability is limited to personal data and return reporting', () => {
  assert.equal(hasCapability('member', 'dashboard.read.own'), true);
  assert.equal(hasCapability('member', 'grades.read.own'), true);
  assert.equal(hasCapability('member', 'students.read.own'), false);
  assert.equal(hasCapability('member', 'students.read'), false);
  assert.equal(hasCapability('member', 'contests.submit'), false);
  assert.equal(hasCapability('member', 'attendance.record'), false);
  assert.equal(hasCapability('member', 'borrowing.read'), true);
  assert.equal(hasCapability('member', 'borrowing.return.report'), true);
  assert.equal(hasCapability('member', 'borrowing.manage'), false);
  assert.equal(hasCapability('member', 'borrowing.request'), false);
});

test('operational roles do not inherit unrelated cash privileges', () => {
  assert.equal(hasCapability('treasurer', 'cash.manage'), true);
  assert.equal(hasCapability('treasurer', 'attendance.correct'), false);
  assert.equal(hasCapability('secretary', 'students.manage'), true);
  assert.equal(hasCapability('equipment_team', 'borrowing.manage'), false);
  assert.equal(hasCapability('equipment_team', 'borrowing.request'), true);
  assert.equal(hasCapability('equipment_team', 'borrowing.return.report'), true);
});

test('borrowing request access follows the self-request role matrix', () => {
  for (const role of ['leader', 'vice_leader', 'secretary', 'treasurer', 'equipment_team'] as const) {
    assert.equal(hasCapability(role, 'borrowing.read'), true);
    assert.equal(hasCapability(role, 'borrowing.request'), true);
    assert.equal(hasCapability(role, 'borrowing.return.report'), true);
    assert.equal(hasCapability(role, 'borrowing.manage'), false);
  }
  assert.equal(hasCapability('contest_team', 'borrowing.read'), true);
  assert.equal(hasCapability('contest_team', 'borrowing.return.report'), true);
  assert.equal(hasCapability('contest_team', 'borrowing.request'), false);
  assert.equal(hasCapability('teacher', 'borrowing.request'), true);
});

test('teacher is the only role that can change access settings', () => {
  assert.equal(hasCapability('teacher', 'access_control.manage'), true);
  for (const role of ['leader', 'vice_leader', 'treasurer', 'secretary', 'equipment_team', 'contest_team', 'member'] as const) {
    assert.equal(hasCapability(role, 'access_control.manage'), false);
  }
});

test('module capabilities follow the approved role matrix', () => {
  assert.equal(hasCapability('leader', 'equipment.read'), true);
  assert.equal(hasCapability('leader', 'cash.read'), false);
  assert.equal(hasCapability('vice_leader', 'attendance.read'), true);
  assert.equal(hasCapability('vice_leader', 'students.read'), false);
  assert.equal(hasCapability('treasurer', 'cash.manage'), true);
  assert.equal(hasCapability('secretary', 'classes.read'), true);
  assert.equal(hasCapability('equipment_team', 'borrowing.manage'), false);
  assert.equal(hasCapability('contest_team', 'contests.manage'), true);
});

test('cash ledger is personal for student-backed roles and review is teacher-only', () => {
  for (const role of ['leader', 'vice_leader', 'secretary', 'treasurer', 'equipment_team', 'contest_team', 'member'] as const) {
    assert.equal(hasCapability(role, 'cash.read.own'), true);
    assert.equal(hasCapability(role, 'cash.dispute.create'), true);
    assert.equal(hasCapability(role, 'cash.dispute.read.own'), true);
  }
  assert.equal(hasCapability('teacher', 'cash.dispute.review'), true);
  assert.equal(hasCapability('teacher', 'cash.dispute.create'), false);
  assert.equal(hasCapability('treasurer', 'cash.dispute.review'), false);
});
