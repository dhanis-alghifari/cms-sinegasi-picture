-- 022_password_change_atomic.sql
-- Atomik change-password yang mengisi konteks audit legacy sebelum UPDATE users.
-- Jalankan setelah migration 017 dan 021.

CREATE OR REPLACE FUNCTION public.change_password_atomic(
  p_user_id UUID,
  p_password_hash TEXT,
  p_updated_by UUID,
  p_change_reason TEXT,
  p_expected_auth_version INTEGER
)
RETURNS TABLE (
  id UUID,
  nama TEXT,
  is_active BOOLEAN,
  is_first_login BOOLEAN,
  auth_version INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current public.users;
BEGIN
  IF p_user_id IS NULL OR p_updated_by IS NULL OR p_user_id <> p_updated_by THEN
    RAISE EXCEPTION 'Aktor perubahan password tidak valid.';
  END IF;

  IF COALESCE(length(trim(p_change_reason)), 0) < 5 THEN
    RAISE EXCEPTION 'Alasan perubahan minimal 5 karakter.';
  END IF;

  IF p_password_hash IS NULL OR length(p_password_hash) < 20 THEN
    RAISE EXCEPTION 'Hash password tidak valid.';
  END IF;

  IF p_expected_auth_version IS NULL THEN
    RAISE EXCEPTION 'Versi sesi keamanan belum tersedia. Jalankan migration 021 terlebih dahulu.';
  END IF;

  SELECT *
  INTO v_current
  FROM public.users
  WHERE users.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_current.is_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Akun tidak ditemukan atau tidak aktif.';
  END IF;

  IF v_current.auth_version IS DISTINCT FROM p_expected_auth_version THEN
    RAISE EXCEPTION 'Sesi keamanan berubah. Silakan login kembali.';
  END IF;

  -- Required by the existing Zero Silent Edits trigger on public.users.
  PERFORM set_config('app.current_user_id', p_updated_by::TEXT, TRUE);
  PERFORM set_config('app.change_reason', LEFT(TRIM(p_change_reason), 500), TRUE);

  UPDATE public.users
  SET password_hash = p_password_hash,
      is_first_login = FALSE,
      updated_by = p_updated_by,
      updated_at = NOW(),
      auth_version = v_current.auth_version + 1
  WHERE users.id = p_user_id;

  RETURN QUERY
  SELECT users.id, users.nama, users.is_active, users.is_first_login, users.auth_version
  FROM public.users
  WHERE users.id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.change_password_atomic(UUID, TEXT, UUID, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.change_password_atomic(UUID, TEXT, UUID, TEXT, INTEGER) TO service_role;

NOTIFY pgrst, 'reload schema';
