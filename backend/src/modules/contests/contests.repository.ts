import type { SupabaseClient } from '@supabase/supabase-js';
import { databaseErrorCode } from '../../shared/database/database.types.js';
import type { DatabaseRow } from '../../shared/database/database.types.js';
import {
  DEFAULT_CONTESTS,
  DEFAULT_WIN_RATE,
  mapContestRow,
  normalizeContestScope,
  normalizeContestStatus,
  normalizeStatus,
  parsePagination,
  sanitizeContestSearch,
  toPublicContestLevel,
} from './contests.helpers.js';
import type {
  ContestListQuery,
  ContestMemoryState,
  ContestRecord,
  ContestRepository,
  ContestSubmissionRecord,
} from './contests.types.js';

type SupabaseLike = SupabaseClient | null;

function rowText(value: unknown): string | undefined {
  return value == null ? undefined : String(value);
}

function rowNullableText(value: unknown): string | null {
  return value == null ? null : String(value);
}

const CONTEST_SELECT = [
  'id', 'nama', 'jenis', 'level', 'tanggal', 'status', 'hasil', 'piala_url',
  'juara', 'kategori_penghargaan', 'catatan', 'created_by', 'created_at',
  'updated_by', 'updated_at', 'nama_lomba', 'penyelenggara', 'tingkat',
  'deadline', 'status_public', 'website_url', 'deskripsi', 'kota', 'tahun_event', 'planned_work_count', 'academic_year',
].join(',');

const SUBMISSION_SELECT = [
  'id', 'contest_id', 'film_id', 'judul_film', 'sutradara_id', 'crew_members',
  'link_video', 'award_status', 'sertifikat_url', 'created_by', 'created_at',
].join(',');
const WIN_RATE_SELECT = 'tahun,level,total_lomba,total_selesai,total_menang,win_rate_persen';

function isMissingSchemaError(error: unknown): boolean {
  return ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(databaseErrorCode(error) || '');
}

function emptySummary() {
  return {
    total: 0,
    selesai: 0,
    progres: 0,
    menang: 0,
    winRate: 0,
    totalLomba: 0,
    lombaAktif: 0,
    totalKaryaSubmitted: 0,
    totalPrestasiJuara: 0,
  };
}

export function createContestsRepository(client: SupabaseLike, state: ContestMemoryState): ContestRepository {
  if (!client && state.contests.length === 0) {
    state.contests.push(...DEFAULT_CONTESTS.map((contest) => ({ ...contest })));
  }

  return {
    isConfigured: () => client !== null,

    async list(query: ContestListQuery) {
      const { page, pageSize, from, to } = parsePagination(query);
      const rawStatus = normalizeStatus(query.status);
      const status = normalizeContestStatus(rawStatus);
      const statusPublic = rawStatus === 'buka' || rawStatus === 'proses_penjurian' || rawStatus === 'selesai'
        ? rawStatus
        : undefined;
      const scope = normalizeContestScope(query.tingkat);
      const search = sanitizeContestSearch(query.search);
      const eventYear = query.tahun_event ? Number.parseInt(query.tahun_event, 10) : undefined;

      if (!client) {
        const rows = state.contests.filter((row) => {
          const matchesSearch = !search
            || [row.nama, row.nama_lomba, row.kota].join(' ').toLowerCase().includes(search.toLowerCase());
          const matchesStatus = !status
            || (statusPublic ? row.status_public === statusPublic || (!row.status_public && row.status === status) : row.status === status);
          const matchesYear = eventYear === undefined || row.tahun_event === eventYear;
          return matchesStatus && (!scope || toPublicContestLevel(row.tingkat ?? row.level) === scope) && matchesSearch && matchesYear;
        });
        const data = rows.slice(from, to + 1).map((row) => mapContestRow(row as unknown as DatabaseRow));
        for (const row of data) {
          const submissions = state.submissions.filter((submission) => submission.contest_id === row.id);
          row.submissions = submissions;
          row.submission_count = submissions.length;
        }
        return {
          data,
          total: rows.length,
          page,
          pageSize,
          totalPages: Math.ceil(rows.length / pageSize) || 1,
        };
      }

      let dbQuery = client.from('contests').select(CONTEST_SELECT, { count: 'exact' });
      if (statusPublic) dbQuery = dbQuery.eq('status_public', statusPublic);
      else if (status) dbQuery = dbQuery.eq('status', status);
      if (scope) dbQuery = dbQuery.eq('tingkat', scope);
      if (eventYear !== undefined && Number.isInteger(eventYear)) dbQuery = dbQuery.eq('tahun_event', eventYear);
      if (search) dbQuery = dbQuery.or(`nama.ilike.%${search}%,nama_lomba.ilike.%${search}%,kota.ilike.%${search}%`);

      const result = await dbQuery
        .order('deadline', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to);
      if (result.error) return { error: result.error };

      const data = (result.data || []).map((row) => mapContestRow(row as unknown as DatabaseRow));
      const contestIds = data.map((row: ContestRecord) => row.id);
      if (contestIds.length > 0) {
        const [richSubmissionsResult, legacySubmissionsResult, genericEntriesResult] = await Promise.all([
          client.from('contest_submissions')
            .select(SUBMISSION_SELECT)
            .in('contest_id', contestIds)
            .order('created_at', { ascending: false }),
          client.from('contest_films')
            .select('id,contest_id,film_id,created_by,created_at')
            .in('contest_id', contestIds)
            .order('created_at', { ascending: false }),
          client.from('contest_entries')
            .select('id,contest_id')
            .in('contest_id', contestIds),
        ]);
        const failedResult = [richSubmissionsResult, legacySubmissionsResult, genericEntriesResult]
          .find((item) => item.error && !isMissingSchemaError(item.error));
        if (failedResult?.error) return { error: failedResult.error };

        const grouped = new Map<string, ContestSubmissionRecord[]>();
        for (const row of (richSubmissionsResult.data || []) as unknown as DatabaseRow[]) {
          const submission: ContestSubmissionRecord = {
            id: String(row.id),
            contest_id: String(row.contest_id),
            film_id: rowNullableText(row.film_id),
            judul_film: rowText(row.judul_film),
            sutradara_id: rowNullableText(row.sutradara_id),
            crew_members: Array.isArray(row.crew_members) ? row.crew_members.filter((value): value is string => typeof value === 'string') : [],
            link_video: rowNullableText(row.link_video),
            award_status: rowNullableText(row.award_status),
            sertifikat_url: rowNullableText(row.sertifikat_url),
            created_by: rowNullableText(row.created_by),
            created_at: rowText(row.created_at),
          };
          const existing = grouped.get(submission.contest_id) || [];
          existing.push(submission);
          grouped.set(submission.contest_id, existing);
        }
        for (const row of (legacySubmissionsResult.data || []) as unknown as DatabaseRow[]) {
          const submission: ContestSubmissionRecord = {
            id: String(row.id),
            contest_id: String(row.contest_id),
            film_id: rowText(row.film_id) || '',
            created_by: rowNullableText(row.created_by),
            created_at: rowText(row.created_at),
          };
          const existing = grouped.get(submission.contest_id) || [];
          if (!existing.some((item) => item.film_id === submission.film_id)) existing.push(submission);
          grouped.set(submission.contest_id, existing);
        }
        for (const row of data) {
          const submissions = grouped.get(row.id) || [];
          row.submissions = submissions;
          row.submission_count = submissions.length;
          row.entry_count = genericEntriesResult.error ? undefined : ((genericEntriesResult.data || []) as unknown as DatabaseRow[]).filter((entry) => String(entry.contest_id) === row.id).length;
        }
      }
      const total = result.count ?? data.length;
      return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 };
    },

    async summary() {
      if (!client) {
        const total = state.contests.length;
        const selesai = state.contests.filter((row) => row.status === 'selesai').length;
        const progres = state.contests.filter((row) => row.status === 'progres').length;
        const menang = state.contests.filter((row) => row.status === 'selesai' && (row.hasil || row.juara)).length;
        const totalKaryaSubmitted = state.submissions.length;
        return {
          data: {
            total,
            selesai,
            progres,
            menang,
            winRate: selesai > 0 ? Math.round(menang / selesai * 100) : 0,
            totalLomba: total,
            lombaAktif: Math.max(0, total - selesai),
            totalKaryaSubmitted,
            totalPrestasiJuara: menang,
          },
        };
      }

      const [total, selesai, progres, menang, contestFilms, contestSubmissions, genericEntries, genericAwards] = await Promise.all([
        client.from('contests').select('id', { count: 'exact', head: true }),
        client.from('contests').select('id', { count: 'exact', head: true }).eq('status', 'selesai'),
        client.from('contests').select('id', { count: 'exact', head: true }).eq('status', 'progres'),
        client.from('contests').select('id', { count: 'exact', head: true })
          .eq('status', 'selesai').or('hasil.not.is.null,juara.not.is.null'),
        client.from('contest_films').select('id', { count: 'exact', head: true }),
        client.from('contest_submissions').select('id', { count: 'exact', head: true }),
        client.from('contest_entries').select('id', { count: 'exact', head: true }),
        client.from('contest_entries').select('id', { count: 'exact', head: true }).eq('outcome_status', 'awarded'),
      ]);
      const failed = [total, selesai, progres, menang, contestFilms, contestSubmissions, genericEntries, genericAwards]
        .find((result) => result.error && !isMissingSchemaError(result.error));
      if (failed?.error) return { error: failed.error };

      const totalCount = total.count ?? 0;
      const selesaiCount = selesai.count ?? 0;
      const menangCount = genericAwards.error ? (menang.count ?? 0) : (genericAwards.count ?? 0);
      const submittedCount = genericEntries.error
        ? (contestFilms.count ?? 0) + (contestSubmissions.count ?? 0)
        : (genericEntries.count ?? 0);
      return {
        data: {
          total: totalCount,
          selesai: selesaiCount,
          progres: progres.count ?? 0,
          menang: menangCount,
          winRate: selesaiCount > 0 ? Math.round(menangCount / selesaiCount * 100) : 0,
          totalLomba: totalCount,
          lombaAktif: Math.max(0, totalCount - selesaiCount),
          totalKaryaSubmitted: submittedCount,
          totalPrestasiJuara: menangCount,
        },
      };
    },

    async winRate(tahun) {
      if (!client) {
        const data = DEFAULT_WIN_RATE.filter((row) => tahun === undefined || row.tahun === tahun);
        const overall = data.reduce(
          (acc, row) => ({
            totalLomba: acc.totalLomba + row.totalLomba,
            totalMenang: acc.totalMenang + row.totalMenang,
            totalSelesai: acc.totalSelesai + row.totalSelesai,
          }),
          { totalLomba: 0, totalMenang: 0, totalSelesai: 0 },
        );
        return {
          overall: {
            ...overall,
            winRatePersen: overall.totalSelesai > 0
              ? Math.round(overall.totalMenang / overall.totalSelesai * 1000) / 10
              : 0,
          },
          data,
        };
      }

      let dbQuery = client.from('v_contest_win_rate').select(WIN_RATE_SELECT);
      if (tahun !== undefined) dbQuery = dbQuery.eq('tahun', tahun);
      const result = await dbQuery;
      if (result.error) return { error: result.error };

      const data = (result.data || []).map((row: DatabaseRow) => ({
        tahun: Number(row.tahun),
        level: String(row.level),
        totalLomba: Number(row.total_lomba || 0),
        totalSelesai: Number(row.total_selesai || 0),
        totalMenang: Number(row.total_menang || 0),
        winRatePersen: Number(row.win_rate_persen || 0),
      }));
      const overall = data.reduce(
        (acc: { totalLomba: number; totalMenang: number; totalSelesai: number }, row: typeof data[number]) => ({
          totalLomba: acc.totalLomba + row.totalLomba,
          totalMenang: acc.totalMenang + row.totalMenang,
          totalSelesai: acc.totalSelesai + row.totalSelesai,
        }),
        { totalLomba: 0, totalMenang: 0, totalSelesai: 0 },
      );
      return {
        overall: {
          ...overall,
          winRatePersen: overall.totalSelesai > 0
            ? Math.round(overall.totalMenang / overall.totalSelesai * 1000) / 10
            : 0,
        },
        data,
      };
    },

    async create(input) {
      if (!client) {
        const record: ContestRecord = {
          id: 'cnt-' + Date.now(),
          nama: input.nama,
          jenis: input.jenis,
          level: input.level,
          tanggal: input.tanggal,
          status: input.status,
          status_public: input.statusPublic ?? null,
          hasil: input.hasil,
          nama_lomba: input.namaLomba ?? input.nama,
          penyelenggara: input.penyelenggara ?? input.jenis,
          kota: input.kota ?? null,
          tingkat: input.tingkat ?? undefined,
          deadline: input.deadline ?? input.tanggal,
          tahun_event: input.tahunEvent ?? Number(input.academicYear ?? new Date().getFullYear()),
          website_url: input.websiteUrl ?? null,
          deskripsi: input.deskripsi ?? null,
          planned_work_count: input.plannedWorkCount ?? null,
          academic_year: input.academicYear ?? new Date().getFullYear().toString(),
          created_by: input.actorId,
          created_at: new Date().toISOString(),
        };
        state.contests.unshift(record);
        return { data: record };
      }

      const result = await client.from('contests').insert([{
        nama: input.nama,
        nama_festival: input.nama,
        jenis: input.jenis,
        level: input.level,
        tanggal: input.tanggal,
        tanggal_lomba: input.tanggal,
        status: input.status,
        hasil: input.hasil,
        nama_lomba: input.namaLomba,
        penyelenggara: input.penyelenggara,
        kota: input.kota,
        tingkat: input.tingkat,
        deadline: input.deadline,
        tahun_event: input.tahunEvent,
        status_public: input.statusPublic,
        website_url: input.websiteUrl,
        deskripsi: input.deskripsi,
        planned_work_count: input.plannedWorkCount,
        academic_year: input.academicYear,
        ...(input.actorId ? { created_by: input.actorId } : {}),
      }]).select(CONTEST_SELECT).single();
      if (result.error) return { error: result.error };
      return { data: mapContestRow(result.data as unknown as DatabaseRow) };
    },

    async update(id, input) {
      if (!client) {
        const index = state.contests.findIndex((row) => row.id === id);
        if (index < 0) return { data: null };
        state.contests[index] = {
          ...state.contests[index],
          ...input.changes,
          ...(input.actorId ? { updated_by: input.actorId } : {}),
          updated_at: new Date().toISOString(),
        };
        return { data: state.contests[index] };
      }

      const result = await client.rpc('update_contest_atomic', {
        p_contest_id: id,
        p_changes: input.changes,
        p_updated_by: input.actorId,
        p_change_reason: input.changeReason,
        p_request_id: input.auditContext?.requestId || null,
        p_operation_id: input.auditContext?.operationId || null,
        p_user_agent: input.auditContext?.userAgent || null,
      }).maybeSingle();
      if (result.error) return { error: result.error };
      return { data: result.data ? mapContestRow(result.data as unknown as DatabaseRow) : null };
    },

    async submit(input) {
      if (!client) {
        const duplicate = state.submissions.find((row) => row.contest_id === input.contestId && (
          (input.filmId && row.film_id === input.filmId)
          || (input.judulFilm && row.judul_film === input.judulFilm)
        ));
        if (duplicate) return { error: { code: '23505' } };
        const record: ContestSubmissionRecord = {
          id: 'sub-' + Date.now(),
          contest_id: input.contestId,
          film_id: input.filmId ?? null,
          judul_film: input.judulFilm,
          sutradara_id: input.sutradaraId ?? null,
          crew_members: input.crewMembers || [],
          link_video: input.linkVideo ?? null,
          award_status: input.awardStatus ?? null,
          sertifikat_url: input.sertifikatUrl ?? null,
          created_by: input.actorId,
          created_at: new Date().toISOString(),
        };
        state.submissions.push(record);
        return { data: record };
      }

      if (input.judulFilm) {
        const result = await client.from('contest_submissions').insert([{
          contest_id: input.contestId,
          film_id: input.filmId ?? null,
          judul_film: input.judulFilm,
          sutradara_id: input.sutradaraId ?? null,
          crew_members: input.crewMembers || [],
          link_video: input.linkVideo ?? null,
          award_status: input.awardStatus ?? null,
          sertifikat_url: input.sertifikatUrl ?? null,
          ...(input.actorId ? { created_by: input.actorId } : {}),
        }]).select(SUBMISSION_SELECT).single();
        if (result.error) return { error: result.error };
        return { data: result.data as unknown as ContestSubmissionRecord };
      }

      const result = await client.from('contest_films').insert([{
        contest_id: input.contestId,
        film_id: input.filmId,
        ...(input.actorId ? { created_by: input.actorId } : {}),
      }]).select('id,contest_id,film_id,created_by,created_at').single();
      if (result.error) return { error: result.error };
      return { data: result.data as ContestSubmissionRecord };
    },
  };
}
