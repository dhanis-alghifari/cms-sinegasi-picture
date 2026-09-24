
import { apiClient } from '@/shared/api/client';
import {
  decodeStudent,
  decodeStudentAccountResponse,
  decodeStudentList,
  decodeStudentOptions,
  decodeUnlinkedStudentAccounts,
} from './students.responses';
import { decodeVoidResponse } from '@/shared/api/responseValidation';
import type { PaginatedResponse } from '@/shared/types/common';
import type {
  Student,
  StudentFilterParams,
  CreateStudentPayload,
  UpdateStudentPayload,
  StudentAccountResponse,
  StudentOption,
  LinkExistingStudentAccountPayload,
  UnlinkedStudentAccount,
} from '../types/students.types';

const specializationValues: Readonly<Record<string, string>> = {
  kamera: 'camera', editing: 'editing', naskah: 'screenwriting',
};

function toStudentRequest(payload: CreateStudentPayload | UpdateStudentPayload) {
  const {
    nis: student_number,
    nama: name,
    kelas: class_name,
    peminatan: specialization,
    no_telepon: phone_number,
    foto_url: photo_url,
    ...rest
  } = payload;
  return {
    ...rest,
    ...(student_number !== undefined ? { student_number } : {}),
    ...(name !== undefined ? { name } : {}),
    ...(class_name !== undefined ? { class_name } : {}),
    ...(specialization !== undefined ? { specialization: specializationValues[specialization] } : {}),
    ...(phone_number !== undefined ? { phone_number } : {}),
    ...(photo_url !== undefined ? { photo_url } : {}),
  };
}

export const studentsService = {
  getStudents(params?: StudentFilterParams): Promise<PaginatedResponse<Student>> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.pageSize) query.append('pageSize', String(params.pageSize));
    if (params?.search) query.append('search', params.search);
    if (params?.kelas) query.append('class_name', params.kelas);
    if (params?.peminatan) query.append('specialization', params.peminatan);
    if (params?.is_active !== undefined) query.append('is_active', String(params.is_active));

    const endpoint = `/api/students${query.toString() ? `?${query.toString()}` : ''}`;
    return apiClient.getParsed(endpoint, decodeStudentList);
  },

  getStudentById(id: string): Promise<Student> {
    return apiClient.getParsed(`/api/students/${id}`, decodeStudent);
  },

  getStudentOptions(
    params?: { search?: string; limit?: number; isActive?: boolean },
    options: Pick<RequestInit, 'signal'> = {},
  ): Promise<{ data: StudentOption[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.search?.trim()) query.append('q', params.search.trim());
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.isActive !== undefined) query.append('active', String(params.isActive));

    const endpoint = `/api/students/options${query.toString() ? `?${query.toString()}` : ''}`;
    return apiClient.getParsed(endpoint, decodeStudentOptions, options);
  },

  getUnlinkedAccounts(
    params?: { search?: string; limit?: number },
    options: Pick<RequestInit, 'signal'> = {},
  ): Promise<UnlinkedStudentAccount[]> {
    const query = new URLSearchParams();
    if (params?.search?.trim()) query.append('q', params.search.trim());
    if (params?.limit) query.append('limit', String(params.limit));
    const endpoint = `/api/students/unlinked-accounts${query.toString() ? `?${query.toString()}` : ''}`;
    return apiClient.getParsed(endpoint, decodeUnlinkedStudentAccounts, options);
  },

  createStudent(payload: CreateStudentPayload): Promise<StudentAccountResponse> {
    return apiClient.postParsed('/api/students', toStudentRequest(payload), decodeStudentAccountResponse, {
      changeReason: payload.change_reason || 'Menambahkan siswa dan membuat akun sesuai peran',
    });
  },

  linkExistingAccount(payload: LinkExistingStudentAccountPayload): Promise<StudentAccountResponse> {
    return apiClient.postParsed('/api/students/account-links', toStudentRequest(payload), decodeStudentAccountResponse, {
      changeReason: payload.change_reason || 'Menautkan akun lama ke data siswa',
    });
  },

  linkAccountToExistingProfile(studentId: string, userId: string, changeReason: string): Promise<StudentAccountResponse> {
    return apiClient.postParsed(`/api/students/${studentId}/account-links`, { user_id: userId, change_reason: changeReason }, decodeStudentAccountResponse, {
      changeReason,
    });
  },

  provisionStudentAccount(id: string, changeReason: string): Promise<StudentAccountResponse> {
    return apiClient.postParsed(`/api/students/${id}/provision-account`, {}, decodeStudentAccountResponse, {
      changeReason,
    });
  },

  updateStudent(
    id: string,
    payload: UpdateStudentPayload,
    changeReason: string,
  ): Promise<Student> {
    return apiClient.putParsed(`/api/students/${id}`, toStudentRequest(payload), decodeStudent, {
      changeReason,
    });
  },

  deleteStudent(id: string, changeReason: string): Promise<void> {
    return apiClient.deleteParsed(`/api/students/${id}`, decodeVoidResponse, {
      body: JSON.stringify({ change_reason: changeReason }),
      changeReason,
    });
  },
};
