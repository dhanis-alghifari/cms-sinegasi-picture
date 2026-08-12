-- 037_sensitive_mutation_audit.sql
-- Make database-level grading and password mutations emit one canonical,
-- immutable audit event. Apply after migrations 017, 021, and 022.

BEGIN;

CREATE OR REPLACE FUNCTION public.record_grades_bulk_atomic(
  p_assignment_id UUID,
  p_grades JSONB,
  p_graded_by UUID,
  p_change_reason TEXT
)
RETURNS SETOF public.grades
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item JSONB;
  v_student_id UUID;
  grade_row public.grades;
  v_grade_count INTEGER;
BEGIN
  IF p_graded_by IS NULL THEN
    RAISE EXCEPTION 'ID penginput nilai wajib diisi.';
  END IF;

  IF p_change_reason IS NULL OR length(trim(p_change_reason)) < 5 THEN
    RAISE EXCEPTION 'Alasan penyimpanan nilai minimal 5 karakter.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.assignments WHERE id = p_assignment_id) THEN
    RAISE EXCEPTION 'Tugas penilaian tidak ditemukan.';
  END IF;

  IF p_grades IS NULL OR jsonb_typeof(p_grades) <> 'array' OR jsonb_array_length(p_grades) = 0 THEN
    RAISE EXCEPTION 'Daftar nilai tidak boleh kosong.';
  END IF;

  v_grade_count := jsonb_array_length(p_grades);
  PERFORM set_config('app.current_user_id', p_graded_by::TEXT, TRUE);
  PERFORM set_config('app.change_reason', left(trim(p_change_reason), 500), TRUE);

  FOR item IN SELECT value FROM jsonb_array_elements(p_grades)
  LOOP
    BEGIN
      v_student_id := (item->>'student_id')::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'ID siswa pada payload nilai tidak valid.';
    END;

    IF v_student_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.students WHERE id = v_student_id) THEN
      RAISE EXCEPTION 'Siswa pada payload nilai tidak ditemukan.';
    END IF;

    IF item->>'nilai' NOT IN ('A', 'B', 'C', 'D', 'E') THEN
      RAISE EXCEPTION 'Predikat nilai harus A, B, C, D, atau E.';
    END IF;

    INSERT INTO public.grades (
      student_id, assignment_id, nilai, status, keterangan, graded_by,
      created_by, updated_by, created_at, updated_at
    ) VALUES (
      v_student_id,
      p_assignment_id,
      (item->>'nilai')::grade_value,
      'graded',
      NULLIF(trim(item->>'keterangan'), ''),
      p_graded_by,
      p_graded_by,
      p_graded_by,
      NOW(),
      NOW()
    )
    ON CONFLICT ON CONSTRAINT uq_student_assignment DO UPDATE SET
      nilai = EXCLUDED.nilai,
      status = EXCLUDED.status,
      keterangan = EXCLUDED.keterangan,
      graded_by = EXCLUDED.graded_by,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
    RETURNING * INTO grade_row;

    RETURN NEXT grade_row;
  END LOOP;

  -- Keep the audit payload small and never copy free-form grade input into an
  -- audit row. The domain rows remain the source of truth for each grade.
  PERFORM public.write_audit_log(
    p_graded_by,
    'UPSERT',
    'grades',
    p_assignment_id,
    NULL,
    jsonb_build_object(
      'operation', 'bulk_grade',
      'assignment_id', p_assignment_id,
      'grade_count', v_grade_count
    ),
    left(trim(p_change_reason), 500),
    NULL,
    NULL,
    'api',
    NULL,
    jsonb_build_object('audit_scope', 'bulk_assignment')
  );
END;
$$;

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

  PERFORM set_config('app.current_user_id', p_updated_by::TEXT, TRUE);
  PERFORM set_config('app.change_reason', LEFT(TRIM(p_change_reason), 500), TRUE);

  UPDATE public.users
  SET password_hash = p_password_hash,
      is_first_login = FALSE,
      updated_by = p_updated_by,
      updated_at = NOW(),
      auth_version = v_current.auth_version + 1
  WHERE users.id = p_user_id;

  -- Never persist the password hash. The rotated auth version is enough for
  -- an audit reader to prove that the credential state changed.
  PERFORM public.write_audit_log(
    p_updated_by,
    'UPDATE',
    'users',
    p_user_id,
    jsonb_build_object('auth_version', v_current.auth_version),
    jsonb_build_object(
      'operation', 'change_password',
      'auth_version', v_current.auth_version + 1
    ),
    left(trim(p_change_reason), 500),
    NULL,
    NULL,
    'api',
    NULL,
    jsonb_build_object('audit_scope', 'credential_rotation')
  );

  RETURN QUERY
  SELECT users.id, users.nama, users.is_active, users.is_first_login, users.auth_version
  FROM public.users
  WHERE users.id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_grades_bulk_atomic(UUID, JSONB, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_grades_bulk_atomic(UUID, JSONB, UUID, TEXT)
  TO service_role;

REVOKE ALL ON FUNCTION public.change_password_atomic(UUID, TEXT, UUID, TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.change_password_atomic(UUID, TEXT, UUID, TEXT, INTEGER)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;

-- Verification:
-- SELECT action, table_name, record_id, actor_name_snapshot,
--        actor_username_snapshot, actor_role_snapshot, metadata
-- FROM public.activity_logs
-- WHERE table_name IN ('grades', 'users')
-- ORDER BY created_at DESC, id DESC;
