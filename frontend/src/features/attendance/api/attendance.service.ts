
import { apiClient } from '@/shared/api/client';
import { UI_CONSTANTS } from '@/shared/constants/ui';
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

type ReadRequestOptions = Pick<RequestInit, 'signal'>;

const attendanceStatusValues: Readonly<Record<string, string>> = {
  hadir: 'present', sakit: 'sick', izin: 'excused', alpha: 'absent',
};

function toAttendanceRequest(payload: RecordAttendancePayload | CorrectAttendancePayload) {
  if ('records' in payload) {
    return {
      date: payload.tanggal,
      class_name: payload.kelas,
      records: payload.records.map(({ keterangan: notes, ...record }) => ({
        ...record,
        status: attendanceStatusValues[record.status],
        ...(notes !== undefined ? { notes } : {}),
      })),
    };
  }
  const { keterangan: notes, status } = payload;
  return {
    status: attendanceStatusValues[status],
    ...(notes !== undefined ? { notes } : {}),
  };
}

export const attendanceService = {
  getAttendance(
    params?: AttendanceFilterParams,
    options: ReadRequestOptions = {},
  ): Promise<PaginatedResponse<AttendanceRecord>> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.pageSize) query.append('pageSize', String(params.pageSize));
    if (params?.tanggal) query.append('date', params.tanggal);
    if (params?.date_from) query.append('date_from', params.date_from);
    if (params?.date_to) query.append('date_to', params.date_to);
    if (params?.student_id) query.append('student_id', params.student_id);
    if (params?.kelas) query.append('class_name', params.kelas);
    if (params?.status) query.append('status', attendanceStatusValues[params.status]);
    if (params?.search) query.append('search', params.search);
    if (params?.scope) query.append('scope', params.scope);

    const endpoint = `/api/attendance${query.toString() ? `?${query.toString()}` : ''}`;
    return apiClient.getParsed(endpoint, decodeAttendanceList, options);
  },

  async getAllAttendance(
    params: Omit<AttendanceFilterParams, 'page' | 'pageSize'>,
    options: ReadRequestOptions = {},
  ): Promise<AttendanceRecord[]> {
    const pageSize = UI_CONSTANTS.ATTENDANCE_ROSTER_PAGE_SIZE;
    const records: AttendanceRecord[] = [];
    let page = 1;

    while (true) {
      const response = await this.getAttendance({ ...params, page, pageSize }, options);
      records.push(...response.data);
      if (page >= response.totalPages || response.data.length === 0) break;
      page += 1;
    }

    return records;
  },

  async getSummary(
    params?: AttendanceSummaryParams,
    options: ReadRequestOptions = {},
  ): Promise<AttendanceSummaryMetrics> {
    const query = new URLSearchParams();
    if (params?.tanggal) query.set('date', params.tanggal);
    if (params?.date_from) query.set('date_from', params.date_from);
    if (params?.date_to) query.set('date_to', params.date_to);
    if (params?.student_id) query.set('student_id', params.student_id);
    if (params?.kelas) query.set('class_name', params.kelas);
    if (params?.status) query.set('status', attendanceStatusValues[params.status]);
    if (params?.search) query.set('search', params.search);
    if (params?.scope) query.set('scope', params.scope);
    const endpoint = `/api/attendance/summary${query.toString() ? `?${query.toString()}` : ''}`;
    return apiClient.getParsed(endpoint, decodeAttendanceSummary, options);
  },

  getRoster(
    params: AttendanceRosterParams,
    options: ReadRequestOptions = {},
  ): Promise<PaginatedResponse<AttendanceRosterRecord>> {
    const query = new URLSearchParams({ date: params.tanggal, class_name: params.kelas });
    if (params.page) query.set('page', String(params.page));
    if (params.pageSize) query.set('pageSize', String(params.pageSize));
    return apiClient.getParsed(`/api/attendance/roster?${query.toString()}`, decodeAttendanceRoster, options);
  },

  recordAttendance(payload: RecordAttendancePayload): Promise<AttendanceBatchResponse> {
    return apiClient.postParsed('/api/attendance/batch', toAttendanceRequest(payload), decodeAttendanceBatch);
  },

  // Teacher Correction for 48h Locked Records
  correctAttendance(payload: CorrectAttendancePayload, changeReason: string): Promise<AttendanceRecord> {
    const { attendance_id: attendanceId } = payload;
    return apiClient.patchParsed(`/api/attendance/${attendanceId}/correct`, toAttendanceRequest(payload), decodeAttendanceRecord, {
      changeReason,
    });
  },
};
