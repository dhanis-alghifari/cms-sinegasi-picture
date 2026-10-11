/**
 * Authentication contracts shared by the HTTP policy layer and feature
 * modules. Keeping these types below `middleware/` prevents the identity
 * adapter from depending on request guards and avoids a circular module seam.
 */
export const USER_ROLE_VALUES = [
  'teacher',
  'leader',
  'vice_leader',
  'treasurer',
  'secretary',
  'equipment_team',
  'contest_team',
  'social_media_team',
  'member',
] as const;

export const OPERATIONAL_USER_ROLE_VALUES = ['teacher', 'treasurer'] as const;

export const STUDENT_ACCOUNT_ROLE_VALUES = [
  'leader',
  'vice_leader',
  'secretary',
  'treasurer',
  'equipment_team',
  'contest_team',
  'social_media_team',
  'member',
] as const;

export type UserRole = typeof USER_ROLE_VALUES[number];

export interface JwtPayload {
  userId: string;
  username: string;
  role: UserRole;
  studentId?: string;
  isFirstLogin: boolean;
  authVersion?: number;
  nama?: string;
  isActive?: boolean;
  /** Recomputed from the authoritative role on every authenticated request. */
  capabilities?: string[];
  iat?: number;
  exp?: number;
}
