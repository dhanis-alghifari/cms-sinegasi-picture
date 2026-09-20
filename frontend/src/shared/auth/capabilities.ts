import type { UserRole } from '@/shared/types/common';

export const CAPABILITY_VALUES = [
  'dashboard.read.operational', 'dashboard.read.own',
  'students.read', 'students.read.own', 'students.manage',
  'classes.read', 'classes.manage', 'attendance.read', 'attendance.read.own', 'attendance.record', 'attendance.correct',
  'cash.read', 'cash.read.own', 'cash.dispute.create', 'cash.dispute.read.own', 'cash.dispute.review', 'cash.manage', 'grades.read', 'grades.read.own', 'grades.manage',
  'equipment.read', 'equipment.manage', 'borrowing.read', 'borrowing.request', 'borrowing.manage', 'borrowing.return.report', 'borrowing.return.verify',
  'contests.read', 'contests.submit', 'contests.manage', 'overdue.manage', 'notifications.read',
  'audit.read', 'users.manage', 'access_control.read', 'access_control.manage',
  'agenda.read', 'agenda.write', 'agenda.archive',
] as const;

export type Capability = typeof CAPABILITY_VALUES[number];

export const ROLE_CAPABILITIES: Readonly<Record<UserRole, readonly Capability[]>> = {
  teacher: CAPABILITY_VALUES.filter((capability) => !['cash.read.own', 'cash.dispute.create', 'cash.dispute.read.own'].includes(capability)),
  leader: [
    'dashboard.read.own', 'students.read', 'students.manage', 'classes.read', 'classes.manage',
    'attendance.read', 'attendance.record', 'attendance.correct', 'equipment.read', 'equipment.manage',
    'borrowing.read', 'borrowing.request', 'borrowing.return.report', 'contests.read', 'contests.submit', 'contests.manage',
    'grades.read.own', 'notifications.read',
    'agenda.read', 'agenda.write', 'cash.read.own', 'cash.dispute.create', 'cash.dispute.read.own',
  ],
  vice_leader: [
    'dashboard.read.own', 'attendance.read', 'attendance.record', 'attendance.correct',
    'borrowing.read', 'borrowing.request', 'borrowing.return.report', 'contests.read', 'contests.submit', 'contests.manage',
    'grades.read.own', 'notifications.read', 'cash.read.own', 'cash.dispute.create', 'cash.dispute.read.own',
    'agenda.read', 'agenda.write',
  ],
  treasurer: ['dashboard.read.own', 'cash.read', 'cash.read.own', 'cash.manage', 'cash.dispute.create', 'cash.dispute.read.own', 'borrowing.read', 'borrowing.request', 'borrowing.return.report', 'grades.read.own', 'notifications.read'],
  secretary: [
    'dashboard.read.own', 'students.read', 'students.manage', 'classes.read', 'classes.manage',
    'attendance.read', 'attendance.record', 'attendance.correct', 'borrowing.read', 'borrowing.request', 'borrowing.return.report', 'grades.read.own', 'notifications.read',
    'agenda.read', 'agenda.write', 'cash.read.own', 'cash.dispute.create', 'cash.dispute.read.own',
  ],
  equipment_team: [
    'dashboard.read.own', 'equipment.read', 'equipment.manage', 'borrowing.read', 'borrowing.request', 'borrowing.return.report',
    'grades.read.own', 'notifications.read', 'cash.read.own', 'cash.dispute.create', 'cash.dispute.read.own',
  ],
  contest_team: [
    'dashboard.read.own', 'borrowing.read', 'borrowing.return.report', 'contests.read', 'contests.submit', 'contests.manage',
    'grades.read.own', 'notifications.read', 'cash.read.own', 'cash.dispute.create', 'cash.dispute.read.own',
  ],
  member: ['dashboard.read.own', 'attendance.read.own', 'cash.read.own', 'cash.dispute.create', 'cash.dispute.read.own', 'borrowing.read', 'borrowing.return.report', 'grades.read.own', 'notifications.read'],
};

export type CapabilitySubject = {
  role: UserRole;
  capabilities?: readonly Capability[];
};

export function getCapabilities(subject: CapabilitySubject | UserRole | null | undefined): readonly Capability[] {
  if (!subject) return [];
  if (typeof subject === 'string') return ROLE_CAPABILITIES[subject] ?? [];
  return subject.capabilities && subject.capabilities.length > 0
    ? subject.capabilities
    : ROLE_CAPABILITIES[subject.role] ?? [];
}

export function hasCapability(subject: CapabilitySubject | UserRole | null | undefined, capability: Capability): boolean {
  return getCapabilities(subject).includes(capability);
}

export function hasAnyCapability(subject: CapabilitySubject | UserRole | null | undefined, capabilities: readonly Capability[]): boolean {
  return capabilities.some((capability) => hasCapability(subject, capability));
}
