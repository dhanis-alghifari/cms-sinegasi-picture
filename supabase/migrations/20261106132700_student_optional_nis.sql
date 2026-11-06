-- Allow student profiles without a student number while retaining uniqueness
-- of every non-NULL number. Existing data is never rewritten.
BEGIN;

-- Prevent silently reverting changes if a target database has drifted from the
-- verified 078/083/088 functions. The updated hashes allow safe reapplication.
DO $guard$
BEGIN
  IF COALESCE((SELECT md5(prosrc) FROM pg_catalog.pg_proc
    WHERE oid = to_regprocedure('public.create_student_with_account_v2(text,text,text,text,text,text,text,text,uuid,text,uuid,text,text,uuid,uuid,text)')), '')
    NOT IN ('4d6a21ceed0bd64b35b5a92848fc5bff', '118acbb4d04a4d3b2cbad302ce026912')
    OR COALESCE((SELECT md5(prosrc) FROM pg_catalog.pg_proc
    WHERE oid = to_regprocedure('public.link_existing_student_account_atomic(uuid,text,text,text,text,text,text,uuid,text)')), '')
    NOT IN ('ace2332aede1878819af5458d23e08c9', '990a30d159e45c6a26ed4b55b28bf358') THEN
    RAISE EXCEPTION 'STUDENT_RPC_BASELINE_CHANGED: inspect live functions before migration';
  END IF;
END;
$guard$;

ALTER TABLE public.students ALTER COLUMN nis DROP NOT NULL;

-- Existing create and link RPCs are replaced below with the same signatures
-- and security policies; only their NIS validation is relaxed.
CREATE OR REPLACE FUNCTION public.create_student_with_account_v2(
  p_nis TEXT,
  p_nama TEXT,
  p_kelas TEXT,
  p_peminatan TEXT,
  p_no_telepon TEXT,
  p_foto_url TEXT,
  p_username TEXT,
  p_password_hash TEXT,
  p_created_by UUID,
  p_role TEXT,
  p_operation_key UUID,
  p_request_fingerprint TEXT,
  p_change_reason TEXT,
  p_request_id UUID DEFAULT NULL,
  p_operation_id UUID DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
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
  v_username TEXT := lower(NULLIF(BTRIM(p_username), ''));
  v_phone TEXT := NULLIF(BTRIM(p_no_telepon), '');
  v_role TEXT := COALESCE(NULLIF(BTRIM(p_role), ''), 'member');
  v_actor_active BOOLEAN;
  v_actor_role TEXT;
  v_inserted INTEGER;
  v_operation public.student_account_operations%ROWTYPE;
  v_operation_id UUID := COALESCE(p_operation_id, p_operation_key);
BEGIN
  IF p_created_by IS NULL OR p_operation_key IS NULL THEN
    RAISE EXCEPTION 'STUDENT_ACCOUNT_OPERATION_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_request_fingerprint IS NULL OR p_request_fingerprint !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'STUDENT_ACCOUNT_FINGERPRINT_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_change_reason IS NULL OR length(btrim(p_change_reason)) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION 'STUDENT_ACCOUNT_CHANGE_REASON_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT u.is_active, u.role::TEXT
    INTO v_actor_active, v_actor_role
  FROM public.users AS u
  WHERE u.id = p_created_by;
  IF v_actor_active IS DISTINCT FROM TRUE OR NOT EXISTS (
    SELECT 1 FROM public.access_role_permissions AS rp
    WHERE rp.role_key = v_actor_role AND rp.permission_key = 'students.manage'
  ) THEN
    RAISE EXCEPTION 'STUDENT_ACTOR_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF (v_nis IS NOT NULL AND (length(v_nis) > 40 OR v_nis !~ '[A-Za-z0-9]'))
     OR v_nama IS NULL OR length(v_nama) NOT BETWEEN 2 AND 120
     OR v_kelas IS NULL OR length(v_kelas) > 80 THEN
    RAISE EXCEPTION 'STUDENT_PROFILE_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_peminatan IS NOT NULL AND p_peminatan NOT IN ('kamera', 'editing', 'naskah') THEN
    RAISE EXCEPTION 'INVALID_PEMINATAN' USING ERRCODE = '22023';
  END IF;
  IF v_username IS NULL OR v_username !~ '^[a-z0-9._-]{3,30}$' THEN
    RAISE EXCEPTION 'INVALID_USERNAME' USING ERRCODE = '22023';
  END IF;
  IF v_phone IS NULL OR v_phone !~ '^\+628[1-9][0-9]{7,10}$' THEN
    RAISE EXCEPTION 'INVALID_WHATSAPP_NUMBER' USING ERRCODE = '22023';
  END IF;
  IF p_password_hash IS NULL OR length(p_password_hash) < 20 THEN
    RAISE EXCEPTION 'INVALID_PASSWORD_HASH' USING ERRCODE = '22023';
  END IF;
  IF v_role NOT IN ('leader', 'vice_leader', 'secretary', 'treasurer', 'equipment_team', 'contest_team', 'social_media_team', 'member') THEN
    RAISE EXCEPTION 'INVALID_STUDENT_ROLE' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.student_account_operations (
    actor_id, operation_key, operation_type, request_fingerprint
  ) VALUES (
    p_created_by, p_operation_key, 'create', p_request_fingerprint
  ) ON CONFLICT (actor_id, operation_key) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    SELECT * INTO v_operation
    FROM public.student_account_operations AS op
    WHERE op.actor_id = p_created_by AND op.operation_key = p_operation_key
    FOR UPDATE;
    IF v_operation.operation_type <> 'create'
       OR v_operation.request_fingerprint <> p_request_fingerprint THEN
      RAISE EXCEPTION 'STUDENT_OPERATION_KEY_REUSED' USING ERRCODE = '23505';
    END IF;
    SELECT s.id, s.user_id INTO v_student_id, v_user_id
    FROM public.students AS s
    WHERE s.id = v_operation.student_id;
    IF NOT FOUND OR v_user_id IS NULL THEN
      RAISE EXCEPTION 'STUDENT_ACCOUNT_OPERATION_RESULT_UNAVAILABLE' USING ERRCODE = 'P0002';
    END IF;
    RETURN (
      SELECT jsonb_build_object(
        'student_id', v_student_id,
        'user_id', u.id,
        'username', u.username,
        'role', u.role::TEXT,
        'is_first_login', u.is_first_login,
        'operation_replayed', TRUE
      ) FROM public.users AS u WHERE u.id = v_user_id
    );
  END IF;

  BEGIN
    INSERT INTO public.users (
      username, password_hash, nama, role, is_first_login, is_active,
      created_by, updated_by, updated_at
    ) VALUES (
      v_username, p_password_hash, v_nama, v_role::public.user_role, TRUE, TRUE,
      p_created_by, p_created_by, NOW()
    ) RETURNING id INTO v_user_id;
  EXCEPTION WHEN unique_violation THEN
    IF EXISTS (SELECT 1 FROM public.users AS u WHERE lower(btrim(u.username)) = v_username) THEN
      RAISE EXCEPTION 'USERNAME_TAKEN' USING ERRCODE = '23505', CONSTRAINT = 'uq_users_username_normalized';
    END IF;
    RAISE;
  END;

  INSERT INTO public.students (
    user_id, nis, nama, kelas, peminatan, no_telepon, foto_url,
    is_active, created_by, updated_by, updated_at
  ) VALUES (
    v_user_id, v_nis, v_nama, v_kelas, NULLIF(BTRIM(p_peminatan), ''),
    v_phone, NULLIF(BTRIM(p_foto_url), ''),
    TRUE, p_created_by, p_created_by, NOW()
  ) RETURNING id INTO v_student_id;

  UPDATE public.student_account_operations
  SET student_id = v_student_id, user_id = v_user_id
  WHERE actor_id = p_created_by AND operation_key = p_operation_key;

  PERFORM public.write_audit_log(
    p_created_by, 'INSERT', 'students', v_student_id, NULL,
    jsonb_build_object('operation', 'student_created_with_account', 'user_id', v_user_id),
    btrim(p_change_reason), p_request_id, v_operation_id, 'api', p_user_agent,
    jsonb_build_object('audit_scope', 'student_account_onboarding')
  );
  PERFORM public.write_audit_log(
    p_created_by, 'INSERT', 'users', v_user_id, NULL,
    jsonb_build_object('operation', 'student_account_issued', 'student_id', v_student_id, 'username', v_username, 'role', v_role, 'is_first_login', TRUE),
    btrim(p_change_reason), p_request_id, v_operation_id, 'api', p_user_agent,
    jsonb_build_object('audit_scope', 'credential_issuance')
  );

  RETURN jsonb_build_object(
    'student_id', v_student_id,
    'user_id', v_user_id,
    'username', v_username,
    'role', v_role,
    'is_first_login', TRUE,
    'operation_replayed', FALSE
  );
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

  IF (v_nis IS NOT NULL AND (length(v_nis) > 40 OR v_nis !~ '[A-Za-z0-9]'))
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
     OR v_target.role::TEXT NOT IN ('leader', 'vice_leader', 'secretary', 'treasurer', 'equipment_team', 'contest_team', 'social_media_team', 'member')
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

-- This is a new signature: old releases continue to use the seven/eight-argument
-- profile RPCs. The API supplies the preserved NIS when the field is omitted.
CREATE OR REPLACE FUNCTION public.update_student_profile_nis_audited_atomic(
  p_student_id UUID,
  p_nis TEXT,
  p_nama TEXT,
  p_kelas TEXT,
  p_peminatan TEXT,
  p_no_telepon TEXT,
  p_foto_url TEXT,
  p_updated_by UUID,
  p_change_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_student public.students%ROWTYPE;
  v_nis TEXT := NULLIF(btrim(p_nis), '');
  v_actor_active BOOLEAN;
  v_actor_role TEXT;
  v_previous_actor TEXT := current_setting('app.current_user_id', TRUE);
  v_previous_reason TEXT := current_setting('app.change_reason', TRUE);
  v_previous_skip TEXT := current_setting('app.skip_legacy_audit', TRUE);
BEGIN
  IF p_updated_by IS NULL THEN
    RAISE EXCEPTION 'STUDENT_ACTOR_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_change_reason IS NULL OR length(btrim(p_change_reason)) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION 'STUDENT_PROFILE_CHANGE_REASON_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT u.is_active, u.role::TEXT INTO v_actor_active, v_actor_role
  FROM public.users AS u WHERE u.id = p_updated_by;
  IF v_actor_active IS DISTINCT FROM TRUE OR NOT EXISTS (
    SELECT 1 FROM public.access_role_permissions AS rp
    WHERE rp.role_key = v_actor_role AND rp.permission_key = 'students.manage'
  ) THEN
    RAISE EXCEPTION 'STUDENT_ACTOR_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_student_id IS NULL OR NULLIF(btrim(p_nama), '') IS NULL
     OR NULLIF(btrim(p_kelas), '') IS NULL
     OR (v_nis IS NOT NULL AND (length(v_nis) > 40 OR v_nis !~ '[A-Za-z0-9]')) THEN
    RAISE EXCEPTION 'STUDENT_PROFILE_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_peminatan IS NOT NULL AND p_peminatan NOT IN ('kamera', 'editing', 'naskah') THEN
    RAISE EXCEPTION 'INVALID_PEMINATAN' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.current_user_id', p_updated_by::TEXT, TRUE);
  PERFORM set_config('app.change_reason', btrim(p_change_reason), TRUE);
  PERFORM set_config('app.skip_legacy_audit', 'false', TRUE);

  SELECT * INTO v_student FROM public.students
  WHERE id = p_student_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Siswa tidak ditemukan.' USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.students
  SET nis = v_nis, nama = btrim(p_nama), kelas = btrim(p_kelas),
      peminatan = NULLIF(btrim(p_peminatan), ''),
      no_telepon = NULLIF(btrim(p_no_telepon), ''),
      foto_url = NULLIF(btrim(p_foto_url), ''),
      updated_by = p_updated_by, updated_at = NOW()
  WHERE id = p_student_id
  RETURNING * INTO v_student;

  IF v_student.user_id IS NOT NULL THEN
    UPDATE public.users
    SET nama = v_student.nama, updated_by = p_updated_by, updated_at = NOW()
    WHERE id = v_student.user_id;
  END IF;

  PERFORM set_config('app.current_user_id', COALESCE(v_previous_actor, ''), TRUE);
  PERFORM set_config('app.change_reason', COALESCE(v_previous_reason, ''), TRUE);
  PERFORM set_config('app.skip_legacy_audit', COALESCE(v_previous_skip, ''), TRUE);
  RETURN to_jsonb(v_student);
END;
$$;

REVOKE ALL ON FUNCTION public.update_student_profile_nis_audited_atomic(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_student_profile_nis_audited_atomic(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT)
  TO service_role;
REVOKE ALL ON FUNCTION public.create_student_with_account_v2(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, UUID, TEXT, TEXT, UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_student_with_account_v2(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, UUID, TEXT, TEXT, UUID, UUID, TEXT)
  TO service_role;
REVOKE ALL ON FUNCTION public.link_existing_student_account_atomic(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_existing_student_account_atomic(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
