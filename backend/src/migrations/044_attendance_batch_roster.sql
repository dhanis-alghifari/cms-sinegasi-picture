-- 044_attendance_batch_roster.sql
-- Paginated attendance roster and atomic class batch recording.
-- Apply after migrations 001-043. The migration is idempotent.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_students_active_kelas_nama_id
  ON public.students (is_active, kelas, nama, id);

CREATE INDEX IF NOT EXISTS idx_attendance_tanggal_student
  ON public.attendance (tanggal, student_id);

CREATE OR REPLACE FUNCTION public.record_attendance_batch_atomic(
  p_tanggal DATE,
  p_kelas TEXT,
  p_records JSONB,
  p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows JSONB := '[]'::JSONB;
  v_class TEXT := NULLIF(BTRIM(p_kelas), '');
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'ID penginput absensi wajib diisi.' USING ERRCODE = '22023';
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
    RETURNING id, student_id, tanggal, status, keterangan, idempotency_key,
      created_by, created_at, updated_by, updated_at
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

REVOKE ALL ON FUNCTION public.record_attendance_batch_atomic(DATE, TEXT, JSONB, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_attendance_batch_atomic(DATE, TEXT, JSONB, UUID)
  TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
