-- 029_contest_frontend_contract.sql
-- Additive compatibility layer for the frontend contest presentation contract.
-- Legacy columns remain authoritative for existing clients; the *_public columns
-- preserve organizer-facing metadata without overloading `jenis` or `hasil`.

ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS nama_lomba TEXT,
  ADD COLUMN IF NOT EXISTS penyelenggara TEXT,
  ADD COLUMN IF NOT EXISTS tingkat TEXT,
  ADD COLUMN IF NOT EXISTS deadline DATE,
  ADD COLUMN IF NOT EXISTS status_public TEXT,
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS deskripsi TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contests_status_public_check'
      AND conrelid = 'public.contests'::regclass
  ) THEN
    ALTER TABLE public.contests
      ADD CONSTRAINT contests_status_public_check
      CHECK (status_public IS NULL OR status_public IN ('buka', 'proses_penjurian', 'selesai'));
  END IF;
END $$;

-- Backfill the presentation fields for historical rows. These values are
-- deterministic aliases, so this migration is safe to rerun.
UPDATE public.contests
SET
  nama_lomba = COALESCE(nama_lomba, nama),
  penyelenggara = COALESCE(penyelenggara, jenis),
  tingkat = COALESCE(
    tingkat,
    CASE level
      WHEN 'kabupaten' THEN 'Lokal'
      WHEN 'kota' THEN 'Lokal'
      WHEN 'provinsi' THEN 'Regional'
      WHEN 'nasional' THEN 'Nasional'
      WHEN 'internasional' THEN 'Internasional'
      ELSE level
    END
  ),
  deadline = COALESCE(deadline, tanggal),
  status_public = COALESCE(
    status_public,
    CASE
      WHEN status = 'selesai' THEN 'selesai'
      WHEN tanggal >= CURRENT_DATE THEN 'buka'
      ELSE 'proses_penjurian'
    END
  )
WHERE TRUE;

-- Legacy writers may continue to write only the original columns. This trigger
-- fills missing aliases and mirrors an intentional legacy-column update only
-- when the presentation value was still equal to the old value.
CREATE OR REPLACE FUNCTION public.sync_contest_frontend_contract()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.nama_lomba IS NULL OR (TG_OP = 'UPDATE' AND NEW.nama IS DISTINCT FROM OLD.nama AND NEW.nama_lomba = OLD.nama_lomba) THEN
    NEW.nama_lomba := NEW.nama;
  END IF;
  IF NEW.penyelenggara IS NULL OR (TG_OP = 'UPDATE' AND NEW.jenis IS DISTINCT FROM OLD.jenis AND NEW.penyelenggara = OLD.penyelenggara) THEN
    NEW.penyelenggara := NEW.jenis;
  END IF;
  IF NEW.tingkat IS NULL OR (TG_OP = 'UPDATE' AND NEW.level IS DISTINCT FROM OLD.level AND NEW.tingkat = OLD.tingkat) THEN
    NEW.tingkat := CASE NEW.level
      WHEN 'kabupaten' THEN 'Lokal'
      WHEN 'kota' THEN 'Lokal'
      WHEN 'provinsi' THEN 'Regional'
      WHEN 'nasional' THEN 'Nasional'
      WHEN 'internasional' THEN 'Internasional'
      ELSE NEW.level
    END;
  END IF;
  IF NEW.deadline IS NULL OR (TG_OP = 'UPDATE' AND NEW.tanggal IS DISTINCT FROM OLD.tanggal AND NEW.deadline = OLD.deadline) THEN
    NEW.deadline := NEW.tanggal;
  END IF;
  IF NEW.status_public IS NULL OR (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status_public = OLD.status_public) THEN
    NEW.status_public := CASE
      WHEN NEW.status = 'selesai' THEN 'selesai'
      WHEN NEW.tanggal >= CURRENT_DATE THEN 'buka'
      ELSE 'proses_penjurian'
    END;
  END IF;
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

-- Keep PostgREST aware of the new columns/table after deployment.
NOTIFY pgrst, 'reload schema';
