
import { apiClient } from '@/shared/api/client';
import { UI_CONSTANTS } from '@/shared/constants/ui';
import { ApiError } from '@/shared/api/errors';
import { compressImageFileToFile, MAX_SOURCE_IMAGE_BYTES } from '@/shared/utils/compressImage';
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

const contestScopeValues: Readonly<Record<string, string>> = {
  bekasi: 'bekasi', jabodetabek: 'jabodetabek', jawa_barat: 'west_java', nasional: 'national', umum: 'general',
};

const contestStatusValues: Readonly<Record<string, string>> = {
  buka: 'open', proses_penjurian: 'judging', selesai: 'completed',
};

const entryStatusValues: Readonly<Record<string, string>> = {
  proses_submit: 'in_progress', sudah_terkirim: 'submitted', menunggu_pengumuman: 'awaiting_announcement', selesai: 'completed',
};

const awardStatusValues: Readonly<Record<string, string>> = {
  'Juara 1': 'first_place', 'Juara 2': 'second_place', 'Juara 3': 'third_place', Harapan: 'honorable_mention', Finalis: 'finalist', Peserta: 'participant',
};

function toContestRequest(payload: CreateContestPayload | UpdateContestPayload) {
  const legacyPayload = payload as UpdateContestPayload & { penyelenggara?: string };
  const {
    nama_lomba: contest_name,
    penyelenggara: organizer,
    kota: city,
    tingkat: scope,
    tahun_event: event_year,
    deskripsi: description,
    status,
    ...rest
  } = legacyPayload;
  return {
    ...rest,
    ...(contest_name !== undefined ? { contest_name } : {}),
    ...(organizer !== undefined ? { organizer } : {}),
    ...(city !== undefined ? { city } : {}),
    ...(scope !== undefined ? { scope: contestScopeValues[scope] } : {}),
    ...(event_year !== undefined ? { event_year } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(status !== undefined ? { status: contestStatusValues[status] } : {}),
  };
}

function toFilmSubmissionRequest(payload: SubmitFilmEntryPayload) {
  const {
    judul_film: film_title,
    sutradara_id: director_id,
    link_video: video_url,
    sertifikat_url: certificate_url,
    ...rest
  } = payload;
  return {
    ...rest,
    film_title,
    director_id,
    video_url,
    award_status: awardStatusValues[payload.award_status],
    ...(certificate_url !== undefined ? { certificate_url } : {}),
  };
}

function toEntryTransitionRequest(payload: TransitionContestEntryPayload) {
  return { ...payload, status: entryStatusValues[payload.status] };
}

export const contestsService = {
  getContests(params?: ContestFilterParams): Promise<PaginatedResponse<Contest>> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.pageSize) query.append('pageSize', String(params.pageSize));
    if (params?.search) query.append('search', params.search);
    if (params?.tingkat) query.append('scope', contestScopeValues[params.tingkat]);
    if (params?.status) query.append('status', contestStatusValues[params.status]);
    if (params?.tahun_event) query.append('event_year', String(params.tahun_event));

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
    return apiClient.postParsed('/api/contests', toContestRequest(payload), decodeContestResponse);
  },

  updateContest(id: string, payload: UpdateContestPayload, changeReason: string): Promise<Contest> {
    return apiClient.putParsed(`/api/contests/${id}`, toContestRequest(payload), decodeContestResponse, {
      changeReason,
    });
  },

  submitFilmEntry(payload: SubmitFilmEntryPayload): Promise<FilmSubmission> {
    return apiClient.postParsed('/api/contests/submissions', toFilmSubmissionRequest(payload), decodeFilmSubmissionResponse);
  },

  async getContestEntries(contestId: string, params?: { page?: number; pageSize?: number; status?: string }): Promise<ContestEntriesResponse> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    if (params?.status && params.status !== UI_CONSTANTS.ALL_FILTER_VALUE) query.set('status', entryStatusValues[params.status] ?? params.status);
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
    return apiClient.postParsed(`/api/contest-entries/${entryId}/transitions`, toEntryTransitionRequest(payload), decodeContestEntryResponse, {
      changeReason: payload.change_reason,
      idempotencyKey: createIdempotencyKey(),
    });
  },

  async uploadContestEvidence(
    entryId: string,
    targetStatus: 'submitted' | 'completed',
    file: File,
  ): Promise<string> {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size < 1 || file.size > MAX_SOURCE_IMAGE_BYTES) {
      throw new ApiError('Bukti harus berupa JPG, PNG, atau WebP dengan ukuran sumber maksimal 5 MB.', 422, undefined, 'CONTEST_EVIDENCE_FILE_INVALID');
    }
    const compressedFile = await compressImageFileToFile(file);
    const reservation = await apiClient.postParsed(
      `/api/contest-entries/${entryId}/evidence-uploads`,
      {
        target_status: targetStatus,
        file_name: compressedFile.name,
        content_type: compressedFile.type,
        file_size_bytes: compressedFile.size,
      },
      decodeEvidenceReservationResponse,
      { changeReason: 'Menyiapkan unggahan bukti progres karya' },
    );
    const uploadResponse = await fetch(reservation.upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': compressedFile.type },
      body: compressedFile,
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
    if (params?.tahun_event) query.set('event_year', String(params.tahun_event));
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
