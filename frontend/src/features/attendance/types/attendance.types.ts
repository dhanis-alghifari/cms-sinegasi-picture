import type { ActorSummary } from '@/shared/types/common';

export const ATTENDANCE_STATUS_VALUES = ['hadir', 'sakit', 'izin', 'alpha'] as const;
export type AttendanceStatus = typeof ATTENDANCE_STATUS_VALUES[number];

export interface AttendanceRecord {
  id: string;
  student_id: string;
  student_nis: string;
  student_nama: string;
  kelas: string;
  tanggal: string;
  status: AttendanceStatus;
  keterangan?: string;
  is_locked: boolean; // Auto-locked if created_at > 48h
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at?: string;
  recorded_actor?: ActorSummary;
  created_actor?: ActorSummary;
  updated_actor?: ActorSummary;
}

export interface AttendanceSummaryMetrics {
  hadir: number;
  sakit: number;
  izin: number;
  alpha: number;
  totalSiswa: number;
  persentaseHadir: number;
}

export interface AttendanceFilterParams {
  page?: number;
  pageSize?: number;
  tanggal?: string;
  date_from?: string;
  date_to?: string;
  student_id?: string;
  kelas?: string;
  status?: AttendanceStatus;
  search?: string;
  scope?: 'own';
}

export interface AttendanceSummaryParams {
  tanggal?: string;
  date_from?: string;
  date_to?: string;
  student_id?: string;
  kelas?: string;
  status?: AttendanceStatus;
  search?: string;
  scope?: 'own';
}

export type AttendanceReportPreset = 'this_month' | 'semester' | 'last_30_days' | 'last_90_days' | 'all_time' | 'custom';

export interface RecordAttendanceItem {
  student_id: string;
  status: AttendanceStatus;
  keterangan?: string;
}

export interface RecordAttendancePayload {
  tanggal: string;
  kelas: string;
  records: RecordAttendanceItem[];
}

export interface AttendanceBatchRecord {
  id: string;
  student_id: string;
  tanggal: string;
  status: AttendanceStatus;
  keterangan?: string;
  is_locked: boolean;
  idempotency_key: string;
  created_by?: string;
  created_at: string;
  updated_by?: string;
  updated_at?: string;
}

export interface AttendanceBatchResponse {
  data: AttendanceBatchRecord[];
  total: number;
}

export interface AttendanceRosterRecord {
  student_id: string;
  nis: string;
  nama: string;
  kelas: string;
  status?: AttendanceStatus;
  keterangan?: string;
}

export interface AttendanceRosterParams {
  tanggal: string;
  kelas: string;
  page?: number;
  pageSize?: number;
}

export interface CorrectAttendancePayload {
  attendance_id: string;
  status: AttendanceStatus;
  keterangan?: string;
}
