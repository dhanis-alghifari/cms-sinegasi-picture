import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import type { DatabaseRow } from '../../shared/database/database.types.js';
import type {
  ContestAchievementListResult,
  ContestAchievementAward,
  ContestAchievementDetail,
  ContestAchievementDetailEntry,
  ContestAchievementEvidence,
  ContestAchievementRecord,
  ContestAchievementTimelineItem,
  ContestAchievementsMemoryState,
  ContestAchievementsRepository,
  ContestEntryResultInput,
  ContestOutcomeStatus,
  ContestResultKind,
} from './contest-achievements.types.js';

type SupabaseLike = SupabaseClient | null;

function mapRow(row: DatabaseRow): ContestAchievementRecord {
  const awards = Array.isArray(row.awards)
    ? (row.awards as unknown[]).filter((award): award is DatabaseRow => Boolean(award && typeof award === 'object')).map(mapAward)
    : row.result_id
      ? [mapAward(row)]
      : [];
  return {
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
    completed_at: row.completed_at == null ? null : String(row.completed_at),
    evidence_count: row.evidence_count == null ? 0 : Number(row.evidence_count),
    awards,
    created_at: row.created_at == null ? null : String(row.created_at),
  };
}

function mapAward(row: DatabaseRow): ContestAchievementAward {
  return {
    id: String(row.id ?? row.result_id ?? ''),
    result_kind: String(row.result_kind || 'other') as ContestResultKind,
    result_title: String(row.result_title || ''),
    position: row.position == null ? null : Number(row.position),
    category_name: row.category_name == null ? null : String(row.category_name),
    notes: row.notes == null ? null : String(row.notes),
    created_at: row.created_at == null ? null : String(row.created_at),
  };
}

function mapEvidence(row: DatabaseRow): ContestAchievementEvidence {
  return {
    id: String(row.id),
    evidence_type: String(row.evidence_type) as ContestAchievementEvidence['evidence_type'],
    target_status: row.target_status == null ? null : String(row.target_status) as ContestAchievementEvidence['target_status'],
    original_filename: row.original_filename == null ? null : String(row.original_filename),
    mime_type: row.mime_type == null ? null : String(row.mime_type),
    file_size_bytes: row.file_size_bytes == null ? null : Number(row.file_size_bytes),
    created_at: row.created_at == null ? null : String(row.created_at),
  };
}

function mapTimeline(row: DatabaseRow): ContestAchievementTimelineItem {
  return {
    id: String(row.id),
    kind: String(row.kind) as ContestAchievementTimelineItem['kind'],
    status: row.status == null ? null : String(row.status),
    from_status: row.from_status == null ? null : String(row.from_status),
    to_status: row.to_status == null ? null : String(row.to_status),
    change_reason: String(row.change_reason || ''),
    changed_by: row.changed_by == null ? null : String(row.changed_by),
    changed_by_name: row.changed_by_name == null ? null : String(row.changed_by_name),
    created_at: row.created_at == null ? null : String(row.created_at),
  };
}

function getMemoryAwards(row: ContestAchievementRecord): ContestAchievementAward[] {
  if (row.awards.length > 0) return row.awards;
  if (row.result_id) return [mapAward(row as unknown as DatabaseRow)];
  return [];
}

function matchesAchievementSearch(row: ContestAchievementRecord, needle: string): boolean {
  const searchableValues = [row.nama_lomba, row.work_title, row.kota];
  if (row.outcome_status === 'not_awarded') searchableValues.push('Tidak mendapat penghargaan');

  for (const award of row.awards) {
    searchableValues.push(award.result_title, award.category_name);
    if (award.result_kind === 'rank' && award.position != null) searchableValues.push(`Juara ${award.position}`);
    if (award.result_kind === 'top_n' && award.position != null) searchableValues.push(`${award.position} besar`);
  }

  return searchableValues
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(needle));
}

function mapDetail(payload: DatabaseRow): ContestAchievementDetail {
  const rawEntry = (payload.entry || {}) as DatabaseRow;
  const rawWork = (rawEntry.work || {}) as DatabaseRow;
  const rawContest = (rawEntry.contest || {}) as DatabaseRow;
  const entry: ContestAchievementDetailEntry = {
    id: String(rawEntry.id || ''),
    contest_id: String(rawEntry.contest_id || ''),
    work_id: String(rawEntry.work_id || ''),
    pipeline_status: String(rawEntry.pipeline_status || ''),
    outcome_status: String(rawEntry.outcome_status || 'pending') as ContestOutcomeStatus,
    result_label: rawEntry.result_label == null ? null : String(rawEntry.result_label),
    result_note: rawEntry.result_note == null ? null : String(rawEntry.result_note),
    submitted_at: rawEntry.submitted_at == null ? null : String(rawEntry.submitted_at),
    completed_at: rawEntry.completed_at == null ? null : String(rawEntry.completed_at),
    work: {
      id: String(rawWork.id || ''),
      title: String(rawWork.title || ''),
      work_type_code: String(rawWork.work_type_code || ''),
      description: rawWork.description == null ? null : String(rawWork.description),
      duration_minutes: rawWork.duration_minutes == null ? null : Number(rawWork.duration_minutes),
      production_year: rawWork.production_year == null ? null : Number(rawWork.production_year),
      primary_asset_url: rawWork.primary_asset_url == null ? null : String(rawWork.primary_asset_url),
      video_url: rawWork.video_url == null ? null : String(rawWork.video_url),
    },
    contest: {
      id: String(rawContest.id || ''),
      nama_lomba: String(rawContest.nama_lomba || ''),
      kota: rawContest.kota == null ? null : String(rawContest.kota),
      tingkat: rawContest.tingkat == null ? null : String(rawContest.tingkat),
      tahun_event: rawContest.tahun_event == null ? null : Number(rawContest.tahun_event),
      status_public: rawContest.status_public == null ? null : String(rawContest.status_public),
    },
  };
  return {
    entry,
    awards: Array.isArray(payload.awards)
      ? (payload.awards as unknown[]).filter((item): item is DatabaseRow => Boolean(item && typeof item === 'object')).map(mapAward)
      : [],
    evidence: Array.isArray(payload.evidence)
      ? (payload.evidence as unknown[]).filter((item): item is DatabaseRow => Boolean(item && typeof item === 'object')).map(mapEvidence)
      : [],
    timeline: Array.isArray(payload.timeline)
      ? (payload.timeline as unknown[]).filter((item): item is DatabaseRow => Boolean(item && typeof item === 'object')).map(mapTimeline)
      : [],
  };
}

export function createContestAchievementsRepository(client: SupabaseLike, state: ContestAchievementsMemoryState): ContestAchievementsRepository {
  return {
    isConfigured: () => client !== null,
    async list(query) {
      if (!client) {
        const needle = query.search?.toLowerCase();
        const rowsByEntry = new Map<string, ContestAchievementRecord>();
        for (const row of state.achievements) {
          if (row.pipeline_status !== 'selesai') continue;
          const current = rowsByEntry.get(row.entry_id);
          if (current) {
            if (row.result_id) current.awards.push(mapAward(row as unknown as DatabaseRow));
            continue;
          }
          rowsByEntry.set(row.entry_id, {
            ...row,
            awards: getMemoryAwards(row),
            evidence_count: row.evidence_count ?? 0,
          });
        }
        const filtered = [...rowsByEntry.values()].filter((row) => {
          const matchesAward = row.awards.some((award) => {
            if (query.resultKind && award.result_kind !== query.resultKind) return false;
            if (query.position != null && award.position !== query.position) return false;
            return true;
          });
          if (query.resultKind && !matchesAward) return false;
          if (query.position != null && !matchesAward) return false;
          if (query.outcomeStatus && row.outcome_status !== query.outcomeStatus) return false;
          if (query.tahunEvent != null && row.tahun_event !== query.tahunEvent) return false;
          if (!needle) return true;
          return matchesAchievementSearch(row, needle);
        });
        const from = (query.page - 1) * query.pageSize;
        const data = filtered.slice(from, from + query.pageSize);
        return { data, total: filtered.length, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(filtered.length / query.pageSize) || 1 };
      }
      const result = await client.rpc('list_contest_achievements_grouped', {
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
    async getDetail(entryId) {
      if (!client) {
        const rows = state.achievements.filter((row) => row.entry_id === entryId && row.pipeline_status === 'selesai');
        if (rows.length === 0) return { data: null };
        const row = rows[0];
        const entry = {
          id: row.entry_id,
          contest_id: row.contest_id,
          work_id: row.work_id,
          pipeline_status: row.pipeline_status,
          outcome_status: row.outcome_status,
          result_label: row.result_title,
          result_note: row.notes ?? null,
          submitted_at: null,
          completed_at: row.completed_at ?? null,
          work: {
            id: row.work_id,
            title: row.work_title,
            work_type_code: row.work_type_code,
          },
          contest: {
            id: row.contest_id,
            nama_lomba: row.nama_lomba,
            kota: row.kota ?? null,
            tingkat: row.tingkat ?? null,
            tahun_event: row.tahun_event ?? null,
            status_public: row.status_public ?? null,
          },
        };
        const awards = rows.filter((achievement) => achievement.result_id).map((achievement) => mapAward(achievement as unknown as DatabaseRow));
        return { data: { entry, awards, evidence: [], timeline: [] } };
      }
      const result = await client.rpc('get_contest_achievement_detail', { p_entry_id: entryId });
      if (result.error) return { error: result.error };
      if (!result.data) return { data: null };
      return { data: mapDetail(result.data as unknown as DatabaseRow) };
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
          evidence_count: 0,
          awards: [],
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
