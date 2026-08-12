// src/features/contests/types/contests.types.ts
// Film Contests & Achievements domain types according to PRD schema
import type { ActorSummary } from '@/shared/types/common';

export type ContestLevel = 'Lokal' | 'Regional' | 'Nasional' | 'Internasional';
export type ContestStatus = 'buka' | 'proses_penjurian' | 'selesai';
export type AwardStatus = 'Juara 1' | 'Juara 2' | 'Juara 3' | 'Harapan' | 'Finalis' | 'Peserta';

export interface FilmSubmission {
  id: string;
  contest_id: string;
  judul_film: string;
  sutradara_id: string;
  sutradara_nama: string;
  crew_members?: string[];
  link_video: string;
  award_status: AwardStatus;
  sertifikat_url?: string;
  created_at: string;
  created_actor?: ActorSummary;
}

export interface Contest {
  id: string;
  nama_lomba: string;
  penyelenggara: string;
  tingkat: ContestLevel;
  deadline: string;
  status: ContestStatus;
  website_url?: string;
  deskripsi?: string;
  submissions?: FilmSubmission[];
  submission_count?: number;
  created_at: string;
  updated_at?: string;
  created_actor?: ActorSummary;
  updated_actor?: ActorSummary;
}

export interface ContestFilterParams {
  page?: number;
  pageSize?: number;
  search?: string;
  tingkat?: ContestLevel;
  status?: ContestStatus;
}

export interface ContestSummary {
  totalLomba: number;
  lombaAktif: number;
  totalKaryaSubmitted: number;
  totalPrestasiJuara: number;
}

export interface CreateContestPayload {
  nama_lomba: string;
  penyelenggara: string;
  tingkat: ContestLevel;
  deadline: string;
  status: ContestStatus;
  website_url?: string;
  deskripsi?: string;
}

export type UpdateContestPayload = Partial<CreateContestPayload>;

export interface SubmitFilmEntryPayload {
  contest_id: string;
  judul_film: string;
  sutradara_id: string;
  crew_members?: string[];
  link_video: string;
  award_status: AwardStatus;
  sertifikat_url?: string;
}
