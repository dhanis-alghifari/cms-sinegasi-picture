// src/features/attendance/types/attendance.types.ts
// Attendance domain types according to PRD schema
import type { ActorSummary } from '@/shared/types/common';

export type AttendanceStatus = 'hadir' | 'sakit' | 'izin' | 'alpha';

export interface AttendanceRecord {
  id: string;
  student_id: string;
  student_nis?: string;
  student_nama?: string;
  kelas?: string;
  tanggal: string;
  status: AttendanceStatus;
  keterangan?: string;
  is_locked: boolean; // Auto-locked if created_at > 48h
  recorded_by: string;
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
  kelas?: string;
  status?: AttendanceStatus;
  search?: string;
  scope?: 'own';
}

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
