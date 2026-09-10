-- 058_attendance_reporting_filters.sql
-- Filtered attendance history and student-period summaries.
--
-- Run after the existing attendance schema and its prior reporting migrations.
-- The Fastify API calls this function through the service-role Supabase client.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.attendance') IS NULL
     OR to_regclass('public.students') IS NULL THEN
    RAISE EXCEPTION 'ATTENDANCE_REPORTING_SCHEMA_MISSING: tabel attendance atau students belum tersedia';
  END IF;
END;
$$;

-- The existing unique (student_id, tanggal) index supports the student-period
-- access path. The date index from migration 044 supports all-student ranges.
CREATE OR REPLACE FUNCTION public.get_attendance_summary_filtered(
  p_student_id UUID DEFAULT NULL,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL
)
RETURNS TABLE (
  hadir BIGINT,
  sakit BIGINT,
  izin BIGINT,
  alpha BIGINT,
  total BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    COUNT(*) FILTER (WHERE a.status = 'hadir'),
    COUNT(*) FILTER (WHERE a.status = 'sakit'),
    COUNT(*) FILTER (WHERE a.status = 'izin'),
    COUNT(*) FILTER (WHERE a.status = 'alpha'),
    COUNT(*)
  FROM public.attendance AS a
  WHERE (p_student_id IS NULL OR a.student_id = p_student_id)
    AND (p_date_from IS NULL OR a.tanggal >= p_date_from)
    AND (p_date_to IS NULL OR a.tanggal <= p_date_to);
$$;

REVOKE ALL ON FUNCTION public.get_attendance_summary_filtered(UUID, DATE, DATE)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_attendance_summary_filtered(UUID, DATE, DATE)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
