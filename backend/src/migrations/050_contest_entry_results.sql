-- 050_contest_entry_results.sql
-- Structured, repeatable contest outcomes. Legacy result_label/result_note remain
-- readable while the API moves to a normalized one-to-many result model.

BEGIN;

SELECT set_config('app.system_operation', 'true', true);
SELECT set_config('app.change_reason', 'SYSTEM:MIGRATION_050_BACKFILL_CONTEST_RESULTS', true);

DO $$
BEGIN
  IF to_regclass('public.contest_entries') IS NULL THEN
    RAISE EXCEPTION 'CONTEST_ENTRY_SCHEMA_MISSING: jalankan 048_contest_media_works.sql terlebih dahulu';
  END IF;
END;
$$;

ALTER TABLE public.contest_entries
  ADD COLUMN IF NOT EXISTS outcome_status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE public.contest_entries
  DROP CONSTRAINT IF EXISTS contest_entry_outcome_status_check,
  ADD CONSTRAINT contest_entry_outcome_status_check
    CHECK (outcome_status IN ('pending', 'awarded', 'not_awarded'));

CREATE TABLE IF NOT EXISTS public.contest_entry_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.contest_entries(id) ON DELETE CASCADE,
  result_kind TEXT NOT NULL CHECK (result_kind IN (
    'rank', 'top_n', 'special_award', 'finalist', 'nominee', 'honorable_mention', 'other'
  )),
  result_title TEXT NOT NULL CHECK (length(btrim(result_title)) BETWEEN 2 AND 200),
  position INTEGER CHECK (position IS NULL OR position BETWEEN 1 AND 100000),
  category_name TEXT CHECK (category_name IS NULL OR length(btrim(category_name)) BETWEEN 1 AND 160),
  notes TEXT CHECK (notes IS NULL OR length(btrim(notes)) <= 2000),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  voided_at TIMESTAMPTZ,
  voided_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT contest_entry_result_position_check CHECK (
    (result_kind IN ('rank', 'top_n') AND position IS NOT NULL)
    OR (result_kind NOT IN ('rank', 'top_n'))
  )
);

CREATE TABLE IF NOT EXISTS public.contest_entry_result_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.contest_entries(id) ON DELETE CASCADE,
  from_outcome_status TEXT,
  to_outcome_status TEXT NOT NULL CHECK (to_outcome_status IN ('pending', 'awarded', 'not_awarded')),
  change_reason TEXT NOT NULL CHECK (length(btrim(change_reason)) BETWEEN 5 AND 500),
  changed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.contest_entry_result_operations (
  idempotency_key TEXT PRIMARY KEY CHECK (length(btrim(idempotency_key)) BETWEEN 8 AND 128),
  entry_id UUID NOT NULL REFERENCES public.contest_entries(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contest_entry_results_entry_active_created
  ON public.contest_entry_results (entry_id, is_active, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_contest_entry_results_kind_position
  ON public.contest_entry_results (result_kind, position, entry_id)
  WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_contest_entry_results_category
  ON public.contest_entry_results (lower(category_name), entry_id)
  WHERE is_active = TRUE AND category_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contest_entries_outcome_updated
  ON public.contest_entries (outcome_status, updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_contest_entry_result_history_entry_created
  ON public.contest_entry_result_history (entry_id, created_at DESC, id DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_contest_entry_result_active_value
  ON public.contest_entry_results (
    entry_id,
    result_kind,
    COALESCE(position, 0),
    lower(btrim(result_title)),
    lower(COALESCE(btrim(category_name), ''))
  )
  WHERE is_active = TRUE;

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_contest_entry_results_title_trgm
  ON public.contest_entry_results USING gin (lower(result_title) gin_trgm_ops)
  WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_media_works_title_trgm
  ON public.media_works USING gin (lower(title) gin_trgm_ops);

-- Preserve legacy result_label values in the normalized model. Entries that
-- reached the completed pipeline without a label are explicitly marked as
-- not awarded instead of being presented as an unknown result.
UPDATE public.contest_entries
SET outcome_status = CASE
  WHEN length(btrim(COALESCE(result_label, ''))) >= 2 THEN 'awarded'
  ELSE 'not_awarded'
END
WHERE pipeline_status = 'selesai'
  AND outcome_status = 'pending';

INSERT INTO public.contest_entry_results (entry_id, result_kind, result_title, notes, created_by, updated_by, created_at, updated_at)
SELECT e.id, 'other', btrim(e.result_label), NULLIF(btrim(e.result_note), ''), e.created_by, e.updated_by, COALESCE(e.created_at, NOW()), COALESCE(e.updated_at, NOW())
FROM public.contest_entries e
WHERE e.outcome_status = 'awarded'
  AND length(btrim(COALESCE(e.result_label, ''))) >= 2
  AND NOT EXISTS (
    SELECT 1 FROM public.contest_entry_results r
    WHERE r.entry_id = e.id AND r.is_active = TRUE
  );

CREATE OR REPLACE FUNCTION public.record_contest_entry_result_atomic(
  p_entry_id UUID,
  p_outcome_status TEXT,
  p_results JSONB,
  p_change_reason TEXT,
  p_actor_id UUID,
  p_idempotency_key TEXT,
  p_evidence_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_entry public.contest_entries;
  v_previous_outcome TEXT;
  v_item JSONB;
  v_result public.contest_entry_results;
  v_count INTEGER := 0;
  v_operation_inserted INTEGER;
  v_existing_operation_entry UUID;
  v_existing_operation_actor UUID;
  v_first_title TEXT;
  v_first_note TEXT;
BEGIN
  IF p_entry_id IS NULL OR p_actor_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_RESULT_IDENTITY_INVALID';
  END IF;
  IF p_outcome_status NOT IN ('pending', 'awarded', 'not_awarded') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_OUTCOME_INVALID';
  END IF;
  IF length(btrim(COALESCE(p_change_reason, ''))) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHANGE_REASON_REQUIRED';
  END IF;
  IF length(btrim(COALESCE(p_idempotency_key, ''))) NOT BETWEEN 8 AND 128 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_RESULT_IDEMPOTENCY_INVALID';
  END IF;
  IF jsonb_typeof(COALESCE(p_results, '[]'::JSONB)) <> 'array' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_RESULT_PAYLOAD_INVALID';
  END IF;
  IF jsonb_array_length(COALESCE(p_results, '[]'::JSONB)) > 20 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_RESULT_LIMIT_EXCEEDED';
  END IF;
  IF p_outcome_status = 'awarded' AND jsonb_array_length(COALESCE(p_results, '[]'::JSONB)) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_RESULT_REQUIRED';
  END IF;
  IF p_outcome_status <> 'awarded' AND jsonb_array_length(COALESCE(p_results, '[]'::JSONB)) > 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_RESULT_NOT_ALLOWED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_actor_id AND is_active = TRUE
      AND role::TEXT IN ('teacher', 'leader', 'vice_leader', 'secretary', 'contest_team')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_RESULT_ACTOR_FORBIDDEN';
  END IF;

  INSERT INTO public.contest_entry_result_operations (idempotency_key, entry_id, actor_id)
  VALUES (btrim(p_idempotency_key), p_entry_id, p_actor_id)
  ON CONFLICT (idempotency_key) DO NOTHING;
  GET DIAGNOSTICS v_operation_inserted = ROW_COUNT;
  IF v_operation_inserted = 0 THEN
    SELECT entry_id, actor_id
    INTO v_existing_operation_entry, v_existing_operation_actor
    FROM public.contest_entry_result_operations
    WHERE idempotency_key = btrim(p_idempotency_key);
    IF v_existing_operation_entry IS DISTINCT FROM p_entry_id
       OR v_existing_operation_actor IS DISTINCT FROM p_actor_id THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_RESULT_IDEMPOTENCY_REUSED';
    END IF;
    SELECT * INTO v_entry FROM public.contest_entries WHERE id = p_entry_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_ENTRY_NOT_FOUND';
    END IF;
    RETURN jsonb_build_object('entry', to_jsonb(v_entry), 'idempotent_replay', TRUE);
  END IF;

  SELECT * INTO v_entry
  FROM public.contest_entries
  WHERE id = p_entry_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_ENTRY_NOT_FOUND';
  END IF;
  v_previous_outcome := v_entry.outcome_status;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_results, '[]'::JSONB))
  LOOP
    v_count := v_count + 1;
    IF (v_item->>'result_kind') NOT IN ('rank', 'top_n', 'special_award', 'finalist', 'nominee', 'honorable_mention', 'other')
      OR length(btrim(COALESCE(v_item->>'result_title', ''))) NOT BETWEEN 2 AND 200 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_RESULT_ITEM_INVALID';
    END IF;
    IF (v_item->>'result_kind') IN ('rank', 'top_n')
      AND ((v_item->>'position') IS NULL OR (v_item->>'position') !~ '^[0-9]+$' OR (v_item->>'position')::INTEGER NOT BETWEEN 1 AND 100000) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_RESULT_POSITION_REQUIRED';
    END IF;
    IF (v_item->>'result_kind') NOT IN ('rank', 'top_n') AND (v_item ? 'position') AND v_item->>'position' IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_RESULT_POSITION_NOT_ALLOWED';
    END IF;
  END LOOP;

  PERFORM set_config('app.current_user_id', p_actor_id::TEXT, TRUE);
  PERFORM set_config('app.change_reason', left(btrim(p_change_reason), 500), TRUE);
  PERFORM set_config('app.skip_legacy_audit', 'true', TRUE);

  UPDATE public.contest_entry_results
  SET is_active = FALSE,
      voided_at = NOW(),
      voided_by = p_actor_id,
      updated_by = p_actor_id,
      updated_at = NOW()
  WHERE entry_id = p_entry_id AND is_active = TRUE;

  IF p_outcome_status = 'awarded' THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_results, '[]'::JSONB))
    LOOP
      INSERT INTO public.contest_entry_results (
        entry_id, result_kind, result_title, position, category_name, notes,
        created_by, updated_by
      ) VALUES (
        p_entry_id,
        v_item->>'result_kind',
        btrim(v_item->>'result_title'),
        CASE WHEN v_item->>'position' IS NULL THEN NULL ELSE (v_item->>'position')::INTEGER END,
        NULLIF(btrim(v_item->>'category_name'), ''),
        NULLIF(btrim(v_item->>'notes'), ''),
        p_actor_id, p_actor_id
      )
      RETURNING * INTO v_result;
      IF v_first_title IS NULL THEN
        v_first_title := v_result.result_title;
        v_first_note := v_result.notes;
      END IF;
    END LOOP;
  ELSIF p_outcome_status = 'not_awarded' THEN
    v_first_title := 'Tidak mendapat penghargaan';
  END IF;

  IF p_evidence_url IS NOT NULL AND length(btrim(p_evidence_url)) > 0 THEN
    IF btrim(p_evidence_url) !~* '^(https?://|data:image/)'
      OR length(btrim(p_evidence_url)) > 900000 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_RESULT_EVIDENCE_INVALID';
    END IF;
    INSERT INTO public.contest_entry_evidence (entry_id, evidence_type, public_url, created_by)
    VALUES (p_entry_id, 'result', btrim(p_evidence_url), p_actor_id);
  END IF;

  UPDATE public.contest_entries
  SET outcome_status = p_outcome_status,
      result_label = NULLIF(v_first_title, ''),
      result_note = NULLIF(v_first_note, ''),
      updated_by = p_actor_id,
      updated_at = NOW(),
      version = version + 1
  WHERE id = p_entry_id
  RETURNING * INTO v_entry;

  INSERT INTO public.contest_entry_result_history (
    entry_id, from_outcome_status, to_outcome_status, change_reason, changed_by
  ) VALUES (
    p_entry_id, v_previous_outcome, p_outcome_status, btrim(p_change_reason), p_actor_id
  );

  RETURN jsonb_build_object('entry', to_jsonb(v_entry), 'idempotent_replay', FALSE);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_RESULT_DUPLICATE';
END;
$$;

CREATE OR REPLACE FUNCTION public.list_contest_achievements(
  p_search TEXT DEFAULT NULL,
  p_result_kind TEXT DEFAULT NULL,
  p_position INTEGER DEFAULT NULL,
  p_outcome_status TEXT DEFAULT NULL,
  p_tahun_event INTEGER DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 20
)
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH filtered AS (
    SELECT
      r.id AS result_id,
      e.id AS entry_id,
      e.contest_id,
      e.work_id,
      e.pipeline_status,
      e.outcome_status,
      mw.title AS work_title,
      mw.work_type_code,
      c.nama_lomba,
      c.kota,
      c.tingkat,
      c.tahun_event,
      c.status_public,
      CASE WHEN r.id IS NULL THEN NULL ELSE r.result_kind END AS result_kind,
      CASE
        WHEN r.id IS NOT NULL THEN r.result_title
        WHEN e.outcome_status = 'pending' THEN 'Menunggu hasil'
        ELSE 'Tidak mendapat penghargaan'
      END AS result_title,
      r.position,
      r.category_name,
      r.notes,
      r.created_at
    FROM public.contest_entries e
    JOIN public.contests c ON c.id = e.contest_id
    JOIN public.media_works mw ON mw.id = e.work_id
    LEFT JOIN public.contest_entry_results r
      ON r.entry_id = e.id AND r.is_active = TRUE
    WHERE (e.pipeline_status = 'selesai' OR e.outcome_status IN ('awarded', 'not_awarded'))
      AND (NULLIF(btrim(p_result_kind), '') IS NULL OR r.result_kind = btrim(p_result_kind))
      AND (p_position IS NULL OR r.position = p_position)
      AND (NULLIF(btrim(p_outcome_status), '') IS NULL OR e.outcome_status = btrim(p_outcome_status))
      AND (p_tahun_event IS NULL OR c.tahun_event = p_tahun_event)
      AND (
        NULLIF(btrim(p_search), '') IS NULL
        OR c.nama_lomba ILIKE '%' || btrim(p_search) || '%'
        OR c.kota ILIKE '%' || btrim(p_search) || '%'
        OR mw.title ILIKE '%' || btrim(p_search) || '%'
        OR r.result_title ILIKE '%' || btrim(p_search) || '%'
        OR r.category_name ILIKE '%' || btrim(p_search) || '%'
        OR (r.result_kind = 'rank' AND ('Juara ' || r.position::TEXT) ILIKE '%' || btrim(p_search) || '%')
        OR (r.result_kind = 'top_n' AND (r.position::TEXT || ' besar') ILIKE '%' || btrim(p_search) || '%')
        OR (r.id IS NULL AND e.outcome_status = 'pending' AND 'Menunggu hasil' ILIKE '%' || btrim(p_search) || '%')
        OR (r.id IS NULL AND e.outcome_status = 'not_awarded' AND 'Tidak mendapat penghargaan' ILIKE '%' || btrim(p_search) || '%')
      )
  ),
  numbered AS (
    SELECT filtered.*, count(*) OVER () AS total
    FROM filtered
    ORDER BY created_at DESC NULLS LAST, entry_id DESC, result_id DESC NULLS LAST
    OFFSET GREATEST(p_page - 1, 0) * LEAST(GREATEST(p_page_size, 1), 100)
    LIMIT LEAST(GREATEST(p_page_size, 1), 100)
  )
  SELECT jsonb_build_object(
    'data', COALESCE((SELECT jsonb_agg(to_jsonb(numbered) - 'total') FROM numbered), '[]'::JSONB),
    'total', COALESCE((SELECT max(total) FROM numbered), (SELECT count(*) FROM filtered)),
    'page', GREATEST(p_page, 1),
    'pageSize', LEAST(GREATEST(p_page_size, 1), 100),
    'totalPages', GREATEST(1, CEIL(COALESCE((SELECT max(total) FROM numbered), (SELECT count(*) FROM filtered))::NUMERIC / LEAST(GREATEST(p_page_size, 1), 100))::INTEGER)
  );
$$;

GRANT EXECUTE ON FUNCTION public.record_contest_entry_result_atomic(UUID, TEXT, JSONB, TEXT, UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.list_contest_achievements(TEXT, TEXT, INTEGER, TEXT, INTEGER, INTEGER, INTEGER) TO service_role;
REVOKE EXECUTE ON FUNCTION public.record_contest_entry_result_atomic(UUID, TEXT, JSONB, TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.list_contest_achievements(TEXT, TEXT, INTEGER, TEXT, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;

INSERT INTO public.contest_migration_history (migration_name)
VALUES ('050_contest_entry_results.sql')
ON CONFLICT (migration_name) DO NOTHING;

NOTIFY pgrst, 'reload schema';
COMMIT;
