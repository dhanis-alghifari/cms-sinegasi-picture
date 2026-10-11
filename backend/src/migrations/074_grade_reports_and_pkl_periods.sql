-- 074_grade_reports_and_pkl_periods.sql
-- Adds auditable semester reports and verified PKL periods without changing
-- the existing four-value attendance status contract.

BEGIN;

SELECT set_config('app.system_operation', 'true', true);
SELECT set_config('app.change_reason', 'SYSTEM:MIGRATION_074_GRADE_REPORTS_AND_PKL_PERIODS', true);

DO $$
BEGIN
  IF to_regclass('public.students') IS NULL
     OR to_regclass('public.users') IS NULL
     OR to_regclass('public.grades') IS NULL
     OR to_regtype('public.grade_value') IS NULL THEN
    RAISE EXCEPTION 'GRADE_REPORT_SCHEMA_MISSING';
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.grade_report_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year TEXT NOT NULL CHECK (academic_year ~ '^[0-9]{4}/[0-9]{4}$'),
  semester TEXT NOT NULL CHECK (semester IN ('ganjil', 'genap')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved')),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT grade_report_period_dates_valid CHECK (start_date <= end_date),
  CONSTRAINT uq_grade_report_period UNIQUE (academic_year, semester)
);

CREATE TABLE IF NOT EXISTS public.student_pkl_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  institution TEXT NOT NULL CHECK (length(trim(institution)) BETWEEN 2 AND 200),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  requested_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT student_pkl_period_dates_valid CHECK (start_date <= end_date),
  CONSTRAINT uq_student_pkl_period UNIQUE (student_id, start_date, end_date)
);

CREATE TABLE IF NOT EXISTS public.grade_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES public.grade_report_periods(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  predikat public.grade_value,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved')),
  deskripsi TEXT NOT NULL DEFAULT '',
  evidence_count INTEGER NOT NULL DEFAULT 0 CHECK (evidence_count >= 0),
  hadir_count INTEGER NOT NULL DEFAULT 0 CHECK (hadir_count >= 0),
  sakit_count INTEGER NOT NULL DEFAULT 0 CHECK (sakit_count >= 0),
  izin_count INTEGER NOT NULL DEFAULT 0 CHECK (izin_count >= 0),
  alpha_count INTEGER NOT NULL DEFAULT 0 CHECK (alpha_count >= 0),
  pkl_days INTEGER NOT NULL DEFAULT 0 CHECK (pkl_days >= 0),
  attendance_percentage NUMERIC(5, 2),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_grade_report_period_student UNIQUE (period_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_grade_report_periods_status_dates
  ON public.grade_report_periods (status, start_date DESC, end_date DESC);
CREATE INDEX IF NOT EXISTS idx_student_pkl_periods_student_dates
  ON public.student_pkl_periods (student_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_student_pkl_periods_status_dates
  ON public.student_pkl_periods (status, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_grade_reports_period_status
  ON public.grade_reports (period_id, status, student_id);

REVOKE ALL ON TABLE public.grade_report_periods, public.student_pkl_periods, public.grade_reports FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.grade_report_periods, public.student_pkl_periods, public.grade_reports TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
