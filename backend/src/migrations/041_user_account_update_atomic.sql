-- 041_user_account_update_atomic.sql
-- Atomic, auditable user-account updates.
-- Apply after migrations 017, 019, 035-040.
--
-- User updates must go through this RPC. The legacy users trigger expects
-- transaction-local audit context; this function sets that context, suppresses
-- the legacy duplicate row, and writes one canonical redacted audit event.

BEGIN;

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

  IF linked_student_id IS NOT NULL AND requested_role IS NOT NULL AND requested_role <> 'member' THEN
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

  -- A retry with the same effective state is safe and does not create noisy
  -- audit rows. The current canonical row is returned unchanged.
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
