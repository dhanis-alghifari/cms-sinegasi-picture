-- 049_contest_event_contract.sql
-- Public event contract: city, event year, and a future-only registration deadline.
-- Expand/contract migration. Legacy contest columns remain available while the
-- API and frontend move to the simplified contract.

BEGIN;

-- This migration backfills derived data on existing contests. The contests
-- table is protected by the Zero Silent Edits trigger, so mark the statement
-- as an auditable system operation instead of disabling the trigger or
-- inventing a human actor. The settings are transaction-local and disappear
-- at COMMIT/ROLLBACK.
SELECT set_config('app.system_operation', 'true', true);
SELECT set_config(
  'app.change_reason',
  'SYSTEM:MIGRATION_049_BACKFILL_EVENT_YEAR',
  true
);

DO $$
BEGIN
  IF to_regclass('public.contests') IS NULL THEN
    RAISE EXCEPTION 'CONTEST_SCHEMA_BASE_MISSING: public.contests belum tersedia';
  END IF;
END;
$$;

ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS kota TEXT,
  ADD COLUMN IF NOT EXISTS tahun_event INTEGER;

-- Historical rows can be migrated deterministically from the existing event
-- date. City is intentionally not fabricated from organizer data.
UPDATE public.contests
SET tahun_event = EXTRACT(YEAR FROM COALESCE(deadline, tanggal, tanggal_lomba))::INTEGER
WHERE tahun_event IS NULL
  AND COALESCE(deadline, tanggal, tanggal_lomba) IS NOT NULL;

ALTER TABLE public.contests
  DROP CONSTRAINT IF EXISTS contests_event_city_check,
  ADD CONSTRAINT contests_event_city_check CHECK (
    kota IS NULL OR length(btrim(kota)) BETWEEN 2 AND 120
  ),
  DROP CONSTRAINT IF EXISTS contests_event_year_check,
  ADD CONSTRAINT contests_event_year_check CHECK (
    tahun_event IS NULL OR tahun_event BETWEEN 1900 AND 2200
  );

-- The event year, rather than the legacy academic year, defines uniqueness for
-- the public product contract. Abort before changing the old index if legacy
-- data contains an ambiguous duplicate.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.contests
    WHERE NULLIF(btrim(nama_lomba), '') IS NOT NULL
      AND tahun_event IS NOT NULL
    GROUP BY lower(btrim(nama_lomba)), tahun_event
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'MIGRATION_PREFLIGHT_FAILED: duplicate contest names in event year';
  END IF;
END;
$$;

DROP INDEX IF EXISTS public.uq_contest_name_academic_year;
CREATE UNIQUE INDEX IF NOT EXISTS uq_contest_name_event_year
  ON public.contests (lower(btrim(nama_lomba)), tahun_event)
  WHERE tahun_event IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contests_event_year_deadline_id
  ON public.contests (tahun_event, deadline DESC, id DESC);

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_contests_city_trgm
  ON public.contests USING gin (kota gin_trgm_ops);

-- Enforce the product rule at the database boundary as well as in Fastify.
-- Existing rows are not revalidated on unrelated updates; only INSERTs and
-- changes to an event date are checked.
CREATE OR REPLACE FUNCTION public.validate_contest_deadline_future()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_deadline DATE;
BEGIN
  v_deadline := COALESCE(NEW.deadline, NEW.tanggal, NEW.tanggal_lomba);

  IF NEW.kota IS NOT NULL OR NEW.tahun_event IS NOT NULL THEN
    IF TG_OP = 'INSERT'
       OR (TG_OP = 'UPDATE' AND (
         NEW.deadline IS DISTINCT FROM OLD.deadline
         OR NEW.tanggal IS DISTINCT FROM OLD.tanggal
         OR NEW.tanggal_lomba IS DISTINCT FROM OLD.tanggal_lomba
       )) THEN
      IF v_deadline IS NULL
         OR v_deadline <= (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE THEN
        RAISE EXCEPTION USING
          ERRCODE = '22023',
          MESSAGE = 'CONTEST_DEADLINE_MUST_BE_FUTURE';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_contest_deadline_future ON public.contests;
CREATE TRIGGER trg_validate_contest_deadline_future
  BEFORE INSERT OR UPDATE ON public.contests
  FOR EACH ROW EXECUTE FUNCTION public.validate_contest_deadline_future();

INSERT INTO public.contest_migration_history (migration_name)
VALUES ('049_contest_event_contract.sql')
ON CONFLICT (migration_name) DO NOTHING;

NOTIFY pgrst, 'reload schema';
COMMIT;
