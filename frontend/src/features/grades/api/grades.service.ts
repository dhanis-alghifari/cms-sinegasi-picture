
import { apiClient } from '@/shared/api/client';
import type { PaginatedResponse } from '@/shared/types/common';
import {
  decodeAssignment,
  decodeAssignmentList,
  decodeBulkGrade,
  decodeGradeList,
  decodeGradeSummary,
} from './grades.responses';
import type {
  StudentGrade,
  Assignment,
  GradeFilterParams,
  BulkGradingPayload,
  CreateAssignmentPayload,
  AssignmentFilterParams,
  GradeSummary,
} from '../types/grades.types';

function toAssignmentRequest(payload: CreateAssignmentPayload) {
  const { kelas: class_name, ...rest } = payload;
  return { ...rest, ...(class_name !== undefined ? { class_name } : {}) };
}

function toBulkGradeRequest(payload: BulkGradingPayload) {
  return {
    ...payload,
    grades: payload.grades.map(({ nilai: grade, keterangan: notes, ...item }) => ({
      ...item,
      grade,
      ...(notes !== undefined ? { notes } : {}),
    })),
  };
}

export const gradesService = {
  getGrades(params?: GradeFilterParams): Promise<PaginatedResponse<StudentGrade>> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.pageSize) query.append('pageSize', String(params.pageSize));
    if (params?.assignment_id) query.append('assignment_id', params.assignment_id);
    if (params?.category) query.append('category', params.category);
    if (params?.kelas) query.append('class_name', params.kelas);
    if (params?.search) query.append('search', params.search);
    if (params?.scope) query.append('scope', params.scope);

    const endpoint = `/api/grades${query.toString() ? `?${query.toString()}` : ''}`;
    return apiClient.getParsed(endpoint, decodeGradeList);
  },

  async getAssignments(params?: AssignmentFilterParams): Promise<PaginatedResponse<Assignment>> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.pageSize) query.append('pageSize', String(params.pageSize));
    if (params?.category) query.append('category', params.category);
    if (params?.kelas) query.append('class_name', params.kelas);
    if (params?.search) query.append('search', params.search);
    if (params?.scope) query.append('scope', params.scope);

    const endpoint = `/api/grades/assignments${query.toString() ? `?${query.toString()}` : ''}`;
    return apiClient.getParsed(endpoint, decodeAssignmentList);
  },

  async getSummary(params?: Pick<GradeFilterParams, 'scope' | 'category'>): Promise<GradeSummary> {
    const query = new URLSearchParams();
    if (params?.scope) query.append('scope', params.scope);
    if (params?.category) query.append('category', params.category);
    const endpoint = `/api/grades/summary${query.toString() ? `?${query.toString()}` : ''}`;
    return apiClient.getParsed(endpoint, decodeGradeSummary);
  },

  async createAssignment(payload: CreateAssignmentPayload): Promise<Assignment> {
    return apiClient.postParsed('/api/grades/assignments', toAssignmentRequest(payload), decodeAssignment);
  },

  // Bulk Grading Entry (Teacher Only)
  bulkGrade(payload: BulkGradingPayload, changeReason: string): Promise<void> {
    return apiClient.postParsed('/api/grades/bulk', toBulkGradeRequest(payload), decodeBulkGrade, { changeReason });
  },
};
