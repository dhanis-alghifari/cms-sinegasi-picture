import type { Student } from '../types/students.types';

/** Use only the linked account ID; never target the student profile ID. */
export function studentResetTarget(student: Student, canResetPassword: boolean): { id: string; username: string; nama: string } | null {
  if (!canResetPassword || !student.user_id || !student.username) return null;
  return { id: student.user_id, username: student.username, nama: student.nama };
}
