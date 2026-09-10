-- 057_attendance_correction_atomic.sql
-- Atomic teacher correction with the audit context required by trg_audit_attendance.
-- Apply after migrations 001-056.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.attendance') IS NULL
     OR to_regclass('public.students') IS NULL
     OR to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION 'ATTENDANCE_CORRECTION_SCHEMA_MISSING: tabel attendance, students, atau users belum tersedia';
  END IF;

  IF to_regprocedure('public.log_activity()') IS NULL THEN
    RAISE EXCEPTION 'AUDIT_TRIGGER_FUNCTION_MISSING: public.log_activity belum tersedia';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.correct_attendance_atomic(
  p_attendance_id UUID,
  p_status TEXT,
  p_keterangan TEXT,
  p_actor_id UUID,
  p_change_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status TEXT := LOWER(NULLIF(BTRIM(COALESCE(p_status, '')), ''));
  v_note TEXT := NULLIF(BTRIM(COALESCE(p_keterangan, '')), '');
  v_reason TEXT := NULLIF(BTRIM(COALESCE(p_change_reason, '')), '');
  v_current public.attendance;
  v_result JSONB;
BEGIN
  IF p_attendance_id IS NULL OR p_actor_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ATTENDANCE_CORRECTION_IDENTITY_INVALID';
  END IF;

  IF v_status NOT IN ('hadir', 'sakit', 'izin', 'alpha') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ATTENDANCE_CORRECTION_STATUS_INVALID';
  END IF;

  IF v_status <> 'hadir' AND v_note IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ATTENDANCE_CORRECTION_NOTE_REQUIRED';
  END IF;

  IF v_note IS NOT NULL AND LENGTH(v_note) > 500 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ATTENDANCE_CORRECTION_NOTE_TOO_LONG';
  END IF;

  IF v_reason IS NULL OR LENGTH(v_reason) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ATTENDANCE_CORRECTION_REASON_REQUIRED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = p_actor_id
      AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ATTENDANCE_CORRECTION_ACTOR_INVALID';
  END IF;

  SELECT *
  INTO v_current
  FROM public.attendance
  WHERE id = p_attendance_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'ATTENDANCE_NOT_FOUND';
  END IF;

  -- trg_audit_attendance -> log_activity() reads both values in this same
  -- transaction. The settings are transaction-local and cannot be supplied
  -- safely by a separate HTTP request or a later audit insert.
  PERFORM set_config('app.current_user_id', p_actor_id::TEXT, TRUE);
  PERFORM set_config('app.change_reason', LEFT(v_reason, 500), TRUE);

  UPDATE public.attendance
  SET status = v_status,
      keterangan = v_note,
      updated_by = p_actor_id,
      updated_at = NOW()
  WHERE id = p_attendance_id;

  -- Keep the database representation private while returning the same nested
  -- student projection consumed by the existing backend mapper.
  SELECT jsonb_build_object(
    'id', a.id,
    'student_id', a.student_id,
    'tanggal', a.tanggal,
    'status', a.status,
    'keterangan', a.keterangan,
    'is_locked', a.is_locked,
    'idempotency_key', a.idempotency_key,
    'created_by', a.created_by,
    'created_at', a.created_at,
    'updated_by', a.updated_by,
    'updated_at', a.updated_at,
    'students', jsonb_build_object(
      'id', s.id,
      'nis', s.nis,
      'nama', s.nama,
      'kelas', s.kelas,
      'peminatan', s.peminatan
    )
  )
  INTO v_result
  FROM public.attendance AS a
  JOIN public.students AS s ON s.id = a.student_id
  WHERE a.id = p_attendance_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.correct_attendance_atomic(UUID, TEXT, TEXT, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.correct_attendance_atomic(UUID, TEXT, TEXT, UUID, TEXT)
  TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
