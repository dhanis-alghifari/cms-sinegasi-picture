import type { ActorSummary } from '../../shared/actors/actors.types.js';

export type GradeLetter = 'A' | 'B' | 'C' | 'D' | 'E';
export type AssignmentCategory = 'class_task' | 'crew_film' | 'event_participation' | 'other';
export type GradesReadScope = 'own' | 'operational';
export type ReportSemester = 'ganjil' | 'genap';
export type ReportPeriodStatus = 'draft' | 'review' | 'approved';
export type ReportStatus = 'draft' | 'approved';
export type PklPeriodStatus = 'pending' | 'approved' | 'rejected' | 'completed';

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

export type GradeReportPeriod = {
  id: string;
  academic_year: string;
  semester: ReportSemester;
  start_date: string;
  end_date: string;
  status: ReportPeriodStatus;
  created_by?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
};

export type StudentPklPeriod = {
  id: string;
  student_id: string;
  start_date: string;
  end_date: string;
  institution: string;
  notes?: string;
  status: PklPeriodStatus;
  requested_by?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
  student_nis?: string;
  student_nama?: string;
  kelas?: string;
};

export type GradeReport = {
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
  approved_by?: string;
  approved_at?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
  student_nis?: string;
  student_nama?: string;
  kelas?: string;
};

export type GradeReportQuery = {
  period_id?: string;
  student_id?: string;
  kelas?: string;
  scope?: GradesReadScope;
};

export type CreateReportPeriodInput = {
  academicYear: string;
  semester: ReportSemester;
  startDate: string;
  endDate: string;
  actorId: string;
};

export type CreatePklPeriodInput = {
  studentId: string;
  startDate: string;
  endDate: string;
  institution: string;
  notes?: string;
  actorId: string;
};

export type ReviewPklPeriodInput = {
  id: string;
  status: Extract<PklPeriodStatus, 'approved' | 'rejected' | 'completed'>;
  actorId: string;
};
