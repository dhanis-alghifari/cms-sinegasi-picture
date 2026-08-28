import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import type { DatabaseRow } from '../../shared/database/database.types.js';
import type {
  ContestAchievementListResult,
  ContestAchievementsMemoryState,
  ContestAchievementsRepository,
  ContestEntryResultInput,
  ContestOutcomeStatus,
  ContestResultKind,
} from './contest-achievements.types.js';

type SupabaseLike = SupabaseClient | null;

function mapRow(row: DatabaseRow): any {
  return {
    result_id: typeof row.result_id === 'string' ? row.result_id : null,
    entry_id: String(row.entry_id),
    contest_id: String(row.contest_id),
    work_id: String(row.work_id),
    pipeline_status: String(row.pipeline_status || ''),
    outcome_status: String(row.outcome_status || 'pending') as ContestOutcomeStatus,
    work_title: String(row.work_title || ''),
    work_type_code: String(row.work_type_code || ''),
    nama_lomba: String(row.nama_lomba || ''),
    kota: row.kota == null ? null : String(row.kota),
    tingkat: row.tingkat == null ? null : String(row.tingkat),
    tahun_event: row.tahun_event == null ? null : Number(row.tahun_event),
    status_public: row.status_public == null ? null : String(row.status_public),
    result_kind: row.result_kind == null ? null : String(row.result_kind) as ContestResultKind,
    result_title: String(row.result_title || ''),
    position: row.position == null ? null : Number(row.position),
    category_name: row.category_name == null ? null : String(row.category_name),
    notes: row.notes == null ? null : String(row.notes),
    created_at: row.created_at == null ? null : String(row.created_at),
  };
}

export function createContestAchievementsRepository(client: SupabaseLike, state: ContestAchievementsMemoryState): ContestAchievementsRepository {
  return {
    isConfigured: () => client !== null,
    async list(query) {
      if (!client) {
        const needle = query.search?.toLowerCase();
        const filtered = state.achievements.filter((row) => {
          if (query.resultKind && row.result_kind !== query.resultKind) return false;
          if (query.position != null && row.position !== query.position) return false;
          if (query.outcomeStatus && row.outcome_status !== query.outcomeStatus) return false;
          if (query.tahunEvent != null && row.tahun_event !== query.tahunEvent) return false;
          if (!needle) return true;
          return [row.nama_lomba, row.work_title, row.result_title, row.category_name, row.kota].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle));
        });
        const from = (query.page - 1) * query.pageSize;
        const data = filtered.slice(from, from + query.pageSize);
        return { data, total: filtered.length, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(filtered.length / query.pageSize) || 1 };
      }
      const result = await client.rpc('list_contest_achievements', {
        p_search: query.search ?? null,
        p_result_kind: query.resultKind ?? null,
        p_position: query.position ?? null,
        p_outcome_status: query.outcomeStatus ?? null,
        p_tahun_event: query.tahunEvent ?? null,
        p_page: query.page,
        p_page_size: query.pageSize,
      });
      if (result.error) return { error: result.error };
      const payload = (result.data || {}) as { data?: DatabaseRow[]; total?: number; page?: number; pageSize?: number; totalPages?: number };
      return {
        data: (payload.data || []).map(mapRow),
        total: Number(payload.total || 0),
        page: Number(payload.page || query.page),
        pageSize: Number(payload.pageSize || query.pageSize),
        totalPages: Number(payload.totalPages || 1),
      };
    },
    async record(input) {
      if (!client) {
        const now = new Date().toISOString();
        const existing = state.achievements.find((row) => row.entry_id === input.entryId);
        const base = existing || {
          result_id: null,
          entry_id: input.entryId,
          contest_id: '',
          work_id: '',
          pipeline_status: 'selesai',
          outcome_status: input.outcomeStatus,
          work_title: '',
          work_type_code: '',
          nama_lomba: '',
          result_title: input.outcomeStatus === 'not_awarded' ? 'Tidak mendapat penghargaan' : input.results[0]?.result_title || '',
          result_kind: input.results[0]?.result_kind || null,
          position: input.results[0]?.position ?? null,
          category_name: input.results[0]?.category_name ?? null,
          notes: input.results[0]?.notes ?? null,
          created_at: now,
        };
        state.achievements = state.achievements.filter((row) => row.entry_id !== input.entryId);
        if (input.outcomeStatus === 'awarded') {
          for (const result of input.results) {
            state.achievements.push({
              ...base,
              result_id: randomUUID(),
              outcome_status: input.outcomeStatus,
              result_kind: result.result_kind,
              result_title: result.result_title,
              position: result.position ?? null,
              category_name: result.category_name ?? null,
              notes: result.notes ?? null,
            });
          }
        } else {
          state.achievements.push({ ...base, result_id: null, outcome_status: input.outcomeStatus, result_kind: null, result_title: input.outcomeStatus === 'not_awarded' ? 'Tidak mendapat penghargaan' : 'Menunggu hasil', position: null });
        }
        return { data: { entry: { id: input.entryId, outcome_status: input.outcomeStatus }, idempotent_replay: false } };
      }
      const result = await client.rpc('record_contest_entry_result_atomic', {
        p_entry_id: input.entryId,
        p_outcome_status: input.outcomeStatus,
        p_results: input.results,
        p_change_reason: input.changeReason,
        p_actor_id: input.actorId,
        p_idempotency_key: input.idempotencyKey,
        p_evidence_url: input.evidenceUrl ?? null,
      });
      if (result.error) return { error: result.error };
      return { data: result.data };
    },
  };
}
