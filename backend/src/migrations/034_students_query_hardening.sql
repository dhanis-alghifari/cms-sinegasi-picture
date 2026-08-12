-- 034_students_query_hardening.sql
-- Additive indexes for the bounded student management and options endpoints.
-- Apply after 033_classes_query_hardening.sql and validate plans on staging.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Stable page order for the default management list and status-filtered pages.
CREATE INDEX IF NOT EXISTS idx_students_created_at_id
  ON public.students (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_students_active_created_at_id
  ON public.students (is_active, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_students_active_class_created_at_id
  ON public.students (is_active, kelas, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_students_active_peminatan_created_at_id
  ON public.students (is_active, peminatan, created_at DESC, id DESC);

-- The options endpoint filters active students and orders by display name.
CREATE INDEX IF NOT EXISTS idx_students_active_name_id
  ON public.students (is_active, nama ASC, id ASC);

-- Kelas is part of the contains-search compatibility contract. NIS and nama
-- trigram indexes already exist in 001_student_dashboard_tables.sql.
CREATE INDEX IF NOT EXISTS idx_students_kelas_trgm
  ON public.students USING gin (kelas gin_trgm_ops);

NOTIFY pgrst, 'reload schema';
