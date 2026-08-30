// src/features/students/api/students.service.ts
// Pure TS student service

import { apiClient } from '@/shared/api/client';
import type { PaginatedResponse } from '@/shared/types/common';
import type {
  Student,
  StudentFilterParams,
  CreateStudentPayload,
  UpdateStudentPayload,
  StudentAccountResponse,
  StudentOption,
} from '../types/students.types';

export const studentsService = {
  getStudents(params?: StudentFilterParams): Promise<PaginatedResponse<Student>> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.pageSize) query.append('pageSize', String(params.pageSize));
    if (params?.search) query.append('search', params.search);
    if (params?.kelas) query.append('kelas', params.kelas);
    if (params?.peminatan) query.append('peminatan', params.peminatan);
    if (params?.is_active !== undefined) query.append('is_active', String(params.is_active));

    const endpoint = `/api/students${query.toString() ? `?${query.toString()}` : ''}`;
    return apiClient.get<PaginatedResponse<Student>>(endpoint);
  },

  getStudentById(id: string): Promise<Student> {
    return apiClient.get<Student>(`/api/students/${id}`);
  },

  getStudentOptions(params?: { search?: string; limit?: number; isActive?: boolean }): Promise<{ data: StudentOption[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.search?.trim()) query.append('q', params.search.trim());
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.isActive !== undefined) query.append('active', String(params.isActive));

    const endpoint = `/api/students/options${query.toString() ? `?${query.toString()}` : ''}`;
    return apiClient.get<{ data: StudentOption[]; total: number }>(endpoint);
  },

  createStudent(payload: CreateStudentPayload): Promise<StudentAccountResponse> {
    return apiClient.post<StudentAccountResponse>('/api/students', payload, {
      changeReason: payload.change_reason || 'Menambahkan siswa dan membuat akun anggota',
    });
  },

  provisionStudentAccount(id: string, changeReason: string): Promise<StudentAccountResponse> {
    return apiClient.post<StudentAccountResponse>(`/api/students/${id}/provision-account`, {}, {
      changeReason,
    });
  },

  updateStudent(
    id: string,
    payload: UpdateStudentPayload,
    changeReason: string,
  ): Promise<Student> {
    return apiClient.put<Student>(`/api/students/${id}`, payload, {
      changeReason,
    });
  },

  deleteStudent(id: string, changeReason: string): Promise<void> {
    return apiClient.delete<void>(`/api/students/${id}`, {
      changeReason,
    });
  },
};
