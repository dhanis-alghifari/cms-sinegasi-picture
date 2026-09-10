// src/features/attendance/api/attendance.service.ts
// Pure TS attendance management service

import { apiClient } from '@/shared/api/client';
import {
  decodeAttendanceBatch,
  decodeAttendanceList,
  decodeAttendanceRecord,
  decodeAttendanceRoster,
  decodeAttendanceSummary,
} from './attendance.responses';
import type { PaginatedResponse } from '@/shared/types/common';
import type {
  AttendanceBatchResponse,
  AttendanceRecord,
  AttendanceRosterParams,
  AttendanceRosterRecord,
  AttendanceSummaryMetrics,
  AttendanceSummaryParams,
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
    if (params?.date_from) query.append('date_from', params.date_from);
    if (params?.date_to) query.append('date_to', params.date_to);
    if (params?.student_id) query.append('student_id', params.student_id);
    if (params?.kelas) query.append('kelas', params.kelas);
    if (params?.status) query.append('status', params.status);
    if (params?.search) query.append('search', params.search);
    if (params?.scope) query.append('scope', params.scope);

    const endpoint = `/api/attendance${query.toString() ? `?${query.toString()}` : ''}`;
    return apiClient.getParsed(endpoint, decodeAttendanceList);
  },

  async getAllAttendance(params: Omit<AttendanceFilterParams, 'page' | 'pageSize'>): Promise<AttendanceRecord[]> {
    const pageSize = 100;
    const records: AttendanceRecord[] = [];
    let page = 1;

    while (true) {
      const response = await this.getAttendance({ ...params, page, pageSize });
      records.push(...response.data);
      if (page >= response.totalPages || response.data.length === 0) break;
      page += 1;
    }

    return records;
  },

  async getSummary(params?: AttendanceSummaryParams): Promise<AttendanceSummaryMetrics> {
    const query = new URLSearchParams();
    if (params?.tanggal) query.set('tanggal', params.tanggal);
    if (params?.date_from) query.set('date_from', params.date_from);
    if (params?.date_to) query.set('date_to', params.date_to);
    if (params?.student_id) query.set('student_id', params.student_id);
    if (params?.scope) query.set('scope', params.scope);
    const endpoint = `/api/attendance/summary${query.toString() ? `?${query.toString()}` : ''}`;
    return apiClient.getParsed(endpoint, decodeAttendanceSummary);
  },

  getRoster(params: AttendanceRosterParams): Promise<PaginatedResponse<AttendanceRosterRecord>> {
    const query = new URLSearchParams({ tanggal: params.tanggal, kelas: params.kelas });
    if (params.page) query.set('page', String(params.page));
    if (params.pageSize) query.set('pageSize', String(params.pageSize));
    return apiClient.getParsed(`/api/attendance/roster?${query.toString()}`, decodeAttendanceRoster);
  },

  recordAttendance(payload: RecordAttendancePayload): Promise<AttendanceBatchResponse> {
    return apiClient.postParsed('/api/attendance/batch', payload, decodeAttendanceBatch);
  },

  // Teacher Correction for 48h Locked Records
  correctAttendance(payload: CorrectAttendancePayload, changeReason: string): Promise<AttendanceRecord> {
    const { attendance_id: attendanceId, ...body } = payload;
    return apiClient.patchParsed(`/api/attendance/${attendanceId}/correct`, body, decodeAttendanceRecord, {
      changeReason,
    });
  },
};
