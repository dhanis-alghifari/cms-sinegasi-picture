BEGIN;

CREATE OR REPLACE FUNCTION public.create_student_with_account_atomic(
  p_nis TEXT,
  p_nama TEXT,
  p_kelas TEXT,
  p_peminatan TEXT,
  p_no_telepon TEXT,
  p_foto_url TEXT,
  p_username TEXT,
  p_password_hash TEXT,
  p_created_by UUID,
  p_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_student_id UUID;
  v_nis TEXT := NULLIF(BTRIM(p_nis), '');
  v_nama TEXT := NULLIF(BTRIM(p_nama), '');
  v_kelas TEXT := NULLIF(BTRIM(p_kelas), '');
  v_username TEXT := NULLIF(BTRIM(p_username), '');
  v_role TEXT := COALESCE(NULLIF(BTRIM(p_role), ''), 'member');
BEGIN
  IF v_nis IS NULL OR LENGTH(v_nis) > 40 THEN
    RAISE EXCEPTION 'NIS wajib diisi dan maksimal 40 karakter.' USING ERRCODE = '22023';
  END IF;
  IF v_nama IS NULL OR LENGTH(v_nama) < 2 OR LENGTH(v_nama) > 120 THEN
    RAISE EXCEPTION 'Nama siswa wajib diisi dan maksimal 120 karakter.' USING ERRCODE = '22023';
  END IF;
  IF v_kelas IS NULL OR LENGTH(v_kelas) > 80 THEN
    RAISE EXCEPTION 'Kelas wajib diisi dan maksimal 80 karakter.' USING ERRCODE = '22023';
  END IF;
  IF p_peminatan IS NOT NULL AND p_peminatan NOT IN ('kamera', 'editing', 'naskah') THEN
    RAISE EXCEPTION 'Peminatan siswa tidak valid.' USING ERRCODE = '22023';
  END IF;
  IF v_username IS NULL OR v_username !~ '^[a-zA-Z0-9._-]{3,30}$' THEN
    RAISE EXCEPTION 'Username akun siswa tidak valid.' USING ERRCODE = '22023';
  END IF;
  IF p_password_hash IS NULL OR LENGTH(p_password_hash) < 20 THEN
    RAISE EXCEPTION 'Password hash akun siswa tidak valid.' USING ERRCODE = '22023';
  END IF;
  IF v_role NOT IN ('leader', 'vice_leader', 'secretary', 'equipment_team', 'contest_team', 'member') THEN
    RAISE EXCEPTION 'Peran akun siswa tidak valid.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.users (
    username, password_hash, nama, role, is_first_login, is_active,
    created_by, updated_by, updated_at
  ) VALUES (
    v_username, p_password_hash, v_nama, v_role::public.user_role, TRUE, TRUE,
    p_created_by, p_created_by, NOW()
  )
  RETURNING id INTO v_user_id;

  INSERT INTO public.students (
    user_id, nis, nama, kelas, peminatan, no_telepon, foto_url,
    is_active, created_by, updated_by, updated_at
  ) VALUES (
    v_user_id, v_nis, v_nama, v_kelas, NULLIF(BTRIM(p_peminatan), ''),
    NULLIF(BTRIM(p_no_telepon), ''), NULLIF(BTRIM(p_foto_url), ''),
    TRUE, p_created_by, p_created_by, NOW()
  )
  RETURNING id INTO v_student_id;

  RETURN jsonb_build_object(
    'student_id', v_student_id,
    'user_id', v_user_id,
    'username', v_username,
    'role', v_role,
    'is_first_login', TRUE
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_user_role_account_boundary()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.students AS s WHERE s.user_id = NEW.id
  ) THEN
    IF NEW.role::TEXT NOT IN ('leader', 'vice_leader', 'secretary', 'equipment_team', 'contest_team', 'member') THEN
      RAISE EXCEPTION 'USER_LINKED_STUDENT_ROLE' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF OLD.role::TEXT IN ('leader', 'vice_leader', 'secretary', 'equipment_team', 'contest_team', 'member') THEN
      RAISE EXCEPTION 'USER_UNLINKED_STUDENT_ROLE' USING ERRCODE = '23514';
    END IF;
    IF NEW.role::TEXT NOT IN ('teacher', 'treasurer') THEN
      RAISE EXCEPTION 'USER_UNLINKED_STUDENT_ROLE' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_user_role_account_boundary ON public.users;
CREATE TRIGGER trg_enforce_user_role_account_boundary
  BEFORE UPDATE OF role ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_user_role_account_boundary();

REVOKE ALL ON FUNCTION public.enforce_user_role_account_boundary()
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.create_student_with_account_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_student_with_account_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT)
  TO service_role;

CREATE OR REPLACE FUNCTION public.list_unlinked_student_accounts(
  p_search TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_actor_id UUID DEFAULT NULL
)
RETURNS TABLE (id UUID, username TEXT, nama TEXT, role TEXT)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_actor_active BOOLEAN;
  v_search TEXT := NULLIF(BTRIM(p_search), '');
BEGIN
  SELECT u.is_active INTO v_actor_active
  FROM public.users AS u
  WHERE u.id = p_actor_id
    AND EXISTS (
      SELECT 1 FROM public.access_role_permissions AS rp
      WHERE rp.role_key = u.role::TEXT AND rp.permission_key = 'users.manage'
    );
  IF v_actor_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'STUDENT_ACTOR_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT u.id, u.username, u.nama, u.role::TEXT
  FROM public.users AS u
  WHERE u.is_active IS TRUE
    AND u.id <> p_actor_id
    AND u.role::TEXT IN ('leader', 'vice_leader', 'secretary', 'equipment_team', 'contest_team', 'member')
    AND NOT EXISTS (SELECT 1 FROM public.students AS s WHERE s.user_id = u.id)
    AND (
      v_search IS NULL
      OR u.nama ILIKE '%' || v_search || '%'
      OR u.username ILIKE '%' || v_search || '%'
    )
  ORDER BY u.nama, u.id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 20);
END;
$$;

CREATE OR REPLACE FUNCTION public.link_existing_student_account_atomic(
  p_user_id UUID,
  p_nis TEXT,
  p_nama TEXT,
  p_kelas TEXT,
  p_peminatan TEXT,
  p_no_telepon TEXT,
  p_foto_url TEXT,
  p_actor_id UUID,
  p_change_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_active BOOLEAN;
  v_target public.users%ROWTYPE;
  v_student_id UUID;
  v_nis TEXT := NULLIF(BTRIM(p_nis), '');
  v_nama TEXT := NULLIF(BTRIM(p_nama), '');
  v_kelas TEXT := NULLIF(BTRIM(p_kelas), '');
BEGIN
  IF p_user_id IS NULL OR p_actor_id IS NULL OR p_user_id = p_actor_id THEN
    RAISE EXCEPTION 'STUDENT_ACCOUNT_NOT_ELIGIBLE' USING ERRCODE = 'P0001';
  END IF;
  IF p_change_reason IS NULL OR CHAR_LENGTH(BTRIM(p_change_reason)) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION 'STUDENT_LINK_REASON_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT u.is_active INTO v_actor_active
  FROM public.users AS u
  WHERE u.id = p_actor_id
    AND EXISTS (
      SELECT 1 FROM public.access_role_permissions AS rp
      WHERE rp.role_key = u.role::TEXT AND rp.permission_key = 'users.manage'
    );
  IF v_actor_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'STUDENT_ACTOR_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF v_nis IS NULL OR LENGTH(v_nis) > 40
     OR v_nama IS NULL OR LENGTH(v_nama) NOT BETWEEN 2 AND 120
     OR v_kelas IS NULL OR LENGTH(v_kelas) > 80 THEN
    RAISE EXCEPTION 'Data siswa tidak valid.' USING ERRCODE = '22023';
  END IF;
  IF p_peminatan IS NOT NULL AND p_peminatan NOT IN ('kamera', 'editing', 'naskah') THEN
    RAISE EXCEPTION 'Peminatan siswa tidak valid.' USING ERRCODE = '22023';
  END IF;

  SELECT u.* INTO v_target
  FROM public.users AS u
  WHERE u.id = p_user_id
  FOR UPDATE;
  IF NOT FOUND OR v_target.is_active IS DISTINCT FROM TRUE
     OR v_target.role::TEXT NOT IN ('leader', 'vice_leader', 'secretary', 'equipment_team', 'contest_team', 'member')
     OR EXISTS (SELECT 1 FROM public.students AS s WHERE s.user_id = p_user_id) THEN
    RAISE EXCEPTION 'STUDENT_ACCOUNT_NOT_ELIGIBLE' USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.current_user_id', p_actor_id::TEXT, TRUE);
  PERFORM set_config('app.change_reason', LEFT(BTRIM(p_change_reason), 500), TRUE);
  PERFORM set_config('app.skip_legacy_audit', 'true', TRUE);

  UPDATE public.users AS u
  SET nama = v_nama,
      updated_by = p_actor_id,
      updated_at = NOW()
  WHERE u.id = p_user_id;

  INSERT INTO public.students (
    user_id, nis, nama, kelas, peminatan, no_telepon, foto_url,
    is_active, created_by, updated_by, updated_at
  ) VALUES (
    p_user_id, v_nis, v_nama, v_kelas, NULLIF(BTRIM(p_peminatan), ''),
    NULLIF(BTRIM(p_no_telepon), ''), NULLIF(BTRIM(p_foto_url), ''),
    v_target.is_active, p_actor_id, p_actor_id, NOW()
  )
  RETURNING id INTO v_student_id;

  RETURN jsonb_build_object(
    'student_id', v_student_id,
    'user_id', p_user_id,
    'username', v_target.username,
    'nama', v_nama,
    'role', v_target.role::TEXT,
    'is_first_login', v_target.is_first_login,
    'previous_account', jsonb_build_object(
      'username', v_target.username,
      'nama', v_target.nama,
      'role', v_target.role::TEXT
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.link_account_to_existing_student_atomic(
  p_student_id UUID,
  p_user_id UUID,
  p_actor_id UUID,
  p_change_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_active BOOLEAN;
  v_target public.users%ROWTYPE;
  v_student public.students%ROWTYPE;
BEGIN
  IF p_student_id IS NULL OR p_user_id IS NULL OR p_actor_id IS NULL OR p_user_id = p_actor_id THEN
    RAISE EXCEPTION 'STUDENT_LINK_TARGET_NOT_ELIGIBLE' USING ERRCODE = 'P0001';
  END IF;
  IF p_change_reason IS NULL OR CHAR_LENGTH(BTRIM(p_change_reason)) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION 'STUDENT_LINK_REASON_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT u.is_active INTO v_actor_active
  FROM public.users AS u
  WHERE u.id = p_actor_id
    AND EXISTS (
      SELECT 1 FROM public.access_role_permissions AS rp
      WHERE rp.role_key = u.role::TEXT AND rp.permission_key = 'users.manage'
    );
  IF v_actor_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'STUDENT_ACTOR_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  SELECT u.* INTO v_target
  FROM public.users AS u
  WHERE u.id = p_user_id
  FOR UPDATE;
  IF NOT FOUND OR v_target.is_active IS DISTINCT FROM TRUE
     OR v_target.role::TEXT NOT IN ('leader', 'vice_leader', 'secretary', 'equipment_team', 'contest_team', 'member')
     OR EXISTS (SELECT 1 FROM public.students AS s WHERE s.user_id = p_user_id) THEN
    RAISE EXCEPTION 'STUDENT_LINK_TARGET_NOT_ELIGIBLE' USING ERRCODE = 'P0001';
  END IF;

  SELECT s.* INTO v_student
  FROM public.students AS s
  WHERE s.id = p_student_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STUDENT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_student.user_id IS NOT NULL OR v_student.is_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'STUDENT_LINK_TARGET_NOT_ELIGIBLE' USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.current_user_id', p_actor_id::TEXT, TRUE);
  PERFORM set_config('app.change_reason', LEFT(BTRIM(p_change_reason), 500), TRUE);
  PERFORM set_config('app.skip_legacy_audit', 'true', TRUE);

  UPDATE public.users AS u
  SET nama = v_student.nama,
      updated_by = p_actor_id,
      updated_at = NOW()
  WHERE u.id = p_user_id;

  UPDATE public.students AS s
  SET user_id = p_user_id,
      updated_by = p_actor_id,
      updated_at = NOW()
  WHERE s.id = p_student_id AND s.user_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'STUDENT_LINK_TARGET_NOT_ELIGIBLE' USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object(
    'student_id', p_student_id,
    'user_id', p_user_id,
    'username', v_target.username,
    'nama', v_student.nama,
    'role', v_target.role::TEXT,
    'is_first_login', v_target.is_first_login,
    'previous_account', jsonb_build_object(
      'username', v_target.username,
      'nama', v_target.nama,
      'role', v_target.role::TEXT
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.list_unlinked_student_accounts(TEXT, INTEGER, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_unlinked_student_accounts(TEXT, INTEGER, UUID)
  TO service_role;

REVOKE ALL ON FUNCTION public.link_existing_student_account_atomic(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_existing_student_account_atomic(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT)
  TO service_role;

REVOKE ALL ON FUNCTION public.link_account_to_existing_student_atomic(UUID, UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_account_to_existing_student_atomic(UUID, UUID, UUID, TEXT)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
