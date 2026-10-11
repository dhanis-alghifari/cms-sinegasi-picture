import type { ActorSummary } from '@/shared/types/common';

export const GRADE_LETTER_VALUES = ['A', 'B', 'C', 'D', 'E'] as const;
export type GradeLetter = typeof GRADE_LETTER_VALUES[number];
export const ASSIGNMENT_CATEGORY_VALUES = ['class_task', 'crew_film', 'event_participation', 'other'] as const;
export type AssignmentCategory = typeof ASSIGNMENT_CATEGORY_VALUES[number];
export type GradesReadScope = 'own' | 'operational';
export const REPORT_SEMESTER_VALUES = ['ganjil', 'genap'] as const;
export type ReportSemester = typeof REPORT_SEMESTER_VALUES[number];
export type ReportPeriodStatus = 'draft' | 'review' | 'approved';
export type ReportStatus = 'draft' | 'approved';

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
  scope?: GradesReadScope;
}

export interface AssignmentFilterParams {
  page?: number;
  pageSize?: number;
  category?: AssignmentCategory;
  kelas?: string;
  search?: string;
  scope?: GradesReadScope;
}

export interface GradeSummary {
  total: number;
  counts: Record<GradeLetter, number>;
  latest?: StudentGrade;
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

export interface GradeReportPeriod {
  id: string;
  academic_year: string;
  semester: ReportSemester;
  start_date: string;
  end_date: string;
  status: ReportPeriodStatus;
  created_at: string;
  updated_at: string;
}

export interface GradeReport {
  id: string;
  period_id: string;
  student_id: string;
  predikat?: GradeLetter;
  status: ReportStatus;
  deskripsi: string;
  evidence_count: number;
  hadir_count: number;
  sakit_count: number;
  izin_count: number;
  alpha_count: number;
  pkl_days: number;
  attendance_percentage?: number;
  generated_at: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
  student_nis?: string;
  student_nama?: string;
  kelas?: string;
}

export interface CreateReportPeriodPayload {
  academic_year: string;
  semester: ReportSemester;
  start_date: string;
  end_date: string;
}

export type PklPeriodStatus = 'pending' | 'approved' | 'rejected' | 'completed';

export interface StudentPklPeriod {
  id: string;
  student_id: string;
  start_date: string;
  end_date: string;
  institution: string;
  notes?: string;
  status: PklPeriodStatus;
  created_at: string;
  updated_at: string;
  student_nis?: string;
  student_nama?: string;
  kelas?: string;
}

export interface CreatePklPeriodPayload {
  student_id: string;
  start_date: string;
  end_date: string;
  institution: string;
  notes?: string;
}
