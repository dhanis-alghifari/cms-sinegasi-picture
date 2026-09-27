
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

export const USER_ROLE_VALUES = [
  'teacher',
  'leader',
  'vice_leader',
  'treasurer',
  'secretary',
  'equipment_team',
  'contest_team',
  'member',
] as const;

export type UserRole = typeof USER_ROLE_VALUES[number];

export const STUDENT_ROLE_VALUES = [
  'leader',
  'vice_leader',
  'secretary',
  'treasurer',
  'equipment_team',
  'contest_team',
  'member',
] as const;

export type StudentRole = typeof STUDENT_ROLE_VALUES[number];

export interface ApiError {
  message: string;
  statusCode: number;
  errors?: Record<string, string[]>;
}

/** Additive identity projection for created/updated/approved actor fields. */
export interface ActorSummary {
  id: string;
  nama?: string;
  username?: string;
  role?: UserRole | string;
  is_active?: boolean;
}
