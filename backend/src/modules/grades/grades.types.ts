import type { ActorSummary } from '../../shared/actors/actors.types.js';

export type GradeLetter = 'A' | 'B' | 'C' | 'D' | 'E';
export type AssignmentCategory = 'class_task' | 'crew_film' | 'event_participation' | 'other';
export type GradesReadScope = 'own' | 'operational';

export type GradeListQuery = { assignment_id?: string; category?: string; kelas?: string; search?: string; student_id?: string; scope?: GradesReadScope; page?: string; pageSize?: string };
export type AssignmentListQuery = { category?: string; kelas?: string; search?: string; student_id?: string; scope?: GradesReadScope; page?: string; pageSize?: string };

export type GradeSummary = {
  total: number;
  counts: Record<GradeLetter, number>;
  latest?: GradeRecord;
};

export type GradeRecord = {
  id: string; assignment_id: string; assignment_title?: string; assignment_category?: AssignmentCategory;
  student_id: string; student_nis?: string; student_nama?: string; kelas?: string; nilai: GradeLetter;
  keterangan?: string; graded_by: string; created_by?: string; updated_by?: string; created_at: string; updated_at?: string;
  graded_actor?: ActorSummary; created_actor?: ActorSummary; updated_actor?: ActorSummary;
};

export type AssignmentRecord = {
  id: string; title: string; category: AssignmentCategory; description?: string; kelas?: string;
  date: string; created_by?: string; updated_by?: string; updated_at?: string; created_at: string;
  created_actor?: ActorSummary; updated_actor?: ActorSummary;
};

export type CreateAssignmentInput = {
  title?: string; category?: string; description?: string; kelas?: string; keterangan_kategori?: string; date?: string; due_date?: string; change_reason?: string;
};

export type BulkGradeItem = { student_id: string; nilai: string; keterangan?: string };
export type BulkGradeInput = { assignment_id?: string; grades?: BulkGradeItem[]; change_reason?: string };

export type GradeDistribution = {
  assignmentId: string; assignmentTitle: string; category: AssignmentCategory; dueDate: string; kelas: string;
  distribution: Record<GradeLetter, number>; totalGraded: number; percentageA: number;
};

export type StudentGradeSummary = {
  studentId: string; nama: string; kelas: string; peminatan: string; predikatA: number; predikatB: number;
  predikatC: number; predikatDominan: GradeLetter;
};
