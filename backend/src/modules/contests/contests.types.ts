import type { ActorSummary } from '../../shared/actors/actors.types.js';

export type ContestStatus = 'progres' | 'selesai' | string;

export type ContestPublicStatus = 'buka' | 'proses_penjurian' | 'selesai' | string;

export type ContestScope = 'bekasi' | 'jabodetabek' | 'jawa_barat' | 'nasional' | 'umum';

export interface ContestRecord {
  id: string;
  nama: string;
  jenis: string;
  level: string;
  tanggal: string;
  status: ContestStatus;
  status_public?: ContestPublicStatus | null;
  hasil: string | null;
  nama_lomba?: string;
  penyelenggara?: string;
  kota?: string | null;
  tingkat?: string;
  deadline?: string;
  tahun_event?: number | null;
  website_url?: string | null;
  deskripsi?: string | null;
  planned_work_count?: number | null;
  academic_year?: string | null;
  submissions?: ContestSubmissionRecord[];
  submission_count?: number;
  entry_count?: number;
  piala_url?: string | null;
  juara?: string | null;
  kategori_penghargaan?: string | null;
  catatan?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_by?: string | null;
  updated_at?: string | null;
  created_actor?: ActorSummary;
  updated_actor?: ActorSummary;
}

export interface ContestSubmissionRecord {
  id: string;
  contest_id: string;
  film_id?: string | null;
  judul_film?: string;
  sutradara_id?: string | null;
  sutradara_nama?: string | null;
  crew_members?: string[];
  link_video?: string | null;
  award_status?: string | null;
  sertifikat_url?: string | null;
  created_by?: string | null;
  created_at?: string;
  created_actor?: ActorSummary;
}

export interface ContestListQuery {
  status?: string;
  tingkat?: string;
  tahun_event?: string;
  search?: string;
  page?: string;
  pageSize?: string;
}

export interface ContestCreateInput {
  nama?: string;
  jenis?: string;
  level?: string;
  tanggal?: string;
  status?: string;
  hasil?: string | null;
  nama_lomba?: string;
  penyelenggara?: string;
  kota?: string | null;
  tingkat?: string;
  deadline?: string;
  tahun_event?: number;
  website_url?: string | null;
  deskripsi?: string | null;
  planned_work_count?: number | null;
  academic_year?: string | null;
  change_reason?: string;
  idempotencyKey?: string;
  idempotency_key?: string;
}

export interface ContestUpdateInput {
  nama?: string;
  jenis?: string;
  level?: string;
  tanggal?: string;
  status?: string;
  hasil?: string | null;
  nama_lomba?: string;
  penyelenggara?: string;
  kota?: string | null;
  tingkat?: string;
  deadline?: string;
  tahun_event?: number;
  website_url?: string | null;
  deskripsi?: string | null;
  planned_work_count?: number | null;
  academic_year?: string | null;
  change_reason?: string;
  idempotencyKey?: string;
  idempotency_key?: string;
}

export interface ContestUpdateAuditContext {
  requestId?: string | null;
  operationId?: string | null;
  userAgent?: string | null;
}

export interface ContestSubmissionInput {
  contest_id?: string;
  film_id?: string;
  judul_film?: string;
  sutradara_id?: string;
  crew_members?: string[];
  link_video?: string;
  award_status?: string;
  sertifikat_url?: string | null;
  change_reason?: string;
}

export interface ContestMemoryState {
  contests: ContestRecord[];
  submissions: ContestSubmissionRecord[];
}

export interface ContestCreatePersistenceInput {
  nama: string;
  jenis: string;
  level: string;
  tanggal: string;
  status: string;
  hasil: string | null;
  namaLomba?: string | null;
  penyelenggara?: string | null;
  kota?: string | null;
  tingkat?: string | null;
  deadline?: string | null;
  tahunEvent?: number | null;
  statusPublic?: string | null;
  websiteUrl?: string | null;
  deskripsi?: string | null;
  plannedWorkCount?: number | null;
  academicYear?: string | null;
  actorId: string | null;
}

export interface ContestUpdatePersistenceInput {
  changes: Partial<ContestRecord>;
  actorId: string | null;
  changeReason?: string;
  auditContext?: ContestUpdateAuditContext;
}

export interface ContestSubmissionPersistenceInput {
  contestId: string;
  filmId?: string;
  judulFilm?: string;
  sutradaraId?: string;
  crewMembers?: string[];
  linkVideo?: string;
  awardStatus?: string;
  sertifikatUrl?: string | null;
  actorId: string | null;
}

export interface ContestSummary {
  total: number;
  selesai: number;
  progres: number;
  menang: number;
  winRate: number;
  totalLomba: number;
  lombaAktif: number;
  totalKaryaSubmitted: number;
  totalPrestasiJuara: number;
}

export interface ContestWinRateRow {
  tahun: number;
  level: string;
  totalLomba: number;
  totalSelesai: number;
  totalMenang: number;
  winRatePersen: number;
}

export interface ContestRepository {
  isConfigured(): boolean;
  list(query: ContestListQuery): Promise<{ data: ContestRecord[]; total: number; page: number; pageSize: number; totalPages: number } | { error: unknown }>;
  summary(): Promise<{ data: ContestSummary } | { error: unknown }>;
  winRate(tahun?: number): Promise<{
    overall: {
      totalLomba: number;
      totalMenang: number;
      totalSelesai: number;
      winRatePersen: number;
    };
    data: ContestWinRateRow[];
  } | { error: unknown }>;
  create(input: ContestCreatePersistenceInput): Promise<{ data: ContestRecord } | { error: unknown }>;
  update(id: string, input: ContestUpdatePersistenceInput): Promise<{ data: ContestRecord | null } | { error: unknown }>;
  submit(input: ContestSubmissionPersistenceInput): Promise<{ data: ContestSubmissionRecord } | { error: unknown }>;
}
