// src/features/grades/api/grades.service.ts
// Pure TS student grades service

import { apiClient } from '@/shared/api/client';
import type { PaginatedResponse } from '@/shared/types/common';
import type {
  StudentGrade,
  Assignment,
  GradeFilterParams,
  BulkGradingPayload,
  CreateAssignmentPayload,
  AssignmentFilterParams,
  GradeSummary,
} from '../types/grades.types';

interface AssignmentApiRecord {
  id: string;
  title: string;
  category: Assignment['category'];
  description?: string;
  deskripsi?: string;
  keterangan_kategori?: string;
  kelas?: string;
  date?: string;
  due_date?: string;
  created_by?: string;
  created_at: string;
}

interface AssignmentApiResponse {
  data?: AssignmentApiRecord[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
}

interface AssignmentMutationResponse {
  data?: AssignmentApiRecord;
}

function unwrapAssignments(response: AssignmentApiResponse | AssignmentApiRecord[]): AssignmentApiRecord[] {
  const records = Array.isArray(response) ? response : response.data;
  return Array.isArray(records) ? records : [];
}

function mapAssignment(record: AssignmentApiRecord): Assignment {
  return {
    id: record.id,
    title: record.title,
    category: record.category,
    description: record.description ?? record.deskripsi ?? record.keterangan_kategori,
    kelas: record.kelas,
    date: record.date ?? record.due_date ?? '',
    created_by: record.created_by,
    created_at: record.created_at,
  };
}

export const gradesService = {
  getGrades(params?: GradeFilterParams): Promise<PaginatedResponse<StudentGrade>> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.pageSize) query.append('pageSize', String(params.pageSize));
    if (params?.assignment_id) query.append('assignment_id', params.assignment_id);
    if (params?.category) query.append('category', params.category);
    if (params?.kelas) query.append('kelas', params.kelas);
    if (params?.search) query.append('search', params.search);
    if (params?.scope) query.append('scope', params.scope);

    const endpoint = `/api/grades${query.toString() ? `?${query.toString()}` : ''}`;
    return apiClient.get<PaginatedResponse<StudentGrade>>(endpoint);
  },

  async getAssignments(params?: AssignmentFilterParams): Promise<PaginatedResponse<Assignment>> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.pageSize) query.append('pageSize', String(params.pageSize));
    if (params?.category) query.append('category', params.category);
    if (params?.kelas) query.append('kelas', params.kelas);
    if (params?.search) query.append('search', params.search);
    if (params?.scope) query.append('scope', params.scope);

    const endpoint = `/api/grades/assignments${query.toString() ? `?${query.toString()}` : ''}`;
    const response = await apiClient.get<AssignmentApiResponse | AssignmentApiRecord[]>(endpoint);
    const records = unwrapAssignments(response);
    if (Array.isArray(response)) {
      return {
        data: records.map(mapAssignment),
        total: records.length,
        page: params?.page ?? 1,
        pageSize: params?.pageSize ?? records.length,
        totalPages: 1,
      };
    }
    return {
      data: records.map(mapAssignment),
      total: response.total ?? records.length,
      page: response.page ?? params?.page ?? 1,
      pageSize: response.pageSize ?? params?.pageSize ?? records.length,
      totalPages: response.totalPages ?? 1,
    };
  },

  async getSummary(params?: Pick<GradeFilterParams, 'scope' | 'category'>): Promise<GradeSummary> {
    const query = new URLSearchParams();
    if (params?.scope) query.append('scope', params.scope);
    if (params?.category) query.append('category', params.category);
    const endpoint = `/api/grades/summary${query.toString() ? `?${query.toString()}` : ''}`;
    const response = await apiClient.get<{ data?: GradeSummary }>(endpoint);
    return response.data ?? { total: 0, counts: { A: 0, B: 0, C: 0, D: 0, E: 0 } };
  },

  async createAssignment(payload: CreateAssignmentPayload): Promise<Assignment> {
    const response = await apiClient.post<AssignmentMutationResponse>('/api/grades/assignments', payload);
    if (!response.data) throw new Error('Server tidak mengembalikan data tugas yang dibuat.');
    return mapAssignment(response.data);
  },

  // Bulk Grading Entry (Teacher Only)
  bulkGrade(payload: BulkGradingPayload, changeReason: string): Promise<void> {
    return apiClient.post<void>('/api/grades/bulk', payload, { changeReason });
  },
};
