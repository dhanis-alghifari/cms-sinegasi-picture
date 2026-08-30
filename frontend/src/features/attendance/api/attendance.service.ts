// src/features/attendance/api/attendance.service.ts
// Pure TS attendance management service

import { apiClient } from '@/shared/api/client';
import type { PaginatedResponse } from '@/shared/types/common';
import type {
  AttendanceRecord,
  AttendanceRosterParams,
  AttendanceRosterRecord,
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
    if (params?.scope) query.append('scope', params.scope);

    const endpoint = `/api/attendance${query.toString() ? `?${query.toString()}` : ''}`;
    return apiClient.get<PaginatedResponse<AttendanceRecord>>(endpoint);
  },

  async getSummary(tanggal?: string, scope?: 'own'): Promise<AttendanceSummaryMetrics> {
    const query = new URLSearchParams();
    if (tanggal) query.set('tanggal', tanggal);
    if (scope) query.set('scope', scope);
    const endpoint = `/api/attendance/summary${query.toString() ? `?${query.toString()}` : ''}`;
    const response = await apiClient.get<AttendanceSummaryMetrics & {
      total?: number;
      persentaseKehadiran?: number;
    }>(endpoint);
    return {
      ...response,
      totalSiswa: response.totalSiswa ?? response.total ?? 0,
      persentaseHadir: response.persentaseHadir ?? response.persentaseKehadiran ?? 0,
    };
  },

  getRoster(params: AttendanceRosterParams): Promise<PaginatedResponse<AttendanceRosterRecord>> {
    const query = new URLSearchParams({ tanggal: params.tanggal, kelas: params.kelas });
    if (params.page) query.set('page', String(params.page));
    if (params.pageSize) query.set('pageSize', String(params.pageSize));
    return apiClient.get<PaginatedResponse<AttendanceRosterRecord>>(`/api/attendance/roster?${query.toString()}`);
  },

  recordAttendance(payload: RecordAttendancePayload): Promise<{ data: AttendanceRecord[]; total: number }> {
    return apiClient.post<{ data: AttendanceRecord[]; total: number }>('/api/attendance/batch', payload);
  },

  // Teacher Correction for 48h Locked Records
  correctAttendance(payload: CorrectAttendancePayload, changeReason: string): Promise<AttendanceRecord> {
    return apiClient.patch<AttendanceRecord>(`/api/attendance/${payload.attendance_id}/correct`, payload, {
      changeReason,
    });
  },
};
