import type { SupabaseClient } from '@supabase/supabase-js';
import type { DatabaseRow } from '../../shared/database/database.types.js';
import { DEFAULT_FILMS, mapFilmWorkRow, normalizeFilmStatus } from './film-works.helpers.js';
import type { FilmWorkRecord, FilmWorksMemoryState, FilmWorksRepository } from './film-works.types.js';

type SupabaseLike = SupabaseClient | null;

export function createFilmWorksRepository(client: SupabaseLike, state: FilmWorksMemoryState): FilmWorksRepository {
  if (!client && state.films.length === 0) state.films.push(...DEFAULT_FILMS.map((film) => ({ ...film, crew: [...film.crew] })));
  return {
    isConfigured: () => client !== null,
    async list(status) {
      const normalizedStatus = normalizeFilmStatus(status);
      if (!client) return { data: state.films.filter((film) => !normalizedStatus || film.status === normalizedStatus) };
      let query = client.from('film_works').select([
        'id', 'judul', 'durasi_menit', 'genre', 'sinopsis', 'tahun_produksi',
        'thumbnail_url', 'video_url', 'status', 'created_at',
        'film_crew(role,students(nama))',
      ].join(','));
      if (normalizedStatus) query = query.eq('status', normalizedStatus);
      const result = await query.order('tahun_produksi', { ascending: false }).order('id', { ascending: false });
      if (result.error) return { error: result.error };
      return { data: (result.data || []).map((row) => mapFilmWorkRow(row as unknown as DatabaseRow)) };
    },
  };
}
