// src/features/contests/services/contests.service.ts
// Pure TS film contests & achievements service

import { apiClient } from '@/shared/api/client';
import type { PaginatedResponse } from '@/shared/types/common';
import type {
  Contest,
  ContestSummary,
  ContestFilterParams,
  CreateContestPayload,
  UpdateContestPayload,
  SubmitFilmEntryPayload,
  FilmSubmission,
} from '../types/contests.types';

export const contestsService = {
  getContests(params?: ContestFilterParams): Promise<PaginatedResponse<Contest>> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.pageSize) query.append('pageSize', String(params.pageSize));
    if (params?.search) query.append('search', params.search);
    if (params?.tingkat) query.append('tingkat', params.tingkat);
    if (params?.status) query.append('status', params.status);

    const endpoint = `/api/contests${query.toString() ? `?${query.toString()}` : ''}`;
    return apiClient.get<PaginatedResponse<Contest>>(endpoint);
  },

  getSummary(): Promise<ContestSummary> {
    return apiClient.get<ContestSummary>('/api/contests/summary');
  },

  createContest(payload: CreateContestPayload): Promise<Contest> {
    return apiClient.post<Contest>('/api/contests', payload);
  },

  updateContest(id: string, payload: UpdateContestPayload, changeReason: string): Promise<Contest> {
    return apiClient.put<Contest>(`/api/contests/${id}`, payload, {
      changeReason,
    });
  },

  submitFilmEntry(payload: SubmitFilmEntryPayload): Promise<FilmSubmission> {
    return apiClient.post<FilmSubmission>('/api/contests/submissions', payload);
  },
};
