-- Additive rollout: apply before the backend switches RPCs. Keep the seven-argument
-- legacy RPC intact for old releases. Canonical mirror: backend migration 090.
CREATE OR REPLACE FUNCTION public.update_student_profile_audited_atomic(
  p_student_id UUID,
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
  v_actor_role TEXT;
  v_actor_active BOOLEAN;
  v_result JSONB;
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

  -- Context must be in this RPC transaction, not in an earlier pooled request.
  -- Force the existing users audit trigger ON; do not bypass Zero Silent Edits.
  PERFORM set_config('app.current_user_id', p_updated_by::TEXT, TRUE);
  PERFORM set_config('app.change_reason', btrim(p_change_reason), TRUE);
  PERFORM set_config('app.skip_legacy_audit', 'false', TRUE);
  v_result := public.update_student_profile_atomic(
    p_student_id, p_nama, p_kelas, p_peminatan, p_no_telepon, p_foto_url, p_updated_by
  );

  -- Also avoid leaking context into subsequent calls within the same transaction.
  -- On an exception PostgreSQL rolls back the mutation and these local settings.
  PERFORM set_config('app.current_user_id', COALESCE(v_previous_actor, ''), TRUE);
  PERFORM set_config('app.change_reason', COALESCE(v_previous_reason, ''), TRUE);
  PERFORM set_config('app.skip_legacy_audit', COALESCE(v_previous_skip, ''), TRUE);
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.update_student_profile_audited_atomic(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_student_profile_audited_atomic(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT)
  TO service_role;

NOTIFY pgrst, 'reload schema';
