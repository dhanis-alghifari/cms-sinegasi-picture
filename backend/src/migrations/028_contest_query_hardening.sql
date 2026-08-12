-- Contest list and reporting indexes.
-- Apply after 004/006/017 so the domain tables and audit columns exist.

CREATE INDEX IF NOT EXISTS idx_contests_status_tanggal_id
  ON public.contests (status, tanggal DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_contests_level_tanggal_id
  ON public.contests (level, tanggal DESC, id DESC);

-- Supabase exposes pg_trgm in the managed Postgres service. The extension is
-- safe to create repeatedly and makes the existing contains-search usable as
-- the contest catalog grows; without it, `ilike '%term%'` becomes a table scan.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_contests_nama_trgm
  ON public.contests USING gin (nama gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_contest_films_contest_id
  ON public.contest_films (contest_id);

CREATE INDEX IF NOT EXISTS idx_contest_films_film_id
  ON public.contest_films (film_id);

CREATE INDEX IF NOT EXISTS idx_film_works_status_year_id
  ON public.film_works (status, tahun_produksi DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_film_crew_film_id
  ON public.film_crew (film_id);
