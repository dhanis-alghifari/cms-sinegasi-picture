-- Manual student usernames, confirmed-format WhatsApp numbers, and atomic
-- one-time account issuance with replay-safe receipts. Apply after 087.
BEGIN;

SELECT set_config('app.system_operation', 'true', true);
SELECT set_config('app.change_reason', 'SYSTEM:MIGRATION_088_STUDENT_ACCOUNT_ONBOARDING', true);

DO $$
BEGIN
  IF to_regclass('public.users') IS NULL
     OR to_regclass('public.students') IS NULL
     OR to_regclass('public.access_role_permissions') IS NULL
     OR to_regprocedure('public.write_audit_log(uuid,text,text,uuid,jsonb,jsonb,text,uuid,uuid,text,text,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'STUDENT_ACCOUNT_ONBOARDING_SCHEMA_MISSING';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.users
    GROUP BY lower(btrim(username))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'STUDENT_ACCOUNT_USERNAME_NORMALIZATION_COLLISION';
  END IF;
END;
$$;

-- Username is a global login identifier. Existing usernames are preserved;
-- new names are canonical lowercase and can never collide by case/whitespace.
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username_normalized
  ON public.users (lower(btrim(username)));

CREATE TABLE IF NOT EXISTS public.student_account_operations (
  actor_id UUID NOT NULL,
  operation_key UUID NOT NULL,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('create', 'provision')),
  request_fingerprint TEXT NOT NULL CHECK (request_fingerprint ~ '^[a-f0-9]{64}$'),
  student_id UUID,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (actor_id, operation_key)
);

CREATE INDEX IF NOT EXISTS idx_student_account_operations_created_at
  ON public.student_account_operations (created_at);

ALTER TABLE public.student_account_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.student_account_operations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.student_account_operations FROM service_role;

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

  IF v_nis IS NULL OR length(v_nis) > 40
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

CREATE OR REPLACE FUNCTION public.provision_student_account_v2(
  p_student_id UUID,
  p_username TEXT,
  p_password_hash TEXT,
  p_no_telepon TEXT,
  p_created_by UUID,
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
  v_student public.students%ROWTYPE;
  v_user_id UUID;
  v_username TEXT := lower(NULLIF(BTRIM(p_username), ''));
  v_phone TEXT := NULLIF(BTRIM(p_no_telepon), '');
  v_actor_active BOOLEAN;
  v_actor_role TEXT;
  v_inserted INTEGER;
  v_operation public.student_account_operations%ROWTYPE;
  v_operation_id UUID := COALESCE(p_operation_id, p_operation_key);
BEGIN
  IF p_student_id IS NULL OR p_created_by IS NULL OR p_operation_key IS NULL THEN
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
  IF v_username IS NULL OR v_username !~ '^[a-z0-9._-]{3,30}$' THEN
    RAISE EXCEPTION 'INVALID_USERNAME' USING ERRCODE = '22023';
  END IF;
  IF v_phone IS NULL OR v_phone !~ '^\+628[1-9][0-9]{7,10}$' THEN
    RAISE EXCEPTION 'INVALID_WHATSAPP_NUMBER' USING ERRCODE = '22023';
  END IF;
  IF p_password_hash IS NULL OR length(p_password_hash) < 20 THEN
    RAISE EXCEPTION 'INVALID_PASSWORD_HASH' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.student_account_operations (
    actor_id, operation_key, operation_type, request_fingerprint
  ) VALUES (
    p_created_by, p_operation_key, 'provision', p_request_fingerprint
  ) ON CONFLICT (actor_id, operation_key) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    SELECT * INTO v_operation
    FROM public.student_account_operations AS op
    WHERE op.actor_id = p_created_by AND op.operation_key = p_operation_key
    FOR UPDATE;
    IF v_operation.operation_type <> 'provision'
       OR v_operation.request_fingerprint <> p_request_fingerprint
       OR v_operation.student_id <> p_student_id THEN
      RAISE EXCEPTION 'STUDENT_OPERATION_KEY_REUSED' USING ERRCODE = '23505';
    END IF;
    SELECT * INTO v_student FROM public.students AS s WHERE s.id = v_operation.student_id;
    IF NOT FOUND OR v_student.user_id IS NULL THEN
      RAISE EXCEPTION 'STUDENT_ACCOUNT_OPERATION_RESULT_UNAVAILABLE' USING ERRCODE = 'P0002';
    END IF;
    SELECT u.id INTO v_user_id FROM public.users AS u WHERE u.id = v_student.user_id;
    RETURN (
      SELECT jsonb_build_object(
        'student_id', v_student.id,
        'user_id', u.id,
        'username', u.username,
        'role', u.role::TEXT,
        'is_first_login', u.is_first_login,
        'operation_replayed', TRUE
      ) FROM public.users AS u WHERE u.id = v_user_id
    );
  END IF;

  SELECT * INTO v_student
  FROM public.students AS s
  WHERE s.id = p_student_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'STUDENT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_student.user_id IS NOT NULL THEN
    RAISE EXCEPTION 'STUDENT_ACCOUNT_EXISTS' USING ERRCODE = '23505';
  END IF;

  BEGIN
    INSERT INTO public.users (
      username, password_hash, nama, role, is_first_login, is_active,
      created_by, updated_by, updated_at
    ) VALUES (
      v_username, p_password_hash, v_student.nama, 'member', TRUE, v_student.is_active,
      p_created_by, p_created_by, NOW()
    ) RETURNING id INTO v_user_id;
  EXCEPTION WHEN unique_violation THEN
    IF EXISTS (SELECT 1 FROM public.users AS u WHERE lower(btrim(u.username)) = v_username) THEN
      RAISE EXCEPTION 'USERNAME_TAKEN' USING ERRCODE = '23505', CONSTRAINT = 'uq_users_username_normalized';
    END IF;
    RAISE;
  END;

  UPDATE public.students
  SET user_id = v_user_id,
      no_telepon = v_phone,
      updated_by = p_created_by,
      updated_at = NOW()
  WHERE id = p_student_id;

  UPDATE public.student_account_operations
  SET student_id = p_student_id, user_id = v_user_id
  WHERE actor_id = p_created_by AND operation_key = p_operation_key;

  PERFORM public.write_audit_log(
    p_created_by, 'UPDATE', 'students', p_student_id,
    jsonb_build_object('operation', 'student_account_missing'),
    jsonb_build_object('operation', 'student_account_provisioned', 'user_id', v_user_id),
    btrim(p_change_reason), p_request_id, v_operation_id, 'api', p_user_agent,
    jsonb_build_object('audit_scope', 'student_account_onboarding')
  );
  PERFORM public.write_audit_log(
    p_created_by, 'INSERT', 'users', v_user_id, NULL,
    jsonb_build_object('operation', 'student_account_issued', 'student_id', p_student_id, 'username', v_username, 'role', 'member', 'is_first_login', TRUE),
    btrim(p_change_reason), p_request_id, v_operation_id, 'api', p_user_agent,
    jsonb_build_object('audit_scope', 'credential_issuance')
  );

  RETURN jsonb_build_object(
    'student_id', p_student_id,
    'user_id', v_user_id,
    'username', v_username,
    'role', 'member',
    'is_first_login', TRUE,
    'operation_replayed', FALSE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_student_with_account_v2(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, UUID, TEXT, TEXT, UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_student_with_account_v2(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, UUID, TEXT, TEXT, UUID, UUID, TEXT)
  TO service_role;
REVOKE ALL ON FUNCTION public.provision_student_account_v2(UUID, TEXT, TEXT, TEXT, UUID, UUID, TEXT, TEXT, UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_student_account_v2(UUID, TEXT, TEXT, TEXT, UUID, UUID, TEXT, TEXT, UUID, UUID, TEXT)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
