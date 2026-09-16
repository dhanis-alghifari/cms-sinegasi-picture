-- 059_attendance_summary_filter_scope.sql
-- Makes the daily attendance summary use the same student/date/class/status/search
-- scope as the attendance list.
-- Run after 058_attendance_reporting_filters.sql.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.attendance') IS NULL
     OR to_regclass('public.students') IS NULL THEN
    RAISE EXCEPTION 'ATTENDANCE_SUMMARY_SCHEMA_MISSING: tabel attendance atau students belum tersedia';
  END IF;
END;
$$;

-- Replace the three-argument function from migration 058 so PostgreSQL does
-- not see two equally valid overloads when callers omit the new filters.
DROP FUNCTION IF EXISTS public.get_attendance_summary_filtered(UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION public.get_attendance_summary_filtered(
  p_student_id UUID DEFAULT NULL,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL,
  p_kelas TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL
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
  INNER JOIN public.students AS s ON s.id = a.student_id
  WHERE (p_student_id IS NULL OR a.student_id = p_student_id)
    AND (p_date_from IS NULL OR a.tanggal >= p_date_from)
    AND (p_date_to IS NULL OR a.tanggal <= p_date_to)
    AND (
      p_kelas IS NULL
      OR p_kelas = 'all'
      OR (
        p_kelas IN ('X', 'XI', 'XII')
        AND (s.kelas = p_kelas OR s.kelas ILIKE p_kelas || ' %')
      )
      OR s.kelas = p_kelas
    )
    AND (p_status IS NULL OR p_status = 'all' OR a.status = p_status)
    AND (
      p_search IS NULL
      OR s.nama ILIKE '%' || p_search || '%'
      OR s.nis ILIKE '%' || p_search || '%'
    );
$$;

REVOKE ALL ON FUNCTION public.get_attendance_summary_filtered(UUID, DATE, DATE, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_attendance_summary_filtered(UUID, DATE, DATE, TEXT, TEXT, TEXT)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
