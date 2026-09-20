import type { SupabaseClient } from '@supabase/supabase-js';
import type { DatabaseRow } from '../../shared/database/database.types.js';
import { mapAgendaPhoto, mapAgendaRow } from './agenda.helpers.js';
import type { AgendaActivity, AgendaMemoryState, AgendaRepository, AgendaPhoto } from './agenda.types.js';

type SupabaseLike = SupabaseClient | null;

function rpcPayload(value: unknown): DatabaseRow {
  return value && typeof value === 'object' ? value as DatabaseRow : {};
}

function mapRpcActivity(value: unknown): { data: AgendaActivity; idempotentReplay: boolean } {
  const payload = rpcPayload(value);
  return { data: mapAgendaRow(rpcPayload(payload.activity)), idempotentReplay: Boolean(payload.idempotent_replay) };
}

function mapRpcPhoto(value: unknown): { photo: AgendaPhoto; idempotentReplay: boolean } {
  const payload = rpcPayload(value);
  return { photo: mapAgendaPhoto(payload.photo), idempotentReplay: Boolean(payload.idempotent_replay) };
}

function memoryList(state: AgendaMemoryState, query: { id?: string; search?: string; dateFrom?: string; dateTo?: string; includeArchived: boolean; page: number; pageSize: number }) {
  const search = query.search?.toLocaleLowerCase('id-ID');
  const filtered = state.activities.filter((item) => {
    if (query.id && item.id !== query.id) return false;
    if (!query.includeArchived && item.archived_at) return false;
    if (query.dateFrom && item.activity_date < query.dateFrom) return false;
    if (query.dateTo && item.activity_date > query.dateTo) return false;
    if (search && ![item.activity_name, item.activity_description, item.instructor_name, ...item.pic_names].some((value) => value.toLocaleLowerCase('id-ID').includes(search))) return false;
    return true;
  }).sort((a, b) => b.activity_date.localeCompare(a.activity_date) || b.id.localeCompare(a.id));
  const from = (query.page - 1) * query.pageSize;
  return { data: filtered.slice(from, from + query.pageSize), total: filtered.length, page: query.page, pageSize: query.pageSize, totalPages: Math.max(1, Math.ceil(filtered.length / query.pageSize)) };
}

export function createAgendaRepository(client: SupabaseLike, state: AgendaMemoryState): AgendaRepository {
  return {
    isConfigured: () => client !== null,
    async list(query) {
      if (!client) return memoryList(state, query);
      let request = client.from('agenda_activities').select('id,activity_date,activity_name,activity_description,instructor_name,pic_names,version,created_by,updated_by,created_at,updated_at,archived_by,archived_at,agenda_activity_photos(id,activity_id,upload_status,mime_type,file_size_bytes,original_filename,created_at)', { count: 'exact' });
      if (!query.includeArchived) request = request.is('archived_at', null);
      if (query.id) request = request.eq('id', query.id);
      if (query.dateFrom) request = request.gte('activity_date', query.dateFrom);
      if (query.dateTo) request = request.lte('activity_date', query.dateTo);
      if (query.search) {
        const safe = query.search.replace(/[\\%,_(),]/g, ' ').trim();
        if (safe) request = request.or(`activity_name.ilike.%${safe}%,activity_description.ilike.%${safe}%,instructor_name.ilike.%${safe}%,pic_names_search.ilike.%${safe}%`);
      }
      const from = (query.page - 1) * query.pageSize;
      const result = await request.order('activity_date', { ascending: false }).order('id', { ascending: false }).range(from, from + query.pageSize - 1);
      if (result.error) return { error: result.error };
      const total = Number(result.count || 0);
      return { data: (result.data || []).map((row) => mapAgendaRow(row as unknown as DatabaseRow)), total, page: query.page, pageSize: query.pageSize, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) };
    },
    async report(query) {
      if (!client) return memoryList(state, { ...query, includeArchived: false });
      let request = client.from('agenda_activities').select('id,activity_date,activity_name,activity_description,instructor_name,pic_names,version,created_by,updated_by,created_at,updated_at,archived_by,archived_at,agenda_activity_photos(id,activity_id,object_key,upload_status,mime_type,file_size_bytes,original_filename,created_at)', { count: 'exact' });
      request = request.is('archived_at', null);
      if (query.dateFrom) request = request.gte('activity_date', query.dateFrom);
      if (query.dateTo) request = request.lte('activity_date', query.dateTo);
      if (query.search) {
        const safe = query.search.replace(/[\\%,_(),]/g, ' ').trim();
        if (safe) request = request.or(`activity_name.ilike.%${safe}%,activity_description.ilike.%${safe}%,instructor_name.ilike.%${safe}%,pic_names_search.ilike.%${safe}%`);
      }
      const from = (query.page - 1) * query.pageSize;
      const result = await request.order('activity_date', { ascending: false }).order('id', { ascending: false }).range(from, from + query.pageSize - 1);
      if (result.error) return { error: result.error };
      const total = Number(result.count || 0);
      return { data: (result.data || []).map((row) => mapAgendaRow(row as unknown as DatabaseRow)), total, page: query.page, pageSize: query.pageSize, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) };
    },
    async create(input) {
      if (!client) {
        const now = new Date().toISOString();
        const existing = state.activities.find((item) => item.id === input.idempotencyKey);
        if (existing) return { data: existing, idempotentReplay: true };
        const activity: AgendaActivity = { id: input.idempotencyKey, activity_date: input.activityDate, activity_name: input.activityName, activity_description: input.activityDescription, instructor_name: input.instructorName, pic_names: input.picNames, version: 1, created_by: input.actorId, updated_by: input.actorId, created_at: now, updated_at: now, archived_by: null, archived_at: null, photo: null };
        state.activities.push(activity);
        return { data: activity, idempotentReplay: false };
      }
      const result = await client.rpc('create_agenda_activity_atomic', { p_activity_date: input.activityDate, p_activity_name: input.activityName, p_activity_description: input.activityDescription, p_instructor_name: input.instructorName, p_pic_names: input.picNames, p_actor_id: input.actorId, p_idempotency_key: input.idempotencyKey, p_request_id: input.requestId ?? null, p_operation_id: input.operationId ?? null, p_user_agent: input.userAgent ?? null });
      if (result.error) return { error: result.error };
      return mapRpcActivity(result.data);
    },
    async update(input) {
      if (!client) {
        const activity = state.activities.find((item) => item.id === input.activityId);
        if (!activity) return { error: { message: 'AGENDA_NOT_FOUND' } };
        if (activity.version !== input.expectedVersion) return { error: { message: 'AGENDA_VERSION_CONFLICT' } };
        Object.assign(activity, { activity_date: input.activityDate, activity_name: input.activityName, activity_description: input.activityDescription, instructor_name: input.instructorName, pic_names: input.picNames, version: activity.version + 1, updated_by: input.actorId, updated_at: new Date().toISOString() });
        return { data: activity, idempotentReplay: false };
      }
      const result = await client.rpc('update_agenda_activity_atomic', { p_activity_id: input.activityId, p_activity_date: input.activityDate, p_activity_name: input.activityName, p_activity_description: input.activityDescription, p_instructor_name: input.instructorName, p_pic_names: input.picNames, p_expected_version: input.expectedVersion, p_change_reason: input.changeReason, p_actor_id: input.actorId, p_idempotency_key: input.idempotencyKey, p_request_id: input.requestId ?? null, p_operation_id: input.operationId ?? null, p_user_agent: input.userAgent ?? null });
      if (result.error) return { error: result.error };
      return mapRpcActivity(result.data);
    },
    async archive(input) {
      if (!client) {
        const activity = state.activities.find((item) => item.id === input.activityId);
        if (!activity) return { error: { message: 'AGENDA_NOT_FOUND' } };
        Object.assign(activity, { archived_at: new Date().toISOString(), archived_by: input.actorId, updated_by: input.actorId, updated_at: new Date().toISOString(), version: activity.version + 1 });
        return { data: activity, idempotentReplay: false };
      }
      const result = await client.rpc('archive_agenda_activity_atomic', { p_activity_id: input.activityId, p_change_reason: input.changeReason, p_actor_id: input.actorId, p_idempotency_key: input.idempotencyKey, p_request_id: input.requestId ?? null, p_operation_id: input.operationId ?? null, p_user_agent: input.userAgent ?? null });
      if (result.error) return { error: result.error };
      return mapRpcActivity(result.data);
    },
    async reservePhoto(input) {
      if (!client) return { error: { message: 'AGENDA_PHOTO_STORAGE_UNAVAILABLE' } };
      const result = await client.rpc('reserve_agenda_photo_atomic', { p_activity_id: input.activityId, p_object_key: input.objectKey, p_mime_type: input.contentType, p_file_size_bytes: input.fileSizeBytes, p_original_filename: input.originalFilename, p_actor_id: input.actorId, p_idempotency_key: input.idempotencyKey });
      if (result.error) return { error: result.error };
      return mapRpcPhoto(result.data);
    },
    async attachPhoto(input) {
      if (!client) return { error: { message: 'AGENDA_PHOTO_STORAGE_UNAVAILABLE' } };
      const result = await client.rpc('attach_agenda_photo_atomic', { p_activity_id: input.activityId, p_photo_id: input.photoId, p_actor_id: input.actorId, p_idempotency_key: input.idempotencyKey });
      if (result.error) return { error: result.error };
      return mapRpcPhoto(result.data);
    },
    async getPhoto(activityId, photoId) {
      if (!client) return { photo: state.activities.find((item) => item.id === activityId)?.photo ?? null };
      let request = client.from('agenda_activity_photos').select('id,activity_id,object_key,upload_status,mime_type,file_size_bytes,original_filename,created_at').eq('activity_id', activityId);
      request = photoId ? request.eq('id', photoId).eq('upload_status', 'pending') : request.eq('upload_status', 'attached');
      const result = await request.maybeSingle();
      if (result.error) return { error: result.error };
      return { photo: result.data ? mapAgendaPhoto(result.data) : null };
    },
  };
}
