import type { DashboardMemoryState } from './dashboard.types.js';

export function createDashboardMemoryState(): DashboardMemoryState {
  return { summaries: new Map() };
}

export function normalizeDashboardStudentId(value: unknown): string {
  if (typeof value !== 'string') return '';
  const studentId = value.trim();
  if (studentId.length === 0 || studentId.length > 128 || /[\u0000-\u001f\u007f]/.test(studentId)) return '';
  return studentId;
}
