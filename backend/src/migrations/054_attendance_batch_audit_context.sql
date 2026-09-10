-- 054_attendance_batch_audit_context.sql
-- Preserve the attendance batch API while supplying the audit context required
-- by the existing Zero Silent Edits trigger on UPDATE.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.attendance') IS NULL THEN
    RAISE EXCEPTION 'ATTENDANCE_SCHEMA_MISSING: public.attendance belum tersedia';
  END IF;

  IF to_regprocedure('public.log_activity()') IS NULL THEN
    RAISE EXCEPTION 'AUDIT_TRIGGER_FUNCTION_MISSING: public.log_activity belum tersedia';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_attendance_batch_atomic(
  p_tanggal DATE,
  p_kelas TEXT,
  p_records JSONB,
  p_actor_id UUID,
  p_change_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rows JSONB := '[]'::JSONB;
  v_class TEXT := NULLIF(BTRIM(p_kelas), '');
  v_reason TEXT := NULLIF(BTRIM(p_change_reason), '');
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'ID penginput absensi wajib diisi.' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = p_actor_id
      AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Akun penginput absensi tidak aktif atau tidak ditemukan.' USING ERRCODE = '22023';
  END IF;

  IF v_reason IS NULL OR char_length(v_reason) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION 'Alasan pencatatan absensi wajib diisi.' USING ERRCODE = '22023';
  END IF;

  IF p_tanggal IS NULL THEN
    RAISE EXCEPTION 'Tanggal absensi wajib diisi.' USING ERRCODE = '22023';
  END IF;
  IF v_class IS NULL OR LOWER(v_class) = 'all' THEN
    RAISE EXCEPTION 'Satu kelas wajib dipilih.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_records) <> 'array'
     OR jsonb_array_length(p_records) < 1
     OR jsonb_array_length(p_records) > 500 THEN
    RAISE EXCEPTION 'Batch absensi harus berisi 1 sampai 500 siswa.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_records) AS item
    WHERE COALESCE(item->>'student_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) THEN
    RAISE EXCEPTION 'student_id harus berupa UUID yang valid.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_records) AS item
    WHERE COALESCE(item->>'status', '') NOT IN ('hadir', 'sakit', 'izin', 'alpha')
  ) THEN
    RAISE EXCEPTION 'Status absensi tidak valid.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_records) AS item
    WHERE COALESCE(item->>'status', '') <> 'hadir'
      AND NULLIF(BTRIM(item->>'keterangan'), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'Keterangan wajib untuk Sakit, Izin, atau Alpha.' USING ERRCODE = '22023';
  END IF;

  IF (
    SELECT COUNT(*)
    FROM jsonb_array_elements(p_records) AS item
  ) <> (
    SELECT COUNT(DISTINCT (item->>'student_id')::UUID)
    FROM jsonb_array_elements(p_records) AS item
  ) THEN
    RAISE EXCEPTION 'Siswa duplikat tidak diperbolehkan dalam satu batch.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_records) AS item(student_id UUID, status TEXT, keterangan TEXT)
    LEFT JOIN public.students AS s ON s.id = item.student_id
    WHERE s.id IS NULL
       OR s.is_active IS NOT TRUE
       OR CASE
            WHEN v_class IN ('X', 'XI', 'XII') THEN NOT (s.kelas = v_class OR s.kelas LIKE v_class || ' %')
            ELSE s.kelas <> v_class
          END
  ) THEN
    RAISE EXCEPTION 'Ada siswa yang tidak aktif atau tidak berada di kelas terpilih.' USING ERRCODE = '22023';
  END IF;

  -- The legacy attendance trigger reads these transaction-local settings.
  -- They remain visible to log_activity() during this RPC transaction.
  PERFORM set_config('app.current_user_id', p_actor_id::TEXT, TRUE);
  PERFORM set_config('app.change_reason', LEFT(v_reason, 500), TRUE);

  WITH incoming AS (
    SELECT
      item.student_id,
      item.status,
      NULLIF(BTRIM(item.keterangan), '') AS keterangan,
      format('att-%s-%s', item.student_id, p_tanggal) AS idempotency_key
    FROM jsonb_to_recordset(p_records) AS item(student_id UUID, status TEXT, keterangan TEXT)
  ), written AS (
    INSERT INTO public.attendance (
      student_id, tanggal, status, keterangan, idempotency_key,
      created_by, updated_by, updated_at
    )
    SELECT
      student_id, p_tanggal, status, keterangan, idempotency_key,
      p_actor_id, p_actor_id, NOW()
    FROM incoming
    ON CONFLICT (student_id, tanggal) DO UPDATE
      SET status = EXCLUDED.status,
          keterangan = EXCLUDED.keterangan,
          updated_by = p_actor_id,
          updated_at = NOW()
    RETURNING id, student_id, tanggal, status, keterangan, is_locked,
      idempotency_key, created_by, created_at, updated_by, updated_at
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(written) ORDER BY written.student_id), '[]'::JSONB)
  INTO v_rows
  FROM written;

  RETURN jsonb_build_object(
    'data', v_rows,
    'total', jsonb_array_length(v_rows),
    'tanggal', p_tanggal,
    'kelas', v_class
  );
END;
$$;

-- Keep the original four-argument RPC working for older backend instances.
CREATE OR REPLACE FUNCTION public.record_attendance_batch_atomic(
  p_tanggal DATE,
  p_kelas TEXT,
  p_records JSONB,
  p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN public.record_attendance_batch_atomic(
    p_tanggal,
    p_kelas,
    p_records,
    p_actor_id,
    'Mencatat absensi massal'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_attendance_batch_atomic(DATE, TEXT, JSONB, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_attendance_batch_atomic(DATE, TEXT, JSONB, UUID, TEXT)
  TO service_role;

REVOKE ALL ON FUNCTION public.record_attendance_batch_atomic(DATE, TEXT, JSONB, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_attendance_batch_atomic(DATE, TEXT, JSONB, UUID)
  TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
