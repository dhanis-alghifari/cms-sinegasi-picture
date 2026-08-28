-- 051_contest_update_atomic.sql
-- Atomic, auditable contest updates.
-- Apply after 047_contest_schema_reconciliation.sql and
-- 049_contest_event_contract.sql.

BEGIN;

CREATE OR REPLACE FUNCTION public.update_contest_atomic(
  p_contest_id UUID,
  p_changes JSONB,
  p_updated_by UUID,
  p_change_reason TEXT,
  p_request_id UUID DEFAULT NULL,
  p_operation_id UUID DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS SETOF public.contests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current public.contests;
  v_updated public.contests;
  v_allowed_fields CONSTANT TEXT[] := ARRAY[
    'nama', 'nama_lomba', 'nama_festival', 'jenis', 'penyelenggara',
    'level', 'tingkat', 'tanggal', 'tanggal_lomba', 'deadline', 'status',
    'status_public', 'hasil', 'kota', 'tahun_event', 'website_url',
    'deskripsi', 'planned_work_count', 'academic_year'
  ];
  v_unknown_field TEXT;
BEGIN
  IF p_contest_id IS NULL OR p_updated_by IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_UPDATE_ACTOR_INVALID';
  END IF;

  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object'
     OR NOT EXISTS (SELECT 1 FROM jsonb_object_keys(p_changes)) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_UPDATE_EMPTY';
  END IF;

  IF p_change_reason IS NULL OR char_length(btrim(p_change_reason)) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_UPDATE_REASON_INVALID';
  END IF;

  SELECT key_name
  INTO v_unknown_field
  FROM jsonb_object_keys(p_changes) AS requested(key_name)
  WHERE NOT (key_name = ANY(v_allowed_fields))
  LIMIT 1;
  IF v_unknown_field IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_UPDATE_FIELD_INVALID';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users AS actor
    WHERE actor.id = p_updated_by
      AND actor.is_active = TRUE
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_UPDATE_ACTOR_FORBIDDEN';
  END IF;

  SELECT *
  INTO v_current
  FROM public.contests AS contest
  WHERE contest.id = p_contest_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_UPDATE_NOT_FOUND';
  END IF;

  PERFORM set_config('app.current_user_id', p_updated_by::TEXT, TRUE);
  PERFORM set_config('app.change_reason', LEFT(BTRIM(p_change_reason), 500), TRUE);
  PERFORM set_config('app.skip_legacy_audit', 'true', TRUE);

  UPDATE public.contests AS contest
  SET
    nama = CASE WHEN p_changes ? 'nama' THEN p_changes->>'nama' ELSE contest.nama END,
    nama_lomba = CASE WHEN p_changes ? 'nama_lomba' THEN p_changes->>'nama_lomba' ELSE contest.nama_lomba END,
    nama_festival = CASE WHEN p_changes ? 'nama_festival' THEN p_changes->>'nama_festival' ELSE contest.nama_festival END,
    jenis = CASE WHEN p_changes ? 'jenis' THEN p_changes->>'jenis' ELSE contest.jenis END,
    penyelenggara = CASE WHEN p_changes ? 'penyelenggara' THEN p_changes->>'penyelenggara' ELSE contest.penyelenggara END,
    level = CASE WHEN p_changes ? 'level' THEN p_changes->>'level' ELSE contest.level END,
    tingkat = CASE WHEN p_changes ? 'tingkat' THEN p_changes->>'tingkat' ELSE contest.tingkat END,
    tanggal = CASE WHEN p_changes ? 'tanggal' THEN (p_changes->>'tanggal')::DATE ELSE contest.tanggal END,
    tanggal_lomba = CASE WHEN p_changes ? 'tanggal_lomba' THEN (p_changes->>'tanggal_lomba')::DATE ELSE contest.tanggal_lomba END,
    deadline = CASE WHEN p_changes ? 'deadline' THEN (p_changes->>'deadline')::DATE ELSE contest.deadline END,
    status = CASE WHEN p_changes ? 'status' THEN (p_changes->>'status')::public.contest_status ELSE contest.status END,
    status_public = CASE WHEN p_changes ? 'status_public' THEN p_changes->>'status_public' ELSE contest.status_public END,
    hasil = CASE WHEN p_changes ? 'hasil' THEN p_changes->>'hasil' ELSE contest.hasil END,
    kota = CASE WHEN p_changes ? 'kota' THEN p_changes->>'kota' ELSE contest.kota END,
    tahun_event = CASE WHEN p_changes ? 'tahun_event' THEN (p_changes->>'tahun_event')::INTEGER ELSE contest.tahun_event END,
    website_url = CASE WHEN p_changes ? 'website_url' THEN p_changes->>'website_url' ELSE contest.website_url END,
    deskripsi = CASE WHEN p_changes ? 'deskripsi' THEN p_changes->>'deskripsi' ELSE contest.deskripsi END,
    planned_work_count = CASE WHEN p_changes ? 'planned_work_count' THEN (p_changes->>'planned_work_count')::INTEGER ELSE contest.planned_work_count END,
    academic_year = CASE WHEN p_changes ? 'academic_year' THEN p_changes->>'academic_year' ELSE contest.academic_year END,
    updated_by = p_updated_by,
    updated_at = NOW()
  WHERE contest.id = p_contest_id
  RETURNING * INTO v_updated;

  PERFORM public.write_audit_log(
    p_updated_by,
    'UPDATE',
    'contests',
    p_contest_id,
    public.redact_audit_json(to_jsonb(v_current)),
    public.redact_audit_json(to_jsonb(v_updated)),
    LEFT(BTRIM(p_change_reason), 500),
    p_request_id,
    p_operation_id,
    'api',
    p_user_agent,
    jsonb_build_object('audit_scope', 'contest_update_atomic')
  );

  RETURN NEXT v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.update_contest_atomic(UUID, JSONB, UUID, TEXT, UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_contest_atomic(UUID, JSONB, UUID, TEXT, UUID, UUID, TEXT)
  TO service_role;

INSERT INTO public.contest_migration_history (migration_name)
VALUES ('051_contest_update_atomic.sql')
ON CONFLICT (migration_name) DO NOTHING;

NOTIFY pgrst, 'reload schema';
COMMIT;
