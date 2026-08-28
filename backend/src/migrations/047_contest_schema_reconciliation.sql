-- 047_contest_schema_reconciliation.sql
-- Reconcile the legacy contests table with the public frontend contract.
--
-- This migration is intentionally separate from 029_contest_frontend_contract.sql:
-- some deployments were created from the pre-004 schema where
-- nama_festival/tanggal_lomba are NOT NULL, so applying 029 alone leaves the
-- insert trigger unable to satisfy the legacy constraints.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.contests') IS NULL THEN
    RAISE EXCEPTION 'CONTEST_SCHEMA_BASE_MISSING: public.contests belum tersedia';
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.contest_migration_history (
  migration_name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS nama_lomba TEXT,
  ADD COLUMN IF NOT EXISTS penyelenggara TEXT,
  ADD COLUMN IF NOT EXISTS tingkat TEXT,
  ADD COLUMN IF NOT EXISTS deadline DATE,
  ADD COLUMN IF NOT EXISTS status_public TEXT,
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS deskripsi TEXT;

-- Fill the legacy and presentation aliases from whichever contract already
-- contains data. No rows are deleted and reruns are idempotent.
UPDATE public.contests AS c
SET
  nama = COALESCE(NULLIF(BTRIM(c.nama), ''), NULLIF(BTRIM(c.nama_lomba), ''), NULLIF(BTRIM(c.nama_festival), '')),
  nama_lomba = COALESCE(NULLIF(BTRIM(c.nama_lomba), ''), NULLIF(BTRIM(c.nama), ''), NULLIF(BTRIM(c.nama_festival), '')),
  nama_festival = COALESCE(NULLIF(BTRIM(c.nama_festival), ''), NULLIF(BTRIM(c.nama_lomba), ''), NULLIF(BTRIM(c.nama), '')),
  jenis = COALESCE(NULLIF(BTRIM(c.jenis), ''), NULLIF(BTRIM(c.penyelenggara), ''), 'Sinematografi'),
  penyelenggara = COALESCE(NULLIF(BTRIM(c.penyelenggara), ''), NULLIF(BTRIM(c.jenis), ''), 'Sinematografi'),
  level = COALESCE(NULLIF(BTRIM(c.level), ''), CASE LOWER(BTRIM(c.tingkat))
    WHEN 'lokal' THEN 'kabupaten'
    WHEN 'regional' THEN 'provinsi'
    WHEN 'nasional' THEN 'nasional'
    WHEN 'internasional' THEN 'internasional'
    ELSE NULLIF(BTRIM(c.tingkat), '')
  END),
  tingkat = COALESCE(NULLIF(BTRIM(c.tingkat), ''), CASE LOWER(BTRIM(c.level))
    WHEN 'kabupaten' THEN 'Lokal'
    WHEN 'kota' THEN 'Lokal'
    WHEN 'provinsi' THEN 'Regional'
    WHEN 'nasional' THEN 'Nasional'
    WHEN 'internasional' THEN 'Internasional'
    ELSE NULLIF(BTRIM(c.level), '')
  END),
  tanggal = COALESCE(c.tanggal, c.deadline, c.tanggal_lomba),
  deadline = COALESCE(c.deadline, c.tanggal, c.tanggal_lomba),
  tanggal_lomba = COALESCE(c.tanggal_lomba, c.deadline, c.tanggal),
  status_public = CASE
    WHEN LOWER(BTRIM(c.status_public)) IN ('buka', 'proses_penjurian', 'selesai') THEN LOWER(BTRIM(c.status_public))
    WHEN c.status::TEXT = 'selesai' THEN 'selesai'
    WHEN COALESCE(c.deadline, c.tanggal, c.tanggal_lomba) >= CURRENT_DATE THEN 'buka'
    ELSE 'proses_penjurian'
  END;

-- Existing installations have NOT NULL legacy columns. Fail before adding the
-- trigger/constraints if historical data cannot be reconciled safely.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.contests
    WHERE NULLIF(BTRIM(nama_festival), '') IS NULL
       OR tanggal_lomba IS NULL
  ) THEN
    RAISE EXCEPTION 'CONTEST_SCHEMA_BACKFILL_FAILED: nama_festival dan tanggal_lomba wajib memiliki nilai';
  END IF;
END;
$$;

ALTER TABLE public.contests
  DROP CONSTRAINT IF EXISTS contests_status_public_check;

ALTER TABLE public.contests
  ADD CONSTRAINT contests_status_public_check
  CHECK (status_public IS NULL OR status_public IN ('buka', 'proses_penjurian', 'selesai'));

-- Keep legacy and public writers consistent. On UPDATE, the field that changed
-- from its old value wins; this prevents a legacy edit from being overwritten
-- by a stale presentation alias.
CREATE OR REPLACE FUNCTION public.sync_contest_frontend_contract()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_name TEXT;
  v_organizer TEXT;
  v_level TEXT;
  v_date DATE;
  v_public_status TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.nama_lomba IS DISTINCT FROM OLD.nama_lomba THEN
    v_name := NEW.nama_lomba;
  ELSIF TG_OP = 'UPDATE' AND NEW.nama IS DISTINCT FROM OLD.nama THEN
    v_name := NEW.nama;
  ELSIF TG_OP = 'UPDATE' AND NEW.nama_festival IS DISTINCT FROM OLD.nama_festival THEN
    v_name := NEW.nama_festival;
  ELSE
    v_name := COALESCE(NEW.nama_lomba, NEW.nama, NEW.nama_festival);
  END IF;
  v_name := NULLIF(BTRIM(v_name), '');
  IF v_name IS NOT NULL THEN
    NEW.nama_lomba := v_name;
    NEW.nama := v_name;
    NEW.nama_festival := v_name;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.penyelenggara IS DISTINCT FROM OLD.penyelenggara THEN
    v_organizer := NEW.penyelenggara;
  ELSIF TG_OP = 'UPDATE' AND NEW.jenis IS DISTINCT FROM OLD.jenis THEN
    v_organizer := NEW.jenis;
  ELSE
    v_organizer := COALESCE(NEW.penyelenggara, NEW.jenis, 'Sinematografi');
  END IF;
  v_organizer := COALESCE(NULLIF(BTRIM(v_organizer), ''), 'Sinematografi');
  IF TG_OP = 'UPDATE' AND NEW.jenis IS DISTINCT FROM OLD.jenis
     AND NEW.penyelenggara IS NOT DISTINCT FROM OLD.penyelenggara THEN
    NEW.penyelenggara := v_organizer;
  ELSE
    NEW.penyelenggara := COALESCE(NULLIF(BTRIM(NEW.penyelenggara), ''), v_organizer);
  END IF;
  NEW.jenis := COALESCE(NULLIF(BTRIM(NEW.jenis), ''), v_organizer);

  IF TG_OP = 'UPDATE' AND NEW.tingkat IS DISTINCT FROM OLD.tingkat THEN
    v_level := NEW.tingkat;
  ELSIF TG_OP = 'UPDATE' AND NEW.level IS DISTINCT FROM OLD.level THEN
    v_level := NEW.level;
  ELSE
    v_level := COALESCE(NEW.tingkat, NEW.level);
  END IF;
  v_level := LOWER(NULLIF(BTRIM(v_level), ''));
  NEW.level := CASE v_level
    WHEN 'lokal' THEN 'kabupaten'
    WHEN 'regional' THEN 'provinsi'
    WHEN 'kabupaten' THEN 'kabupaten'
    WHEN 'kota' THEN 'kota'
    WHEN 'provinsi' THEN 'provinsi'
    WHEN 'nasional' THEN 'nasional'
    WHEN 'internasional' THEN 'internasional'
    ELSE v_level
  END;
  NEW.tingkat := CASE NEW.level
    WHEN 'kabupaten' THEN 'Lokal'
    WHEN 'kota' THEN 'Lokal'
    WHEN 'provinsi' THEN 'Regional'
    WHEN 'nasional' THEN 'Nasional'
    WHEN 'internasional' THEN 'Internasional'
    ELSE NEW.level
  END;

  IF TG_OP = 'UPDATE' AND NEW.deadline IS DISTINCT FROM OLD.deadline THEN
    v_date := NEW.deadline;
  ELSIF TG_OP = 'UPDATE' AND NEW.tanggal IS DISTINCT FROM OLD.tanggal THEN
    v_date := NEW.tanggal;
  ELSIF TG_OP = 'UPDATE' AND NEW.tanggal_lomba IS DISTINCT FROM OLD.tanggal_lomba THEN
    v_date := NEW.tanggal_lomba;
  ELSE
    v_date := COALESCE(NEW.deadline, NEW.tanggal, NEW.tanggal_lomba);
  END IF;
  NEW.deadline := v_date;
  NEW.tanggal := v_date;
  NEW.tanggal_lomba := v_date;

  IF TG_OP = 'UPDATE'
     AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status_public IS NOT DISTINCT FROM OLD.status_public THEN
    v_public_status := NULL;
  ELSE
    v_public_status := LOWER(BTRIM(NEW.status_public));
  END IF;
  NEW.status_public := CASE
    WHEN v_public_status IN ('buka', 'proses_penjurian', 'selesai') THEN v_public_status
    WHEN NEW.status::TEXT = 'selesai' THEN 'selesai'
    WHEN v_date >= CURRENT_DATE THEN 'buka'
    ELSE 'proses_penjurian'
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_contest_frontend_contract ON public.contests;
CREATE TRIGGER trg_sync_contest_frontend_contract
  BEFORE INSERT OR UPDATE ON public.contests
  FOR EACH ROW EXECUTE FUNCTION public.sync_contest_frontend_contract();

CREATE INDEX IF NOT EXISTS idx_contests_public_status_deadline_id
  ON public.contests (status_public, deadline DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_contests_public_level_deadline_id
  ON public.contests (tingkat, deadline DESC, id DESC);

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_contests_nama_lomba_trgm
  ON public.contests USING gin (nama_lomba gin_trgm_ops);

CREATE TABLE IF NOT EXISTS public.contest_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  film_id UUID REFERENCES public.film_works(id) ON DELETE SET NULL,
  judul_film TEXT NOT NULL CHECK (length(trim(judul_film)) > 0),
  sutradara_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  crew_members JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(crew_members) = 'array'),
  link_video TEXT NOT NULL,
  award_status TEXT NOT NULL,
  sertifikat_url TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_contest_submission_title UNIQUE (contest_id, judul_film)
);

CREATE INDEX IF NOT EXISTS idx_contest_submissions_contest_created_id
  ON public.contest_submissions (contest_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_contest_submissions_film_id
  ON public.contest_submissions (film_id)
  WHERE film_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contest_submissions_director_id
  ON public.contest_submissions (sutradara_id)
  WHERE sutradara_id IS NOT NULL;

INSERT INTO public.contest_migration_history (migration_name)
VALUES ('047_contest_schema_reconciliation.sql')
ON CONFLICT (migration_name) DO NOTHING;

NOTIFY pgrst, 'reload schema';

COMMIT;
