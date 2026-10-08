-- Reduce list payloads and keep borrowing search/filter/count/pagination in Postgres.
-- Additive only: no records or existing indexes are deleted.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.students') IS NULL
     OR to_regclass('public.equipment') IS NULL
     OR to_regclass('public.borrowings') IS NULL
     OR to_regclass('public.borrowing_items') IS NULL THEN
    RAISE EXCEPTION 'QUERY_PERFORMANCE_SCHEMA_MISSING';
  END IF;
END;
$$;

-- Student/equipment and borrowing_items indexes already exist in migrations
-- 001, 014, 030, and 034. Add only missing borrowing read-path indexes.
-- The API sorts pages by created_at/id and commonly filters by student/status.
CREATE INDEX IF NOT EXISTS idx_borrowings_created_at_id
  ON public.borrowings (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_borrowings_student_created_at_id
  ON public.borrowings (student_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_borrowings_status_created_at_id
  ON public.borrowings (status, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_borrowings_status_returned_at
  ON public.borrowings (status, returned_at DESC)
  WHERE returned_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_borrowings_borrowed_due_at
  ON public.borrowings (due_at)
  WHERE status = 'borrowed';
CREATE INDEX IF NOT EXISTS idx_borrowings_borrowed_planned_return
  ON public.borrowings (rencana_kembali)
  WHERE status = 'borrowed' AND due_at IS NULL;

-- Equipment list cards need only one photo. Keep the array and legacy photo
-- column out of list responses and fetch the primary reference on demand.
CREATE OR REPLACE FUNCTION public.get_equipment_primary_photo(p_equipment_id UUID)
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(NULLIF(BTRIM(e.foto_url), ''), NULLIF(BTRIM(e.fotos[1]), ''))
  FROM public.equipment AS e
  WHERE e.id = p_equipment_id;
$$;

REVOKE ALL ON FUNCTION public.get_equipment_primary_photo(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_equipment_primary_photo(UUID) TO service_role;

-- Search previously downloaded all matching borrowings before applying the
-- page slice in Node. This RPC returns only page IDs plus the exact total;
-- the backend hydrates those IDs through its existing projection afterward.
CREATE OR REPLACE FUNCTION public.search_borrowings_page_ids(
  p_search TEXT,
  p_status TEXT,
  p_student_id UUID,
  p_borrower_id UUID,
  p_overdue_only BOOLEAN,
  p_now TIMESTAMPTZ,
  p_today DATE,
  p_limit INTEGER,
  p_offset INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_total BIGINT;
  v_ids JSONB;
BEGIN
  IF (p_search IS NOT NULL AND (length(btrim(p_search)) NOT BETWEEN 1 AND 100))
     OR (p_status IS NOT NULL AND p_status NOT IN ('pending', 'approved', 'rejected', 'borrowed', 'pending_verification', 'returned'))
     OR p_now IS NULL OR p_today IS NULL
     OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100
     OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 1000000 THEN
    RAISE EXCEPTION 'BORROWING_SEARCH_INVALID_INPUT' USING ERRCODE = '22023';
  END IF;

  WITH matched AS MATERIALIZED (
    SELECT b.id, b.created_at
    FROM public.borrowings AS b
    LEFT JOIN public.students AS s ON s.id = b.student_id
    WHERE (p_student_id IS NULL OR b.student_id = p_student_id)
      AND (p_student_id IS NOT NULL OR p_borrower_id IS NULL OR b.student_id = p_borrower_id)
      AND (p_status IS NULL OR b.status = p_status)
      AND (
        COALESCE(p_overdue_only, FALSE) = FALSE
        OR (
          b.status = 'borrowed'
          AND (b.due_at < p_now OR (b.due_at IS NULL AND b.rencana_kembali <= p_today))
        )
      )
      AND (
        p_search IS NULL
        OR s.nama ILIKE '%' || p_search || '%'
        OR s.nis ILIKE '%' || p_search || '%'
        OR EXISTS (
          SELECT 1
          FROM public.borrowing_items AS bi
          JOIN public.equipment AS e ON e.id = bi.equipment_id
          WHERE bi.borrowing_id = b.id
            AND (e.kode_alat ILIKE '%' || p_search || '%' OR e.nama_alat ILIKE '%' || p_search || '%')
        )
      )
  ),
  page_rows AS (
    SELECT id, created_at
    FROM matched
    ORDER BY created_at DESC, id DESC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT
    (SELECT count(*) FROM matched),
    COALESCE((SELECT jsonb_agg(id ORDER BY created_at DESC, id DESC) FROM page_rows), '[]'::JSONB)
  INTO v_total, v_ids;

  RETURN jsonb_build_object('ids', v_ids, 'total', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.search_borrowings_page_ids(TEXT, TEXT, UUID, UUID, BOOLEAN, TIMESTAMPTZ, DATE, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_borrowings_page_ids(TEXT, TEXT, UUID, UUID, BOOLEAN, TIMESTAMPTZ, DATE, INTEGER, INTEGER)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
