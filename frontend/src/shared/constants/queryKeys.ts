// src/shared/constants/queryKeys.ts
// Central query key registry — prevents inconsistent cache keys across features

export const QUERY_KEYS = {
  // Auth
  ME: ['me'] as const,

  // Dashboard
  DASHBOARD_SUMMARY: ['dashboard', 'summary'] as const,

  // Students
  STUDENTS: ['students'] as const,
  STUDENT_OPTIONS: ['students', 'options'] as const,
  STUDENT_DETAIL: (id: string) => ['students', id] as const,

  // Users
  USERS: ['users'] as const,
  USER_DETAIL: (id: string) => ['users', id] as const,

  // Cash
  CASH_TRANSACTIONS: ['cash', 'transactions'] as const,
  CASH_BALANCE: ['cash', 'balance'] as const,
  CASH_PAYMENT_METHODS: ['cash', 'payment-methods'] as const,
  CASH_DEBT_RECORDS: ['cash', 'debts'] as const,
  CASH_DEBTS: ['cash', 'debts'] as const,
  CASH_REPORT: ['cash', 'report'] as const,
  CASH_DISPUTES: ['cash', 'disputes'] as const,
  CASH_DISPUTE_QUOTA: ['cash', 'disputes', 'quota'] as const,
  BILLING_RULES: ['cash', 'billing-rules'] as const,

  // Attendance
  ATTENDANCE: ['attendance'] as const,
  ATTENDANCE_SUMMARY: ['attendance', 'summary'] as const,

  // Classes
  CLASSES: ['classes'] as const,
  CLASS_OPTIONS: ['classes', 'options'] as const,

  // Grades
  GRADES: ['grades'] as const,
  ASSIGNMENTS: ['assignments'] as const,

  // Equipment
  EQUIPMENT: ['equipment'] as const,
  EQUIPMENT_SUMMARY: ['equipment', 'summary'] as const,
  EQUIPMENT_DETAIL: (id: string) => ['equipment', id] as const,

  // Borrowings
  BORROWINGS: ['borrowings'] as const,
  BORROWING: ['borrowings'] as const,
  BORROWING_SUMMARY: ['borrowings', 'summary'] as const,
  BORROWING_DETAIL: (id: string) => ['borrowings', id] as const,

  // Contests
  CONTESTS: ['contests'] as const,
  CONTEST_DETAIL: (id: string) => ['contests', id] as const,
  CONTEST_ENTRIES: (id: string) => ['contests', id, 'entries'] as const,
  CONTEST_WORK_TYPES: ['contests', 'work-types'] as const,
  CONTEST_ACHIEVEMENTS: ['contest-achievements'] as const,

  // Notifications
  NOTIFICATIONS: ['notifications'] as const,
  NOTIFICATION_UNREAD_COUNT: ['notifications', 'unread-count'] as const,

  // Audit trail
  AUDIT_LOGS: ['audit-logs'] as const,
  AUDIT_LOG_DETAIL: (tableName: string, recordId: string) => ['audit-logs', tableName, recordId] as const,
  AUDIT_LOG_ENTRY: (id: string) => ['audit-log-entry', id] as const,

  // Access control
  ACCESS_CONTROL_MATRIX: ['access-control', 'matrix'] as const,
  ACCESS_CONTROL_AUDIT_LOGS: ['access-control', 'audit-logs'] as const,
} as const;
