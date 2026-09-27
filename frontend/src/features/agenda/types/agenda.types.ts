export interface AgendaPhoto {
  id: string;
  activity_id: string;
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
  instructor_name: string | null;
  pic_names: string[];
  version: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  photo: AgendaPhoto | null;
}

export interface AgendaReportActivity extends AgendaActivity {
  photo_access_url: string | null;
  photo_access_expires_in_seconds: number | null;
}

export interface AgendaPage { data: AgendaActivity[]; total: number; page: number; pageSize: number; totalPages: number; }
export interface AgendaReportPage { data: AgendaReportActivity[]; total: number; page: number; pageSize: number; totalPages: number; truncated?: boolean; }
export interface AgendaFilters { search?: string; date_from?: string; date_to?: string; page?: number; pageSize?: number; }
export interface AgendaFormValues { activity_date: string; activity_name: string; activity_description: string; instructor_name: string; pic_names: string; photo?: File | null; change_reason?: string; }
