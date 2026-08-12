// src/features/grades/types/grades.types.ts
// Student grades & universal grading domain types according to PRD schema
import type { ActorSummary } from '@/shared/types/common';

export type GradeLetter = 'A' | 'B' | 'C' | 'D' | 'E';
export type AssignmentCategory = 'class_task' | 'crew_film' | 'event_participation' | 'other';

export const ASSIGNMENT_CATEGORY_LABELS: Record<AssignmentCategory, string> = {
  class_task: 'Kelas',
  crew_film: 'Crew Film',
  event_participation: 'Event',
  other: 'Lainnya',
};

export interface Assignment {
  id: string;
  title: string;
  category: AssignmentCategory;
  description?: string;
  kelas?: string;
  date: string;
  created_by?: string;
  updated_by?: string;
  updated_at?: string;
  created_at: string;
  created_actor?: ActorSummary;
  updated_actor?: ActorSummary;
}

export interface StudentGrade {
  id: string;
  assignment_id: string;
  assignment_title?: string;
  assignment_category?: AssignmentCategory;
  student_id: string;
  student_nis?: string;
  student_nama?: string;
  kelas?: string;
  nilai: GradeLetter;
  keterangan?: string;
  graded_by: string;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at?: string;
  graded_actor?: ActorSummary;
  created_actor?: ActorSummary;
  updated_actor?: ActorSummary;
}

export interface GradeFilterParams {
  page?: number;
  pageSize?: number;
  assignment_id?: string;
  category?: AssignmentCategory;
  kelas?: string;
  search?: string;
  student_id?: string;
}

export interface AssignmentFilterParams {
  page?: number;
  pageSize?: number;
  category?: AssignmentCategory;
  kelas?: string;
  search?: string;
}

export interface BulkGradeItem {
  student_id: string;
  nilai: GradeLetter;
  keterangan?: string;
}

export interface BulkGradingPayload {
  assignment_id: string;
  grades: BulkGradeItem[];
}

export interface CreateAssignmentPayload {
  title: string;
  category: AssignmentCategory;
  description?: string;
  kelas?: string;
  date: string;
}
