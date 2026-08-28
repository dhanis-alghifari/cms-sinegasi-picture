-- 052_contest_scope_contract.sql
-- Canonical public contest scope values and label-safe legacy compatibility.
-- Run after 047_contest_schema_reconciliation.sql and 049_contest_event_contract.sql.

BEGIN;

-- The backfill is an auditable system operation. The setting is transaction-local.
SELECT set_config('app.system_operation', 'true', true);
SELECT set_config('app.change_reason', 'SYSTEM:MIGRATION_052_CONTEST_SCOPE_BACKFILL', true);

DO $$
BEGIN
  IF to_regclass('public.contests') IS NULL THEN
    RAISE EXCEPTION 'CONTEST_SCHEMA_BASE_MISSING: public.contests belum tersedia';
  END IF;
  IF to_regclass('public.contest_migration_history') IS NULL THEN
    RAISE EXCEPTION 'CONTEST_MIGRATION_HISTORY_MISSING: jalankan migration 047 terlebih dahulu';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.contest_scope_from_legacy(p_value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  -- Legacy values have no exact equivalent for every new product scope.
  -- Keep the canonical tingkat column authoritative; level is only a
  -- compatibility projection for old reports and writers. The retired
  -- internasional value is retained under the broad Umum bucket because the
  -- new contract intentionally has no international scope option.
  SELECT CASE lower(btrim(p_value))
    WHEN 'bekasi' THEN 'bekasi'
    WHEN 'jabodetabek' THEN 'jabodetabek'
    WHEN 'jawa_barat' THEN 'jawa_barat'
    WHEN 'provinsi_jawa_barat' THEN 'jawa_barat'
    WHEN 'nasional' THEN 'nasional'
    WHEN 'umum' THEN 'umum'
    WHEN 'lokal' THEN 'bekasi'
    WHEN 'kabupaten' THEN 'bekasi'
    WHEN 'kota' THEN 'bekasi'
    WHEN 'regional' THEN 'jawa_barat'
    WHEN 'provinsi' THEN 'jawa_barat'
    WHEN 'internasional' THEN 'umum'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.contest_legacy_level_from_scope(p_scope TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  -- Jabodetabek/Jawa Barat share the legacy provinsi bucket, while Umum and
  -- Nasional share the legacy nasional bucket. New API filters use tingkat.
  SELECT CASE lower(btrim(p_scope))
    WHEN 'bekasi' THEN 'kota'
    WHEN 'jabodetabek' THEN 'provinsi'
    WHEN 'jawa_barat' THEN 'provinsi'
    WHEN 'nasional' THEN 'nasional'
    WHEN 'umum' THEN 'nasional'
    ELSE NULL
  END;
$$;

-- 047's trigger projects NEW.tingkat into the old enum before this migration
-- can backfill canonical scope codes. Remove it only for this transaction;
-- the canonical trigger is recreated below before COMMIT.
DROP TRIGGER IF EXISTS trg_sync_contest_frontend_contract ON public.contests;

-- Refuse unknown historical values rather than silently inventing a scope.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.contests
    WHERE public.contest_scope_from_legacy(COALESCE(NULLIF(btrim(tingkat), ''), level)) IS NULL
  ) THEN
    RAISE EXCEPTION 'MIGRATION_PREFLIGHT_FAILED: ditemukan tingkat lomba lama yang tidak dapat dipetakan';
  END IF;
END;
$$;

UPDATE public.contests
SET tingkat = public.contest_scope_from_legacy(COALESCE(NULLIF(btrim(tingkat), ''), level)),
    level = public.contest_legacy_level_from_scope(
      public.contest_scope_from_legacy(COALESCE(NULLIF(btrim(tingkat), ''), level))
    )
WHERE tingkat IS DISTINCT FROM public.contest_scope_from_legacy(COALESCE(NULLIF(btrim(tingkat), ''), level))
   OR level IS DISTINCT FROM public.contest_legacy_level_from_scope(
        public.contest_scope_from_legacy(COALESCE(NULLIF(btrim(tingkat), ''), level))
      );

ALTER TABLE public.contests
  DROP CONSTRAINT IF EXISTS contests_tingkat_scope_check,
  ADD CONSTRAINT contests_tingkat_scope_check
    CHECK (tingkat IN ('bekasi', 'jabodetabek', 'jawa_barat', 'nasional', 'umum'));

ALTER TABLE public.contests
  ALTER COLUMN tingkat SET NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_contest_frontend_contract()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_name TEXT;
  v_organizer TEXT;
  v_scope TEXT;
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
    v_scope := NEW.tingkat;
  ELSIF TG_OP = 'UPDATE' AND NEW.level IS DISTINCT FROM OLD.level THEN
    v_scope := public.contest_scope_from_legacy(NEW.level);
  ELSE
    v_scope := public.contest_scope_from_legacy(COALESCE(NEW.tingkat, NEW.level));
  END IF;
  v_scope := lower(NULLIF(BTRIM(v_scope), ''));
  IF v_scope IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CONTEST_SCOPE_INVALID';
  END IF;
  NEW.tingkat := v_scope;
  NEW.level := public.contest_legacy_level_from_scope(v_scope);

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

INSERT INTO public.contest_migration_history (migration_name)
VALUES ('052_contest_scope_contract.sql')
ON CONFLICT (migration_name) DO NOTHING;

NOTIFY pgrst, 'reload schema';
COMMIT;
