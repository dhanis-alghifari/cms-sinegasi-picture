-- 013_grades_management_hardening.sql
-- Align assignment metadata with the grading UI and make bulk grading atomic.

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS deskripsi TEXT,
  ADD COLUMN IF NOT EXISTS kelas TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.grades
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE OR REPLACE FUNCTION public.record_grades_bulk_atomic(
  p_assignment_id UUID,
  p_grades JSONB,
  p_graded_by UUID,
  p_change_reason TEXT
)
RETURNS SETOF public.grades
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item JSONB;
  v_student_id UUID;
  grade_row public.grades;
BEGIN
  IF p_graded_by IS NULL THEN
    RAISE EXCEPTION 'ID penginput nilai wajib diisi.';
  END IF;

  IF p_change_reason IS NULL OR length(trim(p_change_reason)) < 5 THEN
    RAISE EXCEPTION 'Alasan penyimpanan nilai minimal 5 karakter.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.assignments WHERE id = p_assignment_id) THEN
    RAISE EXCEPTION 'Tugas penilaian tidak ditemukan.';
  END IF;

  IF p_grades IS NULL OR jsonb_typeof(p_grades) <> 'array' OR jsonb_array_length(p_grades) = 0 THEN
    RAISE EXCEPTION 'Daftar nilai tidak boleh kosong.';
  END IF;

  PERFORM set_config('app.current_user_id', p_graded_by::TEXT, TRUE);
  PERFORM set_config('app.change_reason', left(trim(p_change_reason), 500), TRUE);

  FOR item IN SELECT value FROM jsonb_array_elements(p_grades)
  LOOP
    BEGIN
      v_student_id := (item->>'student_id')::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'ID siswa pada payload nilai tidak valid.';
    END;

    IF v_student_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.students WHERE id = v_student_id) THEN
      RAISE EXCEPTION 'Siswa pada payload nilai tidak ditemukan.';
    END IF;

    IF item->>'nilai' NOT IN ('A', 'B', 'C', 'D', 'E') THEN
      RAISE EXCEPTION 'Predikat nilai harus A, B, C, D, atau E.';
    END IF;

    INSERT INTO public.grades (
      student_id, assignment_id, nilai, status, keterangan, graded_by,
      created_by, updated_by, created_at, updated_at
    ) VALUES (
      v_student_id,
      p_assignment_id,
      (item->>'nilai')::grade_value,
      'graded',
      NULLIF(trim(item->>'keterangan'), ''),
      p_graded_by,
      p_graded_by,
      p_graded_by,
      NOW(),
      NOW()
    )
    ON CONFLICT ON CONSTRAINT uq_student_assignment DO UPDATE SET
      nilai = EXCLUDED.nilai,
      status = EXCLUDED.status,
      keterangan = EXCLUDED.keterangan,
      graded_by = EXCLUDED.graded_by,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
    RETURNING * INTO grade_row;

    RETURN NEXT grade_row;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_grades_bulk_atomic(UUID, JSONB, UUID, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
