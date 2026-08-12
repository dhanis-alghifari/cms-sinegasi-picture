// src/features/attendance/services/attendance.service.ts
// Pure TS attendance management service

import { apiClient } from '@/shared/api/client';
import type { PaginatedResponse } from '@/shared/types/common';
import type {
  AttendanceRecord,
  AttendanceSummaryMetrics,
  AttendanceFilterParams,
  RecordAttendancePayload,
  CorrectAttendancePayload,
} from '../types/attendance.types';

export const attendanceService = {
  getAttendance(params?: AttendanceFilterParams): Promise<PaginatedResponse<AttendanceRecord>> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.pageSize) query.append('pageSize', String(params.pageSize));
    if (params?.tanggal) query.append('tanggal', params.tanggal);
    if (params?.kelas) query.append('kelas', params.kelas);
    if (params?.status) query.append('status', params.status);
    if (params?.search) query.append('search', params.search);

    const endpoint = `/api/attendance${query.toString() ? `?${query.toString()}` : ''}`;
    return apiClient.get<PaginatedResponse<AttendanceRecord>>(endpoint);
  },

  getSummary(tanggal?: string): Promise<AttendanceSummaryMetrics> {
    const endpoint = `/api/attendance/summary${tanggal ? `?tanggal=${tanggal}` : ''}`;
    return apiClient.get<AttendanceSummaryMetrics>(endpoint);
  },

  recordAttendance(payload: RecordAttendancePayload): Promise<void> {
    return apiClient.post<void>('/api/attendance', payload);
  },

  // Teacher Correction for 48h Locked Records
  correctAttendance(payload: CorrectAttendancePayload, changeReason: string): Promise<AttendanceRecord> {
    return apiClient.patch<AttendanceRecord>(`/api/attendance/${payload.attendance_id}/correct`, payload, {
      changeReason,
    });
  },
};
