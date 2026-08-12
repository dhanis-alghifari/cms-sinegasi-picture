import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CLASS_SELECT,
  CLASS_OPTIONS_LIMIT_MAX,
  mapClassRow,
  mapClassOption,
  mapMemoryClass,
  parseClassPagination,
  sanitizeClassSearch,
} from './classes.helpers.js';
import type {
  ClassListResult,
  ClassesMemoryState,
  ClassesRepository,
  RepositoryResult,
  ClassAccount,
  ClassOption,
} from './classes.types.js';

type SupabaseLike = SupabaseClient | null;

export function createClassesRepository(client: SupabaseLike, state: ClassesMemoryState): ClassesRepository {
  return {
    isConfigured: () => client !== null,

    async list(query): Promise<RepositoryResult<ClassListResult>> {
      const { page, pageSize, from, to } = parseClassPagination(query.page, query.pageSize);
      const search = sanitizeClassSearch(query.search).toLowerCase();
      if (!client) {
        let rows = state.classes.filter((item) => {
          const matchesSearch = !search || item.nama_kelas.toLowerCase().includes(search);
          const matchesLevel = !query.tingkat || query.tingkat === 'all' || item.tingkat === query.tingkat;
          const matchesStatus = query.isActive === undefined || item.is_active === query.isActive;
          return matchesSearch && matchesLevel && matchesStatus;
        });
        rows = rows.sort((left, right) => left.nama_kelas.localeCompare(right.nama_kelas) || left.id.localeCompare(right.id));
        const total = rows.length;
        return {
          data: {
            data: rows.slice(from, to + 1).map(mapMemoryClass),
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize) || 1,
          },
        };
      }

      let queryBuilder = client.from('classes').select(CLASS_SELECT, { count: 'exact' });
      if (search) queryBuilder = queryBuilder.ilike('nama_kelas', `%${search}%`);
      if (query.tingkat && query.tingkat !== 'all') queryBuilder = queryBuilder.eq('tingkat', query.tingkat);
      if (query.isActive !== undefined) queryBuilder = queryBuilder.eq('is_active', query.isActive);
      const result = await queryBuilder
        .order('nama_kelas', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to);
      if (result.error) return { error: result.error };
      const data = (result.data || []).map((row: Record<string, unknown>) => mapClassRow(row));
      const total = result.count ?? data.length;
      return { data: { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 } };
    },

    async listActiveOptions(): Promise<RepositoryResult<ClassOption[]>> {
      if (!client) return {
        data: state.classes
          .filter((item) => item.is_active)
          .sort((left, right) => left.nama_kelas.localeCompare(right.nama_kelas))
          .slice(0, CLASS_OPTIONS_LIMIT_MAX)
          .map(mapClassOption),
      };
      const result = await client
        .from('classes')
        .select('id,nama_kelas,tingkat')
        .eq('is_active', true)
        .order('nama_kelas', { ascending: true })
        .order('id', { ascending: true })
        .limit(CLASS_OPTIONS_LIMIT_MAX);
      if (result.error) return { error: result.error };
      return { data: (result.data || []).map((row: Record<string, unknown>) => mapClassOption(row)) };
    },

    async create(input): Promise<RepositoryResult<ClassAccount>> {
      if (!client) {
        const now = new Date().toISOString();
        const record: ClassAccount = {
          id: crypto.randomUUID(),
          nama_kelas: input.nama_kelas,
          tingkat: input.tingkat,
          is_active: true,
          created_at: now,
          ...(input.actorId ? { created_by: input.actorId, updated_by: input.actorId } : {}),
          ...(input.actorId ? { updated_at: now } : {}),
        };
        if (state.classes.some((item) => item.nama_kelas.toLowerCase() === record.nama_kelas.toLowerCase())) {
          return { error: { code: '23505' } };
        }
        state.classes.push(record);
        return { data: mapMemoryClass(record) };
      }
      const now = new Date().toISOString();
      const result = await client.from('classes').insert([{
        nama_kelas: input.nama_kelas,
        tingkat: input.tingkat,
        is_active: true,
        created_by: input.actorId,
        updated_by: input.actorId,
        updated_at: now,
      }]).select(CLASS_SELECT).single();
      if (result.error) return { error: result.error };
      return { data: mapClassRow(result.data as Record<string, unknown>) };
    },

    async update(id, changes, actorId): Promise<RepositoryResult<ClassAccount | null>> {
      if (!client) {
        const index = state.classes.findIndex((item) => item.id === id);
        if (index === -1) return { data: null };
        if (changes.nama_kelas && state.classes.some((item, itemIndex) => itemIndex !== index && item.nama_kelas.toLowerCase() === changes.nama_kelas!.toLowerCase())) {
          return { error: { code: '23505' } };
        }
        const current = state.classes[index];
        const now = new Date().toISOString();
        state.classes[index] = { ...current, ...changes, updated_at: now, ...(actorId ? { updated_by: actorId } : {}) };
        return { data: mapMemoryClass(state.classes[index]) };
      }
      const payload = { ...changes, updated_by: actorId, updated_at: new Date().toISOString() };
      const result = await client.from('classes').update(payload).eq('id', id).select(CLASS_SELECT).maybeSingle();
      if (result.error) return { error: result.error };
      return { data: result.data ? mapClassRow(result.data as Record<string, unknown>) : null };
    },
  };
}
