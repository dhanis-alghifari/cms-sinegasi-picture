-- 067_allow_student_committee_roles.sql
-- Allow linked student accounts to use committee roles while keeping Teacher
-- reserved for accounts that are not linked to a student profile.
-- Apply after migration 041_user_account_update_atomic.sql.

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
SET search_path = public, pg_temp
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
  IF v_role NOT IN (
    'leader', 'vice_leader', 'treasurer', 'secretary',
    'equipment_team', 'contest_team', 'member'
  ) THEN
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

CREATE OR REPLACE FUNCTION public.update_user_account_atomic(
  p_user_id UUID,
  p_changes JSONB,
  p_updated_by UUID,
  p_change_reason TEXT,
  p_request_id UUID DEFAULT NULL,
  p_operation_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  username TEXT,
  nama TEXT,
  role TEXT,
  is_active BOOLEAN,
  is_first_login BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor_role TEXT;
  actor_active BOOLEAN;
  target_row public.users;
  linked_student_id UUID;
  linked_student_name TEXT;
  linked_student_active BOOLEAN;
  requested_username TEXT;
  requested_name TEXT;
  requested_role TEXT;
  requested_active BOOLEAN;
  changed_fields TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF p_user_id IS NULL OR p_updated_by IS NULL THEN
    RAISE EXCEPTION 'USER_UPDATE_ACTOR_INVALID';
  END IF;
  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object'
     OR NOT EXISTS (SELECT 1 FROM jsonb_object_keys(p_changes)) THEN
    RAISE EXCEPTION 'USER_UPDATE_EMPTY';
  END IF;
  IF p_change_reason IS NULL OR char_length(btrim(p_change_reason)) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION 'USER_UPDATE_REASON_INVALID';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_changes) AS requested(key_name)
    WHERE requested.key_name NOT IN ('username', 'nama', 'role', 'is_active')
  ) THEN
    RAISE EXCEPTION 'USER_UPDATE_FIELD_INVALID';
  END IF;

  SELECT u.role::TEXT, u.is_active
    INTO actor_role, actor_active
  FROM public.users AS u
  WHERE u.id = p_updated_by;
  IF NOT FOUND OR actor_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'USER_UPDATE_ACTOR_FORBIDDEN';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.access_role_permissions AS rp
    WHERE rp.role_key = actor_role
      AND rp.permission_key = 'users.manage'
  ) THEN
    RAISE EXCEPTION 'USER_UPDATE_ACTOR_FORBIDDEN';
  END IF;

  SELECT * INTO target_row
  FROM public.users AS u
  WHERE u.id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_UPDATE_NOT_FOUND';
  END IF;

  SELECT s.id, s.nama, s.is_active
    INTO linked_student_id, linked_student_name, linked_student_active
  FROM public.students AS s
  WHERE s.user_id = p_user_id
  LIMIT 1;

  IF p_changes ? 'username' THEN
    IF jsonb_typeof(p_changes->'username') <> 'string' THEN
      RAISE EXCEPTION 'USER_UPDATE_USERNAME_INVALID';
    END IF;
    requested_username := btrim(p_changes->>'username');
    IF requested_username !~ '^[A-Za-z0-9._-]{3,30}$' THEN
      RAISE EXCEPTION 'USER_UPDATE_USERNAME_INVALID';
    END IF;
  END IF;

  IF p_changes ? 'nama' THEN
    IF jsonb_typeof(p_changes->'nama') <> 'string' THEN
      RAISE EXCEPTION 'USER_UPDATE_NAME_INVALID';
    END IF;
    requested_name := btrim(p_changes->>'nama');
    IF char_length(requested_name) NOT BETWEEN 2 AND 200 THEN
      RAISE EXCEPTION 'USER_UPDATE_NAME_INVALID';
    END IF;
  END IF;

  IF p_changes ? 'role' THEN
    IF jsonb_typeof(p_changes->'role') <> 'string' THEN
      RAISE EXCEPTION 'USER_UPDATE_ROLE_INVALID';
    END IF;
    requested_role := p_changes->>'role';
    IF requested_role NOT IN (
      'teacher', 'leader', 'vice_leader', 'treasurer', 'secretary',
      'equipment_team', 'contest_team', 'member'
    ) THEN
      RAISE EXCEPTION 'USER_UPDATE_ROLE_INVALID';
    END IF;
  END IF;

  IF p_changes ? 'is_active' THEN
    IF jsonb_typeof(p_changes->'is_active') <> 'boolean' THEN
      RAISE EXCEPTION 'USER_UPDATE_STATUS_INVALID';
    END IF;
    requested_active := (p_changes->>'is_active')::BOOLEAN;
  END IF;

  IF linked_student_id IS NOT NULL AND requested_role = 'teacher' THEN
    RAISE EXCEPTION 'USER_LINKED_STUDENT_ROLE';
  END IF;
  IF linked_student_id IS NOT NULL AND requested_name IS NOT NULL
     AND requested_name IS DISTINCT FROM target_row.nama THEN
    RAISE EXCEPTION 'USER_LINKED_STUDENT_NAME';
  END IF;
  IF linked_student_id IS NOT NULL AND requested_active IS TRUE
     AND linked_student_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'USER_INACTIVE_STUDENT';
  END IF;

  IF p_changes ? 'username' AND target_row.username IS DISTINCT FROM requested_username THEN
    changed_fields := array_append(changed_fields, 'username');
  END IF;
  IF p_changes ? 'nama' AND target_row.nama IS DISTINCT FROM requested_name THEN
    changed_fields := array_append(changed_fields, 'nama');
  END IF;
  IF p_changes ? 'role' AND target_row.role::TEXT IS DISTINCT FROM requested_role THEN
    changed_fields := array_append(changed_fields, 'role');
  END IF;
  IF p_changes ? 'is_active' AND target_row.is_active IS DISTINCT FROM requested_active THEN
    changed_fields := array_append(changed_fields, 'is_active');
  END IF;

  IF cardinality(changed_fields) = 0 THEN
    RETURN QUERY
    SELECT u.id, u.username, u.nama, u.role::TEXT, u.is_active,
           u.is_first_login, u.created_at, u.updated_at, u.created_by, u.updated_by
    FROM public.users AS u
    WHERE u.id = p_user_id;
    RETURN;
  END IF;

  PERFORM set_config('app.current_user_id', p_updated_by::TEXT, TRUE);
  PERFORM set_config('app.change_reason', left(btrim(p_change_reason), 500), TRUE);
  PERFORM set_config('app.skip_legacy_audit', 'true', TRUE);

  UPDATE public.users AS u
  SET username = COALESCE(requested_username, u.username),
      nama = COALESCE(requested_name, u.nama),
      role = COALESCE(requested_role::public.user_role, u.role),
      is_active = COALESCE(requested_active, u.is_active),
      updated_by = p_updated_by,
      updated_at = NOW()
  WHERE u.id = p_user_id;

  PERFORM public.write_audit_log(
    p_updated_by,
    'UPDATE',
    'users',
    p_user_id,
    jsonb_build_object(
      'username', target_row.username,
      'nama', target_row.nama,
      'role', target_row.role::TEXT,
      'is_active', target_row.is_active
    ),
    jsonb_build_object(
      'operation', 'update_user_account',
      'changed_fields', changed_fields,
      'username', COALESCE(requested_username, target_row.username),
      'nama', COALESCE(requested_name, target_row.nama),
      'role', COALESCE(requested_role, target_row.role::TEXT),
      'is_active', COALESCE(requested_active, target_row.is_active)
    ),
    left(btrim(p_change_reason), 500),
    p_request_id,
    p_operation_id,
    'api',
    NULL,
    jsonb_build_object('audit_scope', 'user_account')
  );

  RETURN QUERY
  SELECT u.id, u.username, u.nama, u.role::TEXT, u.is_active,
         u.is_first_login, u.created_at, u.updated_at, u.created_by, u.updated_by
  FROM public.users AS u
  WHERE u.id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_user_account_atomic(UUID, JSONB, UUID, TEXT, UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_account_atomic(UUID, JSONB, UUID, TEXT, UUID, UUID)
  TO service_role;

REVOKE ALL ON FUNCTION public.create_student_with_account_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_student_with_account_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;

-- Verification:
-- SELECT p.oid::regprocedure AS function_signature,
--        p.prosecdef AS security_definer,
--        has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
--        has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
--        has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute
-- FROM pg_proc AS p
-- JOIN pg_namespace AS n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND p.proname = 'update_user_account_atomic';
