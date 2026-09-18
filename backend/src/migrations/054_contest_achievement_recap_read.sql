-- 054_contest_achievement_recap_read.sql
-- Completed-only achievement recap: one row per contest entry, with grouped
-- awards and a read-only detail payload for evidence and change history.
-- Apply after 053_contest_pipeline_evidence_contract.sql.

BEGIN;

SELECT set_config('app.system_operation', 'true', true);
SELECT set_config('app.change_reason', 'SYSTEM:MIGRATION_054_CONTEST_ACHIEVEMENT_RECAP_READ', true);

DO $$
BEGIN
  IF to_regclass('public.contest_entries') IS NULL
     OR to_regclass('public.contest_entry_results') IS NULL
     OR to_regclass('public.contest_entry_evidence') IS NULL
     OR to_regclass('public.contest_entry_status_history') IS NULL
     OR to_regclass('public.contest_entry_result_history') IS NULL THEN
    RAISE EXCEPTION 'CONTEST_RECAP_SCHEMA_MISSING: jalankan migration 050 dan 053 terlebih dahulu';
  END IF;
  IF to_regclass('public.contest_migration_history') IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM public.contest_migration_history
       WHERE migration_name = '053_contest_pipeline_evidence_contract.sql'
     ) THEN
    RAISE EXCEPTION 'CONTEST_MIGRATION_ORDER_INVALID: jalankan migration 053 terlebih dahulu';
  END IF;
END;
$$;

-- The recap is filtered by completed entries before aggregation and pagination.
-- These partial indexes keep the common read path narrow as active pipeline rows
-- continue to grow.
CREATE INDEX IF NOT EXISTS idx_contest_entries_completed_recap
  ON public.contest_entries (completed_at DESC, id DESC)
  WHERE pipeline_status = 'selesai';

CREATE INDEX IF NOT EXISTS idx_contest_entry_results_active_entry_filter
  ON public.contest_entry_results (entry_id, result_kind, position, created_at DESC, id DESC)
  WHERE is_active = TRUE;

CREATE OR REPLACE FUNCTION public.list_contest_achievements_grouped(
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
      e.id AS entry_id,
      e.contest_id,
      e.work_id,
      e.pipeline_status,
      e.outcome_status,
      e.result_label,
      e.result_note,
      e.completed_at,
      e.created_at,
      mw.title AS work_title,
      mw.work_type_code,
      c.nama_lomba,
      c.kota,
      c.tingkat,
      c.tahun_event,
      c.status_public
    FROM public.contest_entries AS e
    JOIN public.contests AS c ON c.id = e.contest_id
    JOIN public.media_works AS mw ON mw.id = e.work_id
    WHERE e.pipeline_status = 'selesai'
      AND (NULLIF(btrim(p_outcome_status), '') IS NULL OR e.outcome_status = btrim(p_outcome_status))
      AND (p_tahun_event IS NULL OR c.tahun_event = p_tahun_event)
      AND (
        NULLIF(btrim(p_result_kind), '') IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.contest_entry_results AS r
          WHERE r.entry_id = e.id
            AND r.is_active = TRUE
            AND r.result_kind = btrim(p_result_kind)
        )
      )
      AND (
        p_position IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.contest_entry_results AS r
          WHERE r.entry_id = e.id
            AND r.is_active = TRUE
            AND r.position = p_position
        )
      )
      AND (
        NULLIF(btrim(p_search), '') IS NULL
        OR c.nama_lomba ILIKE '%' || btrim(p_search) || '%'
        OR c.kota ILIKE '%' || btrim(p_search) || '%'
        OR mw.title ILIKE '%' || btrim(p_search) || '%'
        OR COALESCE(e.result_label, '') ILIKE '%' || btrim(p_search) || '%'
        OR (e.outcome_status = 'not_awarded' AND 'Tidak mendapat penghargaan' ILIKE '%' || btrim(p_search) || '%')
        OR EXISTS (
          SELECT 1
          FROM public.contest_entry_results AS r
          WHERE r.entry_id = e.id
            AND r.is_active = TRUE
            AND (
              r.result_title ILIKE '%' || btrim(p_search) || '%'
              OR COALESCE(r.category_name, '') ILIKE '%' || btrim(p_search) || '%'
              OR (r.result_kind = 'rank' AND ('Juara ' || r.position::TEXT) ILIKE '%' || btrim(p_search) || '%')
              OR (r.result_kind = 'top_n' AND (r.position::TEXT || ' besar') ILIKE '%' || btrim(p_search) || '%')
            )
        )
      )
  ),
  grouped AS (
    SELECT
      f.*,
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', r.id,
            'result_kind', r.result_kind,
            'result_title', r.result_title,
            'position', r.position,
            'category_name', r.category_name,
            'notes', r.notes,
            'created_at', r.created_at
          ) ORDER BY r.created_at, r.id
        )
        FROM public.contest_entry_results AS r
        WHERE r.entry_id = f.entry_id AND r.is_active = TRUE
      ), '[]'::JSONB) AS awards,
      (
        SELECT count(*)::INTEGER
        FROM public.contest_entry_evidence AS evidence
        WHERE evidence.entry_id = f.entry_id
          AND evidence.upload_status = 'attached'
      ) AS evidence_count
    FROM filtered AS f
  ),
  numbered AS (
    SELECT grouped.*, count(*) OVER () AS total
    FROM grouped
    ORDER BY completed_at DESC NULLS LAST, entry_id DESC
    OFFSET GREATEST(p_page - 1, 0) * LEAST(GREATEST(p_page_size, 1), 100)
    LIMIT LEAST(GREATEST(p_page_size, 1), 100)
  )
  SELECT jsonb_build_object(
    'data', COALESCE((SELECT jsonb_agg(to_jsonb(numbered) - 'total') FROM numbered), '[]'::JSONB),
    'total', COALESCE((SELECT max(total) FROM numbered), (SELECT count(*) FROM grouped)),
    'page', GREATEST(p_page, 1),
    'pageSize', LEAST(GREATEST(p_page_size, 1), 100),
    'totalPages', GREATEST(
      1,
      CEIL(
        COALESCE((SELECT max(total) FROM numbered), (SELECT count(*) FROM grouped))::NUMERIC
        / LEAST(GREATEST(p_page_size, 1), 100)
      )::INTEGER
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.get_contest_achievement_detail(p_entry_id UUID)
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'entry', jsonb_build_object(
      'id', e.id,
      'contest_id', e.contest_id,
      'work_id', e.work_id,
      'pipeline_status', e.pipeline_status,
      'outcome_status', e.outcome_status,
      'result_label', e.result_label,
      'result_note', e.result_note,
      'submitted_at', e.submitted_at,
      'completed_at', e.completed_at,
      'work', jsonb_build_object(
        'id', mw.id,
        'title', mw.title,
        'work_type_code', mw.work_type_code,
        'description', mw.description,
        'duration_minutes', mw.duration_minutes,
        'production_year', mw.production_year,
        'primary_asset_url', mw.primary_asset_url,
        'video_url', mw.video_url
      ),
      'contest', jsonb_build_object(
        'id', c.id,
        'nama_lomba', c.nama_lomba,
        'kota', c.kota,
        'tingkat', c.tingkat,
        'tahun_event', c.tahun_event,
        'status_public', c.status_public
      )
    ),
    'awards', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'result_kind', r.result_kind,
          'result_title', r.result_title,
          'position', r.position,
          'category_name', r.category_name,
          'notes', r.notes,
          'created_at', r.created_at
        ) ORDER BY r.created_at, r.id
      )
      FROM public.contest_entry_results AS r
      WHERE r.entry_id = e.id AND r.is_active = TRUE
    ), '[]'::JSONB),
    'evidence', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', evidence.id,
          'evidence_type', evidence.evidence_type,
          'target_status', evidence.target_status,
          'original_filename', evidence.original_filename,
          'mime_type', evidence.mime_type,
          'file_size_bytes', evidence.file_size_bytes,
          'created_at', evidence.created_at
        ) ORDER BY evidence.created_at, evidence.id
      )
      FROM public.contest_entry_evidence AS evidence
      WHERE evidence.entry_id = e.id
        AND evidence.upload_status = 'attached'
    ), '[]'::JSONB),
    'timeline', COALESCE((
      SELECT jsonb_agg(item ORDER BY item->>'created_at', item->>'id')
      FROM (
        SELECT jsonb_build_object(
          'id', status_history.id,
          'kind', 'status',
          'status', status_history.to_status,
          'from_status', status_history.from_status,
          'to_status', status_history.to_status,
          'change_reason', status_history.change_reason,
          'changed_by', status_history.changed_by,
          'changed_by_name', actor.nama,
          'created_at', status_history.created_at
        ) AS item
        FROM public.contest_entry_status_history AS status_history
        LEFT JOIN public.users AS actor ON actor.id = status_history.changed_by
        WHERE status_history.entry_id = e.id
        UNION ALL
        SELECT jsonb_build_object(
          'id', result_history.id,
          'kind', 'result',
          'status', result_history.to_outcome_status,
          'from_status', result_history.from_outcome_status,
          'to_status', result_history.to_outcome_status,
          'change_reason', result_history.change_reason,
          'changed_by', result_history.changed_by,
          'changed_by_name', actor.nama,
          'created_at', result_history.created_at
        ) AS item
        FROM public.contest_entry_result_history AS result_history
        LEFT JOIN public.users AS actor ON actor.id = result_history.changed_by
        WHERE result_history.entry_id = e.id
      ) AS timeline_rows
    ), '[]'::JSONB)
  )
  FROM public.contest_entries AS e
  JOIN public.contests AS c ON c.id = e.contest_id
  JOIN public.media_works AS mw ON mw.id = e.work_id
  WHERE e.id = p_entry_id
    AND e.pipeline_status = 'selesai';
$$;

REVOKE ALL ON FUNCTION public.list_contest_achievements_grouped(TEXT, TEXT, INTEGER, TEXT, INTEGER, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_contest_achievements_grouped(TEXT, TEXT, INTEGER, TEXT, INTEGER, INTEGER, INTEGER)
  TO service_role;

REVOKE ALL ON FUNCTION public.get_contest_achievement_detail(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_contest_achievement_detail(UUID)
  TO service_role;

INSERT INTO public.contest_migration_history (migration_name)
VALUES ('054_contest_achievement_recap_read.sql')
ON CONFLICT (migration_name) DO NOTHING;

NOTIFY pgrst, 'reload schema';
COMMIT;
