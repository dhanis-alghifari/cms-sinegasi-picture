import { randomUUID } from 'node:crypto';
import { generateR2PrivateUploadUrl, generateR2PrivateUploadUrlForKey, verifyCloudflareR2ImageUpload } from '../../services/cloudflareR2Service.js';
import { privateMediaAccess, type PrivateMediaObject } from '../../shared/uploads/privateMedia.js';
import { databaseErrorMessage } from '../../shared/database/database.types.js';
import { cleanAgendaText, getJakartaDate, isAgendaDateRangeWithinLimit, mapAgendaRepositoryError, normalizePicNames, parseAgendaPagination, validAgendaDate } from './agenda.helpers.js';
import type { AgendaActivity, AgendaCreateInput, AgendaListQuery, AgendaPhotoReserveInput, AgendaReportActivity, AgendaRepository, AgendaUpdateInput } from './agenda.types.js';

export class AgendaServiceError extends Error {
  constructor(public readonly statusCode: number, public readonly errorCode: string, message: string, public readonly details?: unknown) { super(message); this.name = 'AgendaServiceError'; }
}

function requiredText(value: unknown, field: string, maxLength: number): string {
  const text = cleanAgendaText(value, maxLength);
  if (!text) throw new AgendaServiceError(422, 'AGENDA_INPUT_INVALID', `${field} wajib diisi.`);
  return text;
}

function optionalInstructor(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new AgendaServiceError(422, 'AGENDA_INSTRUCTOR_INVALID', 'Nama pengajar harus berupa teks.');
  const text = value.trim().replace(/\s+/g, ' ');
  if (!text) return null;
  if (text.length < 2 || text.length > 120 || /[\u0000-\u001f\u007f]/.test(text)) {
    throw new AgendaServiceError(422, 'AGENDA_INSTRUCTOR_INVALID', 'Nama pengajar harus 2–120 karakter jika diisi.');
  }
  return text;
}

function normalizedIdempotency(value: unknown): string { return cleanAgendaText(value, 128) || randomUUID(); }

export class AgendaService {
  constructor(private readonly repository: AgendaRepository) {}
  repositoryIsConfigured(): boolean { return this.repository.isConfigured(); }

  async list(query: AgendaListQuery = {}) {
    const { page, pageSize } = parseAgendaPagination(query);
    const search = cleanAgendaText(query.search, 100);
    const dateFrom = query.date_from ? validAgendaDate(query.date_from) : undefined;
    const dateTo = query.date_to ? validAgendaDate(query.date_to) : undefined;
    if (query.date_from && !dateFrom) throw new AgendaServiceError(422, 'AGENDA_DATE_INVALID', 'Tanggal mulai agenda tidak valid atau berada di masa depan.');
    if (query.date_to && !dateTo) throw new AgendaServiceError(422, 'AGENDA_DATE_INVALID', 'Tanggal akhir agenda tidak valid atau berada di masa depan.');
    if (dateFrom && dateTo && dateFrom > dateTo) throw new AgendaServiceError(422, 'AGENDA_DATE_RANGE_INVALID', 'Rentang tanggal agenda tidak valid.');
    if (dateFrom && dateTo && !isAgendaDateRangeWithinLimit(dateFrom, dateTo)) throw new AgendaServiceError(422, 'AGENDA_DATE_RANGE_TOO_LARGE', 'Rentang tanggal agenda maksimal 90 hari.');
    const result = await this.repository.list({ search, dateFrom, dateTo, includeArchived: query.include_archived === 'true', page, pageSize });
    if ('error' in result) mapAgendaRepositoryError(result.error, 'Gagal memuat agenda kegiatan.');
    return result;
  }

  async report(query: AgendaListQuery = {}) {
    const { page, pageSize } = parseAgendaPagination({ page: '1', pageSize: '100' });
    const search = cleanAgendaText(query.search, 100);
    const dateFrom = query.date_from ? validAgendaDate(query.date_from) : undefined;
    const dateTo = query.date_to ? validAgendaDate(query.date_to) : undefined;
    if (query.date_from && !dateFrom) throw new AgendaServiceError(422, 'AGENDA_DATE_INVALID', 'Tanggal mulai agenda tidak valid atau berada di masa depan.');
    if (query.date_to && !dateTo) throw new AgendaServiceError(422, 'AGENDA_DATE_INVALID', 'Tanggal akhir agenda tidak valid atau berada di masa depan.');
    if (dateFrom && dateTo && dateFrom > dateTo) throw new AgendaServiceError(422, 'AGENDA_DATE_RANGE_INVALID', 'Rentang tanggal agenda tidak valid.');
    if (dateFrom && dateTo && !isAgendaDateRangeWithinLimit(dateFrom, dateTo)) throw new AgendaServiceError(422, 'AGENDA_DATE_RANGE_TOO_LARGE', 'Rentang tanggal agenda maksimal 90 hari.');

    const result = await this.repository.report({ search, dateFrom, dateTo, page, pageSize });
    if ('error' in result) mapAgendaRepositoryError(result.error, 'Gagal memuat laporan agenda kegiatan.');

    const data: AgendaReportActivity[] = result.data.map((row) => {
      const objectKey = row.photo?.object_key;
      const safePhoto = row.photo ? (() => {
        const { object_key: _objectKey, ...photo } = row.photo;
        return photo;
      })() : null;
      let photoAccessUrl: string | null = null;
      if (objectKey) {
        try {
          photoAccessUrl = row.photo?.upload_status === 'attached' ? privateMediaAccess('agenda', row.id, row.photo.id).access_url : null;
        } catch {
          photoAccessUrl = null;
        }
      }
      return {
        ...row,
        photo: safePhoto,
        photo_access_url: photoAccessUrl,
        photo_access_expires_in_seconds: photoAccessUrl ? 0 : null,
      };
    });

    return { ...result, data, truncated: result.total > data.length };
  }

  async get(id: string): Promise<AgendaActivity> {
    const result = await this.repository.list({ id, includeArchived: false, page: 1, pageSize: 1 });
    if ('error' in result) mapAgendaRepositoryError(result.error, 'Gagal memuat agenda kegiatan.');
    const item = result.data.find((row) => row.id === id);
    if (!item) throw new AgendaServiceError(404, 'AGENDA_NOT_FOUND', 'Agenda tidak ditemukan.');
    return item;
  }

  async create(input: AgendaCreateInput, actorId: string, context: { requestId?: string | null; operationId?: string | null; userAgent?: string | null }) {
    const activityDate = validAgendaDate(input.activity_date);
    if (!activityDate) throw new AgendaServiceError(422, 'AGENDA_DATE_INVALID', `Tanggal agenda wajib berupa tanggal hari ini (${getJakartaDate()}) atau tanggal sebelumnya.`);
    const picNames = normalizePicNames(input.pic_names);
    if (!picNames) throw new AgendaServiceError(422, 'AGENDA_PIC_INVALID', 'PIC wajib diisi 1 sampai 10 nama yang valid.');
    const result = await this.repository.create({ activityDate, activityName: requiredText(input.activity_name, 'Nama kegiatan', 120), activityDescription: requiredText(input.activity_description, 'Uraian kegiatan', 2000), instructorName: optionalInstructor(input.instructor_name), picNames, actorId, idempotencyKey: normalizedIdempotency(input.idempotency_key), ...context });
    if ('error' in result) mapAgendaRepositoryError(result.error, 'Gagal menyimpan agenda kegiatan.');
    return result;
  }

  async update(id: string, input: AgendaUpdateInput, actorId: string, context: { requestId?: string | null; operationId?: string | null; userAgent?: string | null }) {
    const activityDate = validAgendaDate(input.activity_date);
    if (!activityDate) throw new AgendaServiceError(422, 'AGENDA_DATE_INVALID', 'Tanggal agenda harus hari ini atau tanggal sebelumnya.');
    const picNames = normalizePicNames(input.pic_names);
    if (!picNames) throw new AgendaServiceError(422, 'AGENDA_PIC_INVALID', 'PIC wajib diisi 1 sampai 10 nama yang valid.');
    const reason = requiredText(input.change_reason, 'Alasan perubahan', 500);
    if (reason.length < 5) throw new AgendaServiceError(422, 'AGENDA_CHANGE_REASON_INVALID', 'Alasan perubahan minimal 5 karakter.');
    const result = await this.repository.update({ activityId: requiredText(id, 'id', 64), activityDate, activityName: requiredText(input.activity_name, 'Nama kegiatan', 120), activityDescription: requiredText(input.activity_description, 'Uraian kegiatan', 2000), instructorName: optionalInstructor(input.instructor_name), picNames, expectedVersion: input.expected_version, changeReason: reason, actorId, idempotencyKey: normalizedIdempotency(input.idempotency_key), ...context });
    if ('error' in result) mapAgendaRepositoryError(result.error, 'Gagal memperbarui agenda kegiatan.');
    return result;
  }

  async archive(id: string, reason: string, actorId: string, idempotencyKey: string, context: { requestId?: string | null; operationId?: string | null; userAgent?: string | null }) {
    const changeReason = requiredText(reason, 'Alasan pengarsipan', 500);
    if (changeReason.length < 5) throw new AgendaServiceError(422, 'AGENDA_CHANGE_REASON_INVALID', 'Alasan pengarsipan minimal 5 karakter.');
    const result = await this.repository.archive({ activityId: requiredText(id, 'id', 64), changeReason, actorId, idempotencyKey: normalizedIdempotency(idempotencyKey), ...context });
    if ('error' in result) mapAgendaRepositoryError(result.error, 'Gagal mengarsipkan agenda kegiatan.');
    return result;
  }

  async reservePhoto(activityId: string, input: AgendaPhotoReserveInput, actorId: string) {
    const fileName = requiredText(input.file_name, 'Nama file', 255);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(input.content_type) || !Number.isInteger(input.file_size_bytes) || input.file_size_bytes < 1 || input.file_size_bytes > 614400) throw new AgendaServiceError(422, 'AGENDA_PHOTO_INPUT_INVALID', 'Foto harus JPEG, PNG, atau WebP dengan ukuran maksimal 600 KB.');
    let upload: ReturnType<typeof generateR2PrivateUploadUrl>;
    try { upload = generateR2PrivateUploadUrl(fileName, `agenda/${activityId}`, input.content_type); } catch (error) { throw new AgendaServiceError(503, 'AGENDA_PHOTO_STORAGE_UNAVAILABLE', databaseErrorMessage(error) || 'Penyimpanan foto belum tersedia.'); }
    const result = await this.repository.reservePhoto({ activityId: requiredText(activityId, 'activity_id', 64), objectKey: upload.key, contentType: input.content_type, fileSizeBytes: input.file_size_bytes, originalFilename: fileName, actorId, idempotencyKey: normalizedIdempotency(input.idempotency_key) });
    if ('error' in result) mapAgendaRepositoryError(result.error, 'Gagal menyiapkan unggahan foto agenda.');
    const signedUpload = result.photo.object_key && result.photo.object_key !== upload.key
      ? generateR2PrivateUploadUrlForKey(result.photo.object_key, input.content_type)
      : upload;
    return { ...result, upload_url: signedUpload.uploadUrl, expires_in_seconds: signedUpload.expiresInSeconds };
  }

  async completePhoto(activityId: string, photoId: string, actorId: string, idempotencyKey: string) {
    const photoResult = await this.repository.getPhoto(activityId, photoId);
    if ('error' in photoResult) mapAgendaRepositoryError(photoResult.error, 'Gagal memeriksa foto agenda.');
    if (!photoResult.photo?.object_key) throw new AgendaServiceError(404, 'AGENDA_PHOTO_NOT_FOUND', 'Unggahan foto tidak ditemukan atau sudah kedaluwarsa.');
    const photo = photoResult.photo;
    let validImage = false;
    try {
      validImage = await verifyCloudflareR2ImageUpload(photo.object_key || '', photo.mime_type, photo.file_size_bytes);
    } catch {
      throw new AgendaServiceError(503, 'AGENDA_PHOTO_VERIFY_FAILED', 'Foto belum dapat diverifikasi. Coba lagi.');
    }
    if (!validImage) throw new AgendaServiceError(422, 'AGENDA_PHOTO_INVALID', 'Isi foto tidak sesuai metadata upload.');
    const result = await this.repository.attachPhoto({ activityId, photoId, actorId, idempotencyKey: normalizedIdempotency(idempotencyKey) });
    if ('error' in result) mapAgendaRepositoryError(result.error, 'Gagal menyelesaikan foto agenda.');
    const { object_key: _key, ...safePhoto } = result.photo;
    return { photo: safePhoto, ...privateMediaAccess('agenda', activityId, result.photo.id) };
  }

  async photoAccess(activityId: string) {
    const result = await this.repository.getPhoto(activityId);
    if ('error' in result) mapAgendaRepositoryError(result.error, 'Gagal memuat dokumentasi agenda.');
    if (!result.photo?.object_key || result.photo.upload_status !== 'attached') throw new AgendaServiceError(404, 'AGENDA_PHOTO_NOT_FOUND', 'Dokumentasi foto belum tersedia.');
    return privateMediaAccess('agenda', activityId, result.photo.id);
  }

  async photoMedia(activityId: string, photoId: string): Promise<PrivateMediaObject> {
    await this.get(activityId);
    const result = await this.repository.getPhoto(activityId, photoId);
    if ('error' in result) mapAgendaRepositoryError(result.error, 'Gagal memuat dokumentasi agenda.');
    const photo = result.photo;
    if (!photo?.object_key || photo.id !== photoId || photo.activity_id !== activityId || photo.upload_status !== 'attached') throw new AgendaServiceError(404, 'AGENDA_PHOTO_NOT_FOUND', 'Dokumentasi foto belum tersedia.');
    return { objectKey: photo.object_key, contentType: photo.mime_type, fileSizeBytes: photo.file_size_bytes };
  }
}
