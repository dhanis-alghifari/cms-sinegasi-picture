-- Scalable attendance summary. Run after migrations 001-025.
-- The API calls this function through the service-role Supabase client so the
-- aggregate is computed in PostgreSQL instead of transferring every row.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_attendance_tanggal_status
  ON public.attendance (tanggal, status);

CREATE OR REPLACE FUNCTION public.get_attendance_summary(p_tanggal DATE)
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
SET search_path = public
AS $$
  SELECT
    COUNT(*) FILTER (WHERE a.status = 'hadir'),
    COUNT(*) FILTER (WHERE a.status = 'sakit'),
    COUNT(*) FILTER (WHERE a.status = 'izin'),
    COUNT(*) FILTER (WHERE a.status = 'alpha'),
    COUNT(*)
  FROM public.attendance AS a
  WHERE a.tanggal = p_tanggal;
$$;

REVOKE ALL ON FUNCTION public.get_attendance_summary(DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_attendance_summary(DATE) TO service_role;

COMMIT;
