-- 043_member_grades_scope.sql
-- Indexes and RLS alignment for personal grades/tasks reads.

CREATE INDEX IF NOT EXISTS idx_grades_student_updated_id
  ON public.grades (student_id, updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_assignments_kelas_due_id
  ON public.assignments (kelas, due_date DESC, id DESC);

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view_assignments_by_scope" ON public.assignments;
CREATE POLICY "view_assignments_by_scope" ON public.assignments
  FOR SELECT
  USING (
    (current_setting('request.jwt.claims', true)::json->>'role') = 'teacher'
    OR kelas IS NULL
    OR kelas = 'Semua'
    OR kelas = (
      SELECT s.kelas
      FROM public.students s
      JOIN public.users u ON u.id = s.user_id
      WHERE u.username = current_setting('request.jwt.claims', true)::json->>'username'
        AND s.is_active = true
      LIMIT 1
    )
    OR kelas = split_part((
      SELECT s.kelas
      FROM public.students s
      JOIN public.users u ON u.id = s.user_id
      WHERE u.username = current_setting('request.jwt.claims', true)::json->>'username'
        AND s.is_active = true
      LIMIT 1
    ), ' ', 1)
  );

-- Keep the database read policy consistent with the application capability
-- model: every linked student may read their own grades; only teachers retain
-- cohort-wide grade reads. The API still applies the authoritative scope.
DROP POLICY IF EXISTS "view_own_grades" ON public.grades;
CREATE POLICY "view_own_grades" ON public.grades
  FOR SELECT
  USING (
    student_id IN (
      SELECT s.id
      FROM public.students s
      JOIN public.users u ON u.id = s.user_id
      WHERE u.username = current_setting('request.jwt.claims', true)::json->>'username'
    )
    OR (current_setting('request.jwt.claims', true)::json->>'role') = 'teacher'
  );
