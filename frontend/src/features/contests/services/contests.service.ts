// src/features/contests/services/contests.service.ts
// Pure TS film contests & achievements service

import { apiClient } from '@/shared/api/client';
import { ApiError } from '@/shared/api/errors';
import type { PaginatedResponse } from '@/shared/types/common';
import type {
  Contest,
  ContestSummary,
  ContestFilterParams,
  CreateContestPayload,
  UpdateContestPayload,
  SubmitFilmEntryPayload,
  FilmSubmission,
  ContestEntriesResponse,
  CreateContestEntryPayload,
  ContestEntry,
  TransitionContestEntryPayload,
  WorkTypeCode,
  ContestAchievementsParams,
  ContestAchievementsResponse,
  ContestEntryResult,
  RecordContestResultPayload,
  ContestEvidenceUploadReservation,
  FinalizeContestEntryPayload,
  FinalizeContestEntryResponse,
} from '../types/contests.types';

function unwrapData<T>(response: T | { data: T }): T {
  return response && typeof response === 'object' && 'data' in response
    ? (response as { data: T }).data
    : response as T;
}

function createIdempotencyKey(): string {
  const randomUuid = globalThis.crypto?.randomUUID;
  return randomUuid ? randomUuid.call(globalThis.crypto) : `contest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const contestsService = {
  getContests(params?: ContestFilterParams): Promise<PaginatedResponse<Contest>> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.pageSize) query.append('pageSize', String(params.pageSize));
    if (params?.search) query.append('search', params.search);
    if (params?.tingkat) query.append('tingkat', params.tingkat);
    if (params?.status) query.append('status', params.status);
    if (params?.tahun_event) query.append('tahun_event', String(params.tahun_event));

    const endpoint = `/api/contests${query.toString() ? `?${query.toString()}` : ''}`;
    return apiClient.get<PaginatedResponse<Contest>>(endpoint);
  },

  getSummary(): Promise<ContestSummary> {
    return apiClient.get<ContestSummary>('/api/contests/summary');
  },

  async getContestWorkTypes(): Promise<Array<{ code: WorkTypeCode; label: string; sort_order?: number }>> {
    const response = await apiClient.get<{ success?: boolean; data: Array<{ code: WorkTypeCode; label: string; sort_order?: number }> }>('/api/contest-work-types');
    return unwrapData(response);
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

  async getContestEntries(contestId: string, params?: { page?: number; pageSize?: number; status?: string }): Promise<ContestEntriesResponse> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    if (params?.status && params.status !== 'all') query.set('status', params.status);
    const response = await apiClient.get<{ success?: boolean } & ContestEntriesResponse>(`/api/contests/${contestId}/entries${query.toString() ? `?${query.toString()}` : ''}`);
    return response;
  },

  async createContestEntry(contestId: string, payload: CreateContestEntryPayload): Promise<ContestEntry> {
    const response = await apiClient.post<{ success: boolean; data: ContestEntry }>(`/api/contests/${contestId}/entries`, payload, {
      changeReason: 'Mendaftarkan karya ke event',
      idempotencyKey: createIdempotencyKey(),
    });
    return unwrapData(response);
  },

  async transitionContestEntry(entryId: string, payload: TransitionContestEntryPayload): Promise<ContestEntry> {
    const response = await apiClient.post<{ success: boolean; data: ContestEntry }>(`/api/contest-entries/${entryId}/transitions`, payload, {
      changeReason: payload.change_reason,
      idempotencyKey: createIdempotencyKey(),
    });
    return unwrapData(response);
  },

  async uploadContestEvidence(
    entryId: string,
    targetStatus: 'sudah_terkirim' | 'selesai',
    file: File,
  ): Promise<string> {
    const reservationResponse = await apiClient.post<{ success: boolean; data: ContestEvidenceUploadReservation }>(
      `/api/contest-entries/${entryId}/evidence-uploads`,
      {
        target_status: targetStatus,
        file_name: file.name,
        content_type: file.type,
        file_size_bytes: file.size,
      },
      { changeReason: 'Menyiapkan unggahan bukti progres karya' },
    );
    const reservation = unwrapData(reservationResponse);
    const uploadResponse = await fetch(reservation.upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    if (!uploadResponse.ok) {
      throw new ApiError('Unggahan bukti gagal. Silakan pilih file dan coba lagi.', 502, undefined, 'CONTEST_EVIDENCE_UPLOAD_FAILED');
    }
    return reservation.evidence_id;
  },

  async finalizeContestEntry(entryId: string, payload: FinalizeContestEntryPayload): Promise<FinalizeContestEntryResponse> {
    const response = await apiClient.post<{ success: boolean; data: FinalizeContestEntryResponse }>(
      `/api/contest-entries/${entryId}/finalize`,
      payload,
      {
        changeReason: payload.change_reason,
        idempotencyKey: createIdempotencyKey(),
      },
    );
    return unwrapData(response);
  },

  async getContestAchievements(params?: ContestAchievementsParams): Promise<ContestAchievementsResponse> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.result_kind) query.set('result_kind', params.result_kind);
    if (params?.position) query.set('position', String(params.position));
    if (params?.outcome_status) query.set('outcome_status', params.outcome_status);
    if (params?.tahun_event) query.set('tahun_event', String(params.tahun_event));
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    const endpoint = `/api/contest-achievements${query.toString() ? `?${query.toString()}` : ''}`;
    return apiClient.get<ContestAchievementsResponse>(endpoint);
  },

  async recordContestResult(entryId: string, payload: RecordContestResultPayload): Promise<ContestEntryResult | Record<string, unknown>> {
    const response = await apiClient.post<{ success: boolean; data: ContestEntryResult | Record<string, unknown> }>(`/api/contest-entries/${entryId}/results`, payload, {
      changeReason: payload.change_reason,
      idempotencyKey: createIdempotencyKey(),
    });
    return unwrapData(response);
  },
};
