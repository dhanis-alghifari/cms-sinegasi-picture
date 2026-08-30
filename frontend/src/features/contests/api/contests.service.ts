// src/features/contests/api/contests.service.ts
// Pure TS film contests & achievements service

import { apiClient } from '@/shared/api/client';
import { ApiError } from '@/shared/api/errors';
import type { PaginatedResponse } from '@/shared/types/common';
import {
  decodeContestAchievementsResponse,
  decodeContestEntriesResponse,
  decodeContestEntryResponse,
  decodeContestListResponse,
  decodeContestResponse,
  decodeContestSummary,
  decodeContestWorkTypes,
  decodeEvidenceReservationResponse,
  decodeFilmSubmissionResponse,
  decodeFinalizeContestEntryResponse,
  decodeRecordContestResultResponse,
} from './contests.responses';
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
  ContestWorkTypeOption,
  TransitionContestEntryPayload,
  ContestAchievementsParams,
  ContestAchievementsResponse,
  RecordContestResultResponse,
  RecordContestResultPayload,
  FinalizeContestEntryPayload,
  FinalizeContestEntryResponse,
} from '../types/contests.types';

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
    return apiClient.getParsed(endpoint, decodeContestListResponse);
  },

  getSummary(): Promise<ContestSummary> {
    return apiClient.getParsed('/api/contests/summary', decodeContestSummary);
  },

  async getContestWorkTypes(): Promise<ContestWorkTypeOption[]> {
    return apiClient.getParsed('/api/contest-work-types', decodeContestWorkTypes);
  },

  createContest(payload: CreateContestPayload): Promise<Contest> {
    return apiClient.postParsed('/api/contests', payload, decodeContestResponse);
  },

  updateContest(id: string, payload: UpdateContestPayload, changeReason: string): Promise<Contest> {
    return apiClient.putParsed(`/api/contests/${id}`, payload, decodeContestResponse, {
      changeReason,
    });
  },

  submitFilmEntry(payload: SubmitFilmEntryPayload): Promise<FilmSubmission> {
    return apiClient.postParsed('/api/contests/submissions', payload, decodeFilmSubmissionResponse);
  },

  async getContestEntries(contestId: string, params?: { page?: number; pageSize?: number; status?: string }): Promise<ContestEntriesResponse> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    if (params?.status && params.status !== 'all') query.set('status', params.status);
    return apiClient.getParsed(
      `/api/contests/${contestId}/entries${query.toString() ? `?${query.toString()}` : ''}`,
      decodeContestEntriesResponse,
    );
  },

  async createContestEntry(contestId: string, payload: CreateContestEntryPayload): Promise<ContestEntry> {
    return apiClient.postParsed(`/api/contests/${contestId}/entries`, payload, decodeContestEntryResponse, {
      changeReason: 'Mendaftarkan karya ke event',
      idempotencyKey: createIdempotencyKey(),
    });
  },

  async transitionContestEntry(entryId: string, payload: TransitionContestEntryPayload): Promise<ContestEntry> {
    return apiClient.postParsed(`/api/contest-entries/${entryId}/transitions`, payload, decodeContestEntryResponse, {
      changeReason: payload.change_reason,
      idempotencyKey: createIdempotencyKey(),
    });
  },

  async uploadContestEvidence(
    entryId: string,
    targetStatus: 'sudah_terkirim' | 'selesai',
    file: File,
  ): Promise<string> {
    const reservation = await apiClient.postParsed(
      `/api/contest-entries/${entryId}/evidence-uploads`,
      {
        target_status: targetStatus,
        file_name: file.name,
        content_type: file.type,
        file_size_bytes: file.size,
      },
      decodeEvidenceReservationResponse,
      { changeReason: 'Menyiapkan unggahan bukti progres karya' },
    );
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
    return apiClient.postParsed(
      `/api/contest-entries/${entryId}/finalize`,
      payload,
      decodeFinalizeContestEntryResponse,
      {
        changeReason: payload.change_reason,
        idempotencyKey: createIdempotencyKey(),
      },
    );
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
    return apiClient.getParsed(endpoint, decodeContestAchievementsResponse);
  },

  async recordContestResult(entryId: string, payload: RecordContestResultPayload): Promise<RecordContestResultResponse> {
    return apiClient.postParsed(`/api/contest-entries/${entryId}/results`, payload, decodeRecordContestResultResponse, {
      changeReason: payload.change_reason,
      idempotencyKey: createIdempotencyKey(),
    });
  },
};
