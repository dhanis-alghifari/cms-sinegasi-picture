import type { FastifyReply, FastifyRequest } from 'fastify';
import type { JwtPayload, UserRole } from '../shared/auth/auth.types.js';

/**
 * Capability names are the backend authorization contract. Routes should
 * depend on these names, never on UI labels or role strings.
 */
export const CAPABILITY_VALUES = [
  'dashboard.read.operational',
  'dashboard.read.own',
  'students.read',
  'students.read.own',
  'students.manage',
  'classes.read',
  'classes.manage',
  'attendance.read',
  'attendance.read.own',
  'attendance.record',
  'attendance.correct',
  'cash.read',
  'cash.read.own',
  'cash.dispute.create',
  'cash.dispute.read.own',
  'cash.dispute.review',
  'cash.manage',
  'grades.read',
  'grades.read.own',
  'grades.manage',
  'equipment.read',
  'equipment.manage',
  'borrowing.read',
  'borrowing.request',
  'borrowing.manage',
  'borrowing.return.report',
  'borrowing.return.verify',
  'contests.read',
  'contests.submit',
  'contests.manage',
  'overdue.manage',
  'notifications.read',
  'audit.read',
  'users.manage',
  'access_control.read',
  'access_control.manage',
  'agenda.read',
  'agenda.write',
  'agenda.archive',
] as const;

export type Capability = typeof CAPABILITY_VALUES[number];

const teacherCapabilities: readonly Capability[] = [...CAPABILITY_VALUES];

/**
 * Approved least-privilege matrix. A role receives a module's read capability
 * before mutation capabilities; the API still validates ownership where
 * personal data is involved.
 */
export const ROLE_CAPABILITIES: Readonly<Record<UserRole, readonly Capability[]>> = {
  teacher: teacherCapabilities,
  leader: [
    'dashboard.read.own', 'students.read', 'students.manage', 'classes.read', 'classes.manage',
    'attendance.read', 'attendance.record', 'attendance.correct', 'equipment.read', 'equipment.manage',
    'borrowing.read', 'borrowing.request', 'borrowing.return.report', 'contests.read', 'contests.submit', 'contests.manage',
    'grades.read.own', 'notifications.read',
    'agenda.read', 'agenda.write',
  ],
  vice_leader: [
    'dashboard.read.own', 'attendance.read', 'attendance.record', 'attendance.correct',
    'borrowing.read', 'borrowing.request', 'borrowing.return.report', 'contests.read', 'contests.submit', 'contests.manage',
    'grades.read.own', 'notifications.read',
    'agenda.read', 'agenda.write',
  ],
  treasurer: [
    'dashboard.read.own', 'cash.read', 'cash.read.own', 'cash.manage', 'cash.dispute.create', 'cash.dispute.review',
    'borrowing.read', 'borrowing.request', 'borrowing.return.report', 'grades.read.own', 'notifications.read',
  ],
  secretary: [
    'dashboard.read.own', 'students.read', 'students.manage', 'classes.read', 'classes.manage',
    'attendance.read', 'attendance.record', 'attendance.correct', 'borrowing.read', 'borrowing.request', 'borrowing.return.report', 'grades.read.own', 'notifications.read',
    'agenda.read', 'agenda.write',
  ],
  equipment_team: [
    'dashboard.read.own', 'equipment.read', 'equipment.manage', 'borrowing.read', 'borrowing.request', 'borrowing.return.report',
    'grades.read.own', 'notifications.read',
  ],
  contest_team: [
    'dashboard.read.own', 'borrowing.read', 'borrowing.return.report', 'contests.read', 'contests.submit', 'contests.manage',
    'grades.read.own', 'notifications.read',
  ],
  member: [
    'dashboard.read.own', 'attendance.read.own', 'cash.read.own', 'cash.dispute.create', 'borrowing.read', 'borrowing.return.report',
    'cash.dispute.read.own', 'grades.read.own', 'notifications.read',
  ],
};

const mutableRoleCapabilities: Record<UserRole, Capability[]> = Object.fromEntries(
  Object.entries(ROLE_CAPABILITIES).map(([role, capabilities]) => [role, [...capabilities]]),
) as Record<UserRole, Capability[]>;

export function getCapabilities(role: UserRole): Capability[] {
  return [...(mutableRoleCapabilities[role] ?? [])];
}

/** Replaces the in-process policy after a persisted policy change. */
export function setRoleCapabilities(role: UserRole, capabilities: readonly Capability[]): void {
  mutableRoleCapabilities[role] = [...new Set(capabilities)];
}

export function hasCapability(role: UserRole, capability: Capability): boolean {
  return mutableRoleCapabilities[role]?.includes(capability) ?? false;
}

export function hasAnyCapability(role: UserRole, capabilities: readonly Capability[]): boolean {
  return capabilities.some((capability) => hasCapability(role, capability));
}

function forbidden(reply: FastifyReply): void {
  reply.status(403).send({
    success: false,
    error: 'FORBIDDEN',
    error_code: 'FORBIDDEN',
    message: 'Akses ditolak untuk kemampuan akun saat ini.',
    request_id: reply.request.id,
  });
}

export function requireCapability(capability: Capability) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.method === 'OPTIONS') return;
    const user = request.user as JwtPayload | undefined;
    if (!user) {
      return reply.status(401).send({
        success: false,
        error: 'UNAUTHORIZED',
        error_code: 'UNAUTHORIZED',
        message: 'Pengguna belum terautentikasi.',
        request_id: reply.request.id,
      });
    }
    if (!hasCapability(user.role, capability)) forbidden(reply);
  };
}

export function requireAnyCapability(...capabilities: Capability[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.method === 'OPTIONS') return;
    const user = request.user as JwtPayload | undefined;
    if (!user) {
      return reply.status(401).send({
        success: false,
        error: 'UNAUTHORIZED',
        error_code: 'UNAUTHORIZED',
        message: 'Pengguna belum terautentikasi.',
        request_id: reply.request.id,
      });
    }
    if (!hasAnyCapability(user.role, capabilities)) forbidden(reply);
  };
}
