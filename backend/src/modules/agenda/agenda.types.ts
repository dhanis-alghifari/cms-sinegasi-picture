export interface AgendaPhoto {
  id: string;
  activity_id: string;
  object_key?: string;
  upload_status: 'pending' | 'attached' | 'abandoned';
  mime_type: string;
  file_size_bytes: number;
  original_filename: string;
  created_at: string;
}

export interface AgendaActivity {
  id: string;
  activity_date: string;
  activity_name: string;
  activity_description: string;
  instructor_name: string;
  pic_names: string[];
  version: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  archived_by: string | null;
  archived_at: string | null;
  photo: AgendaPhoto | null;
}

export interface AgendaListQuery {
  search?: string;
  date_from?: string;
  date_to?: string;
  page?: string;
  pageSize?: string;
  include_archived?: string;
}

export interface AgendaListResult {
  data: AgendaActivity[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AgendaReportActivity extends AgendaActivity {
  photo_access_url: string | null;
  photo_access_expires_in_seconds: number | null;
}

export interface AgendaReportResult extends Omit<AgendaListResult, 'data'> {
  data: AgendaReportActivity[];
  truncated?: boolean;
}

export interface AgendaCreateInput {
  activity_date: string;
  activity_name: string;
  activity_description: string;
  instructor_name: string;
  pic_names: string[] | string;
  idempotency_key?: string;
}

export interface AgendaUpdateInput extends AgendaCreateInput {
  expected_version: number;
  change_reason: string;
}

export interface AgendaPhotoReserveInput {
  file_name: string;
  content_type: 'image/jpeg' | 'image/png' | 'image/webp';
  file_size_bytes: number;
  idempotency_key?: string;
}

export interface AgendaRepository {
  isConfigured(): boolean;
  list(query: { id?: string; search?: string; dateFrom?: string; dateTo?: string; includeArchived: boolean; page: number; pageSize: number }): Promise<AgendaListResult | { error: unknown }>;
  report(query: { search?: string; dateFrom?: string; dateTo?: string; page: number; pageSize: number }): Promise<AgendaListResult | { error: unknown }>;
  create(input: { activityDate: string; activityName: string; activityDescription: string; instructorName: string; picNames: string[]; actorId: string; idempotencyKey: string; requestId?: string | null; operationId?: string | null; userAgent?: string | null }): Promise<{ data: AgendaActivity; idempotentReplay: boolean } | { error: unknown }>;
  update(input: { activityId: string; activityDate: string; activityName: string; activityDescription: string; instructorName: string; picNames: string[]; expectedVersion: number; changeReason: string; actorId: string; idempotencyKey: string; requestId?: string | null; operationId?: string | null; userAgent?: string | null }): Promise<{ data: AgendaActivity; idempotentReplay: boolean } | { error: unknown }>;
  archive(input: { activityId: string; changeReason: string; actorId: string; idempotencyKey: string; requestId?: string | null; operationId?: string | null; userAgent?: string | null }): Promise<{ data: AgendaActivity; idempotentReplay: boolean } | { error: unknown }>;
  reservePhoto(input: { activityId: string; objectKey: string; contentType: string; fileSizeBytes: number; originalFilename: string; actorId: string; idempotencyKey: string }): Promise<{ photo: AgendaPhoto; idempotentReplay: boolean } | { error: unknown }>;
  attachPhoto(input: { activityId: string; photoId: string; actorId: string; idempotencyKey: string }): Promise<{ photo: AgendaPhoto; idempotentReplay: boolean } | { error: unknown }>;
  getPhoto(activityId: string, photoId?: string): Promise<{ photo: AgendaPhoto | null } | { error: unknown }>;
}

export interface AgendaMemoryState { activities: AgendaActivity[]; }
