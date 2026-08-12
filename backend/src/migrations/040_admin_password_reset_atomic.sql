-- 040_admin_password_reset_atomic.sql
-- Atomic, teacher-only administrative password reset.
-- Apply after migrations 017, 021, 035-039.
-- The plaintext temporary password is never stored in this database.

BEGIN;

CREATE TABLE IF NOT EXISTS public.password_reset_operations (
  operation_key TEXT PRIMARY KEY
    CHECK (char_length(operation_key) BETWEEN 8 AND 128),
  target_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  actor_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  resulting_auth_version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_operations_target_created
  ON public.password_reset_operations (target_user_id, created_at DESC);

-- Replace the legacy trigger writer so ordinary user updates are also redacted.
-- The atomic reset RPC suppresses this legacy row and writes one canonical row
-- through write_audit_log, preventing duplicate audit entries.
CREATE OR REPLACE FUNCTION public.log_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor_id UUID;
  reason TEXT;
  old_payload JSONB;
  new_payload JSONB;
  is_system_operation BOOLEAN := COALESCE(NULLIF(current_setting('app.system_operation', TRUE), '') = 'true', FALSE);
BEGIN
  IF COALESCE(NULLIF(current_setting('app.skip_legacy_audit', TRUE), ''), 'false') = 'true' THEN
    RETURN NEW;
  END IF;

  BEGIN
    actor_id := NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID;
    reason := NULLIF(current_setting('app.change_reason', TRUE), '');
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Aksi Ditolak: app.current_user_id dan app.change_reason wajib diset di level session.';
  END;

  IF reason IS NULL OR (actor_id IS NULL AND NOT is_system_operation) THEN
    RAISE EXCEPTION 'Aksi Ditolak: Prinsip Zero Silent Edits dilanggar (ID/Alasan kosong).';
  END IF;

  old_payload := public.redact_audit_json(to_jsonb(OLD));
  new_payload := public.redact_audit_json(to_jsonb(NEW));

  INSERT INTO public.activity_logs (
    user_id, action, table_name, record_id, old_values, new_values,
    aksi, tabel, data_lama, data_baru, change_reason, source
  ) VALUES (
    actor_id, TG_OP, TG_TABLE_NAME, COALESCE(NEW.id, OLD.id), old_payload, new_payload,
    TG_OP, TG_TABLE_NAME, old_payload, new_payload, reason, 'trigger'
  );
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.reset_user_password_atomic(UUID, TEXT, UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.reset_user_password_atomic(
  p_user_id UUID,
  p_password_hash TEXT,
  p_updated_by UUID,
  p_change_reason TEXT,
  p_operation_key TEXT,
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
  auth_version INTEGER,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor_role TEXT;
  actor_active BOOLEAN;
  target_row public.users;
  operation_id UUID;
  operation_inserted INTEGER;
BEGIN
  IF p_user_id IS NULL OR p_updated_by IS NULL THEN
    RAISE EXCEPTION 'RESET_ACTOR_INVALID';
  END IF;
  IF p_password_hash IS NULL OR char_length(p_password_hash) < 20 THEN
    RAISE EXCEPTION 'RESET_PASSWORD_HASH_INVALID';
  END IF;
  IF p_change_reason IS NULL OR char_length(btrim(p_change_reason)) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION 'RESET_REASON_INVALID';
  END IF;
  IF p_operation_key IS NULL OR char_length(btrim(p_operation_key)) NOT BETWEEN 8 AND 128 THEN
    RAISE EXCEPTION 'RESET_OPERATION_KEY_INVALID';
  END IF;

  SELECT u.role::TEXT, u.is_active
    INTO actor_role, actor_active
  FROM public.users AS u
  WHERE u.id = p_updated_by;
  IF NOT FOUND OR actor_active IS DISTINCT FROM TRUE OR actor_role <> 'teacher' THEN
    RAISE EXCEPTION 'RESET_ACTOR_FORBIDDEN';
  END IF;
  IF p_user_id = p_updated_by THEN
    RAISE EXCEPTION 'RESET_SELF_FORBIDDEN';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.password_reset_operations
    WHERE operation_key = btrim(p_operation_key)
  ) THEN
    RAISE EXCEPTION 'RESET_OPERATION_REPLAY';
  END IF;

  SELECT * INTO target_row
  FROM public.users AS u
  WHERE u.id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RESET_USER_NOT_FOUND';
  END IF;

  PERFORM set_config('app.current_user_id', p_updated_by::TEXT, TRUE);
  PERFORM set_config('app.change_reason', left(btrim(p_change_reason), 500), TRUE);
  PERFORM set_config('app.skip_legacy_audit', 'true', TRUE);

  UPDATE public.users AS u
  SET password_hash = p_password_hash,
      is_first_login = TRUE,
      updated_by = p_updated_by,
      updated_at = NOW(),
      auth_version = COALESCE(u.auth_version, 1) + 1
  WHERE u.id = p_user_id;

  INSERT INTO public.password_reset_operations (
    operation_key, target_user_id, actor_user_id, resulting_auth_version
  )
  SELECT btrim(p_operation_key), u.id, p_updated_by, u.auth_version
  FROM public.users AS u
  WHERE u.id = p_user_id
  ON CONFLICT (operation_key) DO NOTHING;
  GET DIAGNOSTICS operation_inserted = ROW_COUNT;
  IF operation_inserted = 0 THEN
    RAISE EXCEPTION 'RESET_OPERATION_REPLAY';
  END IF;

  operation_id := COALESCE(p_operation_id, gen_random_uuid());
  PERFORM public.write_audit_log(
    p_updated_by,
    'UPDATE',
    'users',
    p_user_id,
    jsonb_build_object('auth_version', target_row.auth_version, 'is_first_login', target_row.is_first_login),
    jsonb_build_object('operation', 'reset_password', 'auth_version', COALESCE(target_row.auth_version, 1) + 1, 'is_first_login', TRUE),
    left(btrim(p_change_reason), 500),
    p_request_id,
    operation_id,
    'api',
    NULL,
    jsonb_build_object('audit_scope', 'credential_rotation', 'idempotency_key', btrim(p_operation_key))
  );

  RETURN QUERY
  SELECT u.id, u.username, u.nama, u.role::TEXT, u.is_active, u.is_first_login,
         u.auth_version, u.updated_at
  FROM public.users AS u
  WHERE u.id = p_user_id;
END;
$$;

REVOKE ALL ON TABLE public.password_reset_operations
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.password_reset_operations TO service_role;
ALTER TABLE public.password_reset_operations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON FUNCTION public.reset_user_password_atomic(UUID, TEXT, UUID, TEXT, TEXT, UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_user_password_atomic(UUID, TEXT, UUID, TEXT, TEXT, UUID, UUID)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;

-- Existing pre-017 audit rows are immutable and may contain legacy hashes.
-- Keep those rows unchanged; use a controlled, separately approved retention
-- process if the deployment policy requires historical redaction.
-- Verification:
-- SELECT operation_key, target_user_id, actor_user_id, resulting_auth_version, created_at
-- FROM public.password_reset_operations ORDER BY created_at DESC;
