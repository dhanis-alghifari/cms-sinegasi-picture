import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { databaseErrorCode } from '../../shared/database/database.types.js';
import type { DatabaseRow } from '../../shared/database/database.types.js';
import { mapEntry, mapWork, parseEntryPagination } from './contest-entries.helpers.js';
import { CONTEST_WORK_TYPES, type ContestEntriesMemoryState, type ContestEntriesRepository, type ContestEntryEvidenceRecord, type ContestEntryRecord, type ContestWorkTypeRecord } from './contest-entries.types.js';

type SupabaseLike = SupabaseClient | null;
const ENTRY_SELECT = 'id,contest_id,work_id,pipeline_status,outcome_status,result_label,result_note,submitted_at,completed_at,created_by,created_at,updated_at,media_works(id,title,work_type_code,description,duration_minutes,production_year,primary_asset_url,video_url,created_by,created_at,work_types(code,label))';
const WORK_TYPE_LABELS: Record<string, string> = {
  short_film: 'Film Pendek',
  documentary: 'Dokumenter',
  photography: 'Fotografi',
  animation: 'Animasi',
  commercial: 'Iklan / Komersial',
  music_video: 'Video Musik',
  experimental: 'Eksperimental',
  other: 'Lainnya',
};

function missingSchema(error: unknown): boolean {
  return ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(databaseErrorCode(error) || '');
}

function mapEvidence(row: DatabaseRow): ContestEntryEvidenceRecord {
  return {
    id: String(row.id),
    entry_id: String(row.entry_id),
    evidence_type: String(row.evidence_type) as ContestEntryEvidenceRecord['evidence_type'],
    object_key: row.object_key == null ? null : String(row.object_key),
    public_url: row.public_url == null ? null : String(row.public_url),
    storage_provider: String(row.storage_provider) as ContestEntryEvidenceRecord['storage_provider'],
    target_status: row.target_status == null ? null : String(row.target_status) as ContestEntryEvidenceRecord['target_status'],
    mime_type: row.mime_type == null ? null : String(row.mime_type),
    file_size_bytes: row.file_size_bytes == null ? null : Number(row.file_size_bytes),
    original_filename: row.original_filename == null ? null : String(row.original_filename),
    upload_status: String(row.upload_status) as ContestEntryEvidenceRecord['upload_status'],
    attached_status: row.attached_status == null ? null : String(row.attached_status) as ContestEntryEvidenceRecord['attached_status'],
    created_by: row.created_by == null ? null : String(row.created_by),
    created_at: row.created_at == null ? undefined : String(row.created_at),
    updated_at: row.updated_at == null ? undefined : String(row.updated_at),
  };
}

export function createContestEntriesRepository(client: SupabaseLike, state: ContestEntriesMemoryState): ContestEntriesRepository {
  return {
    isConfigured: () => client !== null,

    async listWorkTypes() {
      if (!client) {
        return {
          data: CONTEST_WORK_TYPES.map((code, index) => ({
            code,
            label: WORK_TYPE_LABELS[code],
            sort_order: (index + 1) * 10,
          })),
        };
      }
      const result = await client.from('work_types')
        .select('code,label,sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('code', { ascending: true });
      if (result.error) return { error: result.error };
      return {
        data: (result.data || []).map((row) => ({
          code: String(row.code) as ContestWorkTypeRecord['code'],
          label: String(row.label),
          sort_order: row.sort_order == null ? undefined : Number(row.sort_order),
        })),
      };
    },

    async list(contestId, query) {
      const { page, pageSize, from, to } = parseEntryPagination(query);
      if (!client) {
        const rows = state.entries.filter((entry) => entry.contest_id === contestId && (!query.status || query.status === 'all' || entry.pipeline_status === query.status));
        return { data: rows.slice(from, to + 1), total: rows.length, page, pageSize, totalPages: Math.ceil(rows.length / pageSize) || 1 };
      }
      let request = client.from('contest_entries').select(ENTRY_SELECT, { count: 'exact' }).eq('contest_id', contestId);
      if (query.status && query.status !== 'all') request = request.eq('pipeline_status', query.status);
      const result = await request.order('updated_at', { ascending: false }).order('id', { ascending: false }).range(from, to);
      if (result.error) return { error: result.error };
      const data = ((result.data || []) as unknown as DatabaseRow[]).map(mapEntry);
      const total = result.count ?? data.length;
      return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 };
    },

    async get(entryId) {
      if (!client) return { data: state.entries.find((entry) => entry.id === entryId) ?? null };
      const result = await client.from('contest_entries').select(ENTRY_SELECT).eq('id', entryId).maybeSingle();
      if (result.error) return { error: result.error };
      return { data: result.data ? mapEntry(result.data as unknown as DatabaseRow) : null };
    },

    async create(input) {
      if (!client) {
        let work: ContestEntryRecord['work'];
        let workId = input.workId;
        if (workId) {
          work = state.works.find((candidate) => candidate.id === workId);
          if (!work) return { error: { code: '23503' } };
        } else if (input.work) {
          workId = randomUUID();
          work = { id: workId, ...input.work, created_by: input.actorId, created_at: new Date().toISOString() };
          state.works.push(work);
        }
        if (!workId || !work) return { error: { code: 'P0001', message: 'WORK_REQUIRED' } };
        if (state.entries.some((entry) => entry.contest_id === input.contestId && entry.work_id === workId)) return { error: { code: '23505' } };
        const entry: ContestEntryRecord = { id: randomUUID(), contest_id: input.contestId, work_id: workId, pipeline_status: 'proses_submit', result_label: null, result_note: null, submitted_at: null, completed_at: null, work, created_by: input.actorId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        state.entries.push(entry);
        return { data: entry };
      }
      const result = await client.rpc('create_contest_entry_atomic', {
        p_contest_id: input.contestId,
        p_work_id: input.workId ?? null,
        p_title: input.work?.title ?? null,
        p_work_type_code: input.work?.work_type_code ?? null,
        p_description: input.work?.description ?? null,
        p_primary_asset_url: input.work?.primary_asset_url ?? null,
        p_video_url: input.work?.video_url ?? null,
        p_actor_id: input.actorId,
      });
      if (result.error) return { error: result.error };
      const payload = result.data as { entry?: DatabaseRow; work?: DatabaseRow } | null;
      if (!payload?.entry) return { error: { code: 'PGRST204', message: 'RPC tidak mengembalikan entry.' } };
      return { data: mapEntry({ ...payload.entry, media_works: payload.work }) };
    },

    async reserveEvidence(input) {
      if (!client) {
        const evidence = state.evidence ?? (state.evidence = []);
        const existing = evidence.find((item) => item.object_key === input.objectKey);
        if (existing) return { data: existing };
        const record: ContestEntryEvidenceRecord = {
          id: randomUUID(),
          entry_id: input.entryId,
          evidence_type: input.targetStatus === 'selesai' ? 'result' : 'submission',
          object_key: input.objectKey,
          public_url: null,
          storage_provider: 'r2',
          target_status: input.targetStatus,
          mime_type: input.mimeType,
          file_size_bytes: input.fileSizeBytes,
          original_filename: input.originalFilename,
          upload_status: 'pending',
          attached_status: null,
          created_by: input.actorId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        evidence.push(record);
        return { data: record };
      }
      const result = await client.rpc('reserve_contest_entry_evidence_atomic', {
        p_entry_id: input.entryId,
        p_target_status: input.targetStatus,
        p_object_key: input.objectKey,
        p_mime_type: input.mimeType,
        p_file_size_bytes: input.fileSizeBytes,
        p_original_filename: input.originalFilename,
        p_actor_id: input.actorId,
      });
      if (result.error) return { error: result.error };
      const payload = result.data as { evidence?: DatabaseRow } | null;
      if (!payload?.evidence) return { error: { code: 'PGRST204', message: 'RPC tidak mengembalikan bukti.' } };
      return { data: mapEvidence(payload.evidence) };
    },

    async getEvidence(evidenceId) {
      if (!client) return { data: (state.evidence ?? []).find((item) => item.id === evidenceId) ?? null };
      const result = await client.from('contest_entry_evidence')
        .select('id,entry_id,evidence_type,object_key,public_url,storage_provider,target_status,mime_type,file_size_bytes,original_filename,upload_status,attached_status,created_by,created_at,updated_at')
        .eq('id', evidenceId)
        .maybeSingle();
      if (result.error) return { error: result.error };
      return { data: result.data ? mapEvidence(result.data as unknown as DatabaseRow) : null };
    },

    async transition(input) {
      if (!client) {
        const entry = state.entries.find((candidate) => candidate.id === input.entryId);
        if (!entry) return { error: { code: 'PGRST116' } };
        const expected = input.status === 'sudah_terkirim' ? 'proses_submit' : 'sudah_terkirim';
        if (entry.pipeline_status !== expected) return { error: { code: 'P0001', message: 'CONTEST_ENTRY_TRANSITION_INVALID' } };
        if (input.status === 'sudah_terkirim') {
          const evidence = (state.evidence ?? []).find((item) => item.id === input.evidenceId);
          if (!evidence || evidence.upload_status !== 'pending') return { error: { code: 'P0001', message: 'CONTEST_ENTRY_EVIDENCE_INVALID' } };
          evidence.upload_status = 'attached';
          evidence.attached_status = 'sudah_terkirim';
        }
        const from = entry.pipeline_status;
        entry.pipeline_status = input.status;
        entry.submitted_at = entry.submitted_at ?? new Date().toISOString();
        entry.updated_at = new Date().toISOString();
        state.statusHistory.push({ entry_id: entry.id, from_status: from, to_status: input.status, change_reason: input.changeReason, changed_by: input.actorId, created_at: new Date().toISOString() });
        return { data: entry };
      }
      const result = await client.rpc('transition_contest_entry_pipeline_atomic', {
        p_entry_id: input.entryId,
        p_status: input.status,
        p_evidence_id: input.evidenceId ?? null,
        p_change_reason: input.changeReason,
        p_actor_id: input.actorId,
        p_idempotency_key: input.context.idempotencyKey,
        p_request_id: input.context.requestId ?? null,
        p_operation_id: input.context.operationId ?? null,
        p_user_agent: input.context.userAgent ?? null,
      });
      if (result.error) return { error: result.error };
      const payload = result.data as { entry?: DatabaseRow } | null;
      if (!payload?.entry) return { error: { code: 'PGRST204', message: 'RPC tidak mengembalikan entry.' } };
      const current = await client.from('contest_entries').select(ENTRY_SELECT).eq('id', input.entryId).single();
      if (current.error) return { error: current.error };
      return { data: mapEntry(current.data as unknown as DatabaseRow) };
    },

    async finalize(input) {
      if (!client) {
        const entry = state.entries.find((candidate) => candidate.id === input.entryId);
        if (!entry) return { error: { code: 'PGRST116' } };
        if (entry.pipeline_status !== 'menunggu_pengumuman') return { error: { code: 'P0001', message: 'CONTEST_ENTRY_TRANSITION_INVALID' } };
        const evidence = (state.evidence ?? []).find((item) => item.id === input.evidenceId);
        if (!evidence || evidence.upload_status !== 'pending') return { error: { code: 'P0001', message: 'CONTEST_FINALIZE_EVIDENCE_INVALID' } };
        evidence.upload_status = 'attached';
        evidence.attached_status = 'selesai';
        const from = entry.pipeline_status;
        entry.pipeline_status = 'selesai';
        entry.outcome_status = input.outcomeStatus;
        entry.result_label = input.outcomeStatus === 'awarded' ? input.results[0]?.result_title ?? null : 'Tidak mendapat penghargaan';
        entry.completed_at = new Date().toISOString();
        entry.updated_at = new Date().toISOString();
        state.statusHistory.push({ entry_id: entry.id, from_status: from, to_status: 'selesai', change_reason: input.changeReason, changed_by: input.actorId, created_at: new Date().toISOString() });
        return { data: entry, results: input.results };
      }
      const result = await client.rpc('finalize_contest_entry_atomic', {
        p_entry_id: input.entryId,
        p_outcome_status: input.outcomeStatus,
        p_results: input.results,
        p_evidence_id: input.evidenceId,
        p_change_reason: input.changeReason,
        p_actor_id: input.actorId,
        p_idempotency_key: input.context.idempotencyKey,
        p_request_id: input.context.requestId ?? null,
        p_operation_id: input.context.operationId ?? null,
        p_user_agent: input.context.userAgent ?? null,
      });
      if (result.error) return { error: result.error };
      const payload = result.data as { entry?: DatabaseRow; results?: unknown[] } | null;
      if (!payload?.entry) return { error: { code: 'PGRST204', message: 'RPC tidak mengembalikan entry.' } };
      const current = await client.from('contest_entries').select(ENTRY_SELECT).eq('id', input.entryId).single();
      if (current.error) return { error: current.error };
      return { data: mapEntry(current.data as unknown as DatabaseRow), results: payload.results ?? [] };
    },
  };
}
