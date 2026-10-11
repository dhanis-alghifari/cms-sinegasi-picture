import { apiClient } from '@/shared/api/client';
import type { AgendaActivity, AgendaFilters, AgendaPage, AgendaFormValues, AgendaReportPage } from '../types/agenda.types';
import { decodeAgendaActivity, decodeAgendaPage, decodeAgendaPhotoAccess, decodeAgendaPhotoCompletion, decodeAgendaReport, decodeAgendaUploadReservation } from './agenda.responses';

function queryString(filters: AgendaFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== '') params.set(key, String(value));
  return params.toString();
}

export const agendaService = {
  async list(filters: AgendaFilters): Promise<AgendaPage> {
    return apiClient.getParsed(`/api/agenda?${queryString(filters)}`, decodeAgendaPage);
  },
  async report(filters: AgendaFilters): Promise<AgendaReportPage> {
    return apiClient.getParsed(`/api/agenda/report?${queryString(filters)}`, decodeAgendaReport);
  },
  async create(values: AgendaFormValues, idempotencyKey: string): Promise<AgendaActivity> {
    return apiClient.postParsed('/api/agenda', { activity_date: values.activity_date, activity_name: values.activity_name, activity_description: values.activity_description, instructor_name: values.instructor_name.trim() || null, pic_names: values.pic_names.split(',').map((name) => name.trim()).filter(Boolean) }, decodeAgendaActivity, { changeReason: 'Membuat agenda kegiatan', idempotencyKey });
  },
  async update(id: string, values: AgendaFormValues, version: number, idempotencyKey: string): Promise<AgendaActivity> {
    return apiClient.patchParsed(`/api/agenda/${id}`, { activity_date: values.activity_date, activity_name: values.activity_name, activity_description: values.activity_description, instructor_name: values.instructor_name.trim() || null, pic_names: values.pic_names.split(',').map((name) => name.trim()).filter(Boolean), expected_version: version, change_reason: values.change_reason }, decodeAgendaActivity, { changeReason: values.change_reason, idempotencyKey });
  },
  async archive(id: string, reason: string, idempotencyKey: string): Promise<AgendaActivity> {
    return apiClient.deleteParsed(`/api/agenda/${id}`, decodeAgendaActivity, { body: JSON.stringify({ change_reason: reason }), changeReason: reason, idempotencyKey });
  },
  async reservePhoto(id: string, file: File, idempotencyKey: string): Promise<{ photoId: string; uploadUrl: string }> {
    const response = await apiClient.postParsed(`/api/agenda/${id}/photo-uploads`, { file_name: file.name, content_type: file.type, file_size_bytes: file.size }, decodeAgendaUploadReservation, { changeReason: 'Menambahkan dokumentasi agenda', idempotencyKey });
    const upload = await fetch(response.upload_url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
    if (!upload.ok) throw new Error('Unggah foto gagal. Silakan coba lagi.');
    await apiClient.postParsed(`/api/agenda/${id}/photo-uploads/${response.photo.id}/complete`, {}, decodeAgendaPhotoCompletion, { changeReason: 'Memverifikasi dokumentasi agenda', idempotencyKey: crypto.randomUUID() });
    return { photoId: response.photo.id, uploadUrl: response.upload_url };
  },
  async photoAccess(id: string): Promise<string> {
    const response = await apiClient.getParsed(`/api/agenda/${id}/photo-access`, decodeAgendaPhotoAccess);
    return response.access_url;
  },
};
