-- 048_contest_media_works.sql
-- Generalized contest works, entry pipeline, assignments, tasks, evidence,
-- and atomic entry/status transitions. Additive: legacy film tables remain readable.

BEGIN;

ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS planned_work_count INTEGER,
  ADD COLUMN IF NOT EXISTS academic_year TEXT NOT NULL DEFAULT to_char(CURRENT_DATE, 'YYYY');

ALTER TABLE public.contests
  DROP CONSTRAINT IF EXISTS contests_planned_work_count_check,
  ADD CONSTRAINT contests_planned_work_count_check
    CHECK (planned_work_count IS NULL OR planned_work_count > 0),
  DROP CONSTRAINT IF EXISTS contests_academic_year_check,
  ADD CONSTRAINT contests_academic_year_check
    CHECK (academic_year ~ '^[0-9]{4}$');

CREATE TABLE IF NOT EXISTS public.work_types (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.work_types (code, label, sort_order)
VALUES
  ('short_film', 'Film Pendek', 10),
  ('documentary', 'Dokumenter', 20),
  ('photography', 'Fotografi', 30),
  ('animation', 'Animasi', 40),
  ('commercial', 'Iklan / Komersial', 50),
  ('music_video', 'Video Musik', 60),
  ('experimental', 'Eksperimental', 70),
  ('other', 'Lainnya', 99)
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order;

CREATE TABLE IF NOT EXISTS public.media_works (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 2 AND 200),
  work_type_code TEXT NOT NULL REFERENCES public.work_types(code) ON UPDATE CASCADE,
  description TEXT,
  duration_minutes NUMERIC(6,2) CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  production_year INTEGER CHECK (production_year IS NULL OR production_year BETWEEN 1900 AND 2200),
  primary_asset_url TEXT,
  video_url TEXT,
  legacy_submission_id UUID,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Required when the table already exists from an earlier/manual deployment.
ALTER TABLE public.media_works
  ADD COLUMN IF NOT EXISTS legacy_submission_id UUID;

CREATE TABLE IF NOT EXISTS public.contest_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  work_id UUID NOT NULL REFERENCES public.media_works(id) ON DELETE RESTRICT,
  pipeline_status TEXT NOT NULL DEFAULT 'proses_submit'
    CHECK (pipeline_status IN ('proses_submit', 'sudah_terkirim', 'menunggu_pengumuman', 'selesai')),
  result_label TEXT,
  result_note TEXT,
  submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_contest_entry_work UNIQUE (contest_id, work_id),
  CONSTRAINT contest_entry_result_check CHECK (
    pipeline_status <> 'selesai' OR length(trim(COALESCE(result_label, ''))) >= 2
  )
);

CREATE TABLE IF NOT EXISTS public.contest_entry_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.contest_entries(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (length(trim(role)) BETWEEN 2 AND 120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_contest_entry_member_role UNIQUE (entry_id, student_id, role)
);

CREATE TABLE IF NOT EXISTS public.contest_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.contest_entries(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 2 AND 200),
  description TEXT,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.contest_task_assignees (
  task_id UUID NOT NULL REFERENCES public.contest_tasks(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (task_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.contest_entry_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.contest_entries(id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('submission', 'result', 'other')),
  object_key TEXT,
  public_url TEXT NOT NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.contest_entry_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.contest_entries(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL CHECK (to_status IN ('proses_submit', 'sudah_terkirim', 'menunggu_pengumuman', 'selesai')),
  change_reason TEXT NOT NULL CHECK (length(trim(change_reason)) >= 5),
  changed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_works_type_title
  ON public.media_works (work_type_code, lower(title));
CREATE UNIQUE INDEX IF NOT EXISTS uq_media_works_legacy_submission
  ON public.media_works (legacy_submission_id)
  WHERE legacy_submission_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contest_entries_contest_status_updated
  ON public.contest_entries (contest_id, pipeline_status, updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_contest_entries_work_id
  ON public.contest_entries (work_id);
CREATE INDEX IF NOT EXISTS idx_contest_entry_members_student
  ON public.contest_entry_members (student_id, entry_id);
CREATE INDEX IF NOT EXISTS idx_contest_tasks_entry_status_due
  ON public.contest_tasks (entry_id, status, due_date, id);
CREATE INDEX IF NOT EXISTS idx_contest_task_assignees_student
  ON public.contest_task_assignees (student_id, task_id);
CREATE INDEX IF NOT EXISTS idx_contest_entry_evidence_entry_created
  ON public.contest_entry_evidence (entry_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_contest_entry_history_entry_created
  ON public.contest_entry_status_history (entry_id, created_at DESC, id DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.contests
    GROUP BY lower(trim(nama_lomba)), academic_year
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'MIGRATION_PREFLIGHT_FAILED: duplicate contest names in academic year';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_contest_name_academic_year
  ON public.contests (lower(trim(nama_lomba)), academic_year);

-- Backfill the existing film catalog into the generalized work catalog.
INSERT INTO public.media_works (
  id, title, work_type_code, description, duration_minutes, production_year,
  primary_asset_url, video_url, created_at
)
SELECT
  f.id,
  f.judul,
  CASE f.genre
    WHEN 'short_film' THEN 'short_film'
    WHEN 'dokumenter' THEN 'documentary'
    WHEN 'animasi' THEN 'animation'
    WHEN 'iklan' THEN 'commercial'
    WHEN 'klip_musik' THEN 'music_video'
    WHEN 'eksperimental' THEN 'experimental'
    ELSE 'other'
  END,
  f.sinopsis,
  f.durasi_menit,
  f.tahun_produksi,
  f.thumbnail_url,
  f.video_url,
  f.created_at
FROM public.film_works f
ON CONFLICT (id) DO NOTHING;

-- Rich legacy submissions without a film_id become standalone media works.
-- Persist the source identity so this backfill is session-independent and
-- idempotent when the migration is retried in Supabase SQL Editor.
INSERT INTO public.media_works (
  title, work_type_code, video_url, legacy_submission_id, created_by, created_at
)
SELECT s.judul_film, 'short_film', s.link_video, s.id, s.created_by, s.created_at
FROM public.contest_submissions s
WHERE s.film_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.contest_entries (id, contest_id, work_id, pipeline_status, result_label, created_by, created_at)
-- The legacy contest_films junction only stores id, contest_id, and film_id.
-- Reuse the linked work audit values instead of assuming junction audit columns.
SELECT cf.id, cf.contest_id, cf.film_id, 'proses_submit', NULL, mw.created_by, mw.created_at
FROM public.contest_films cf
JOIN public.media_works mw ON mw.id = cf.film_id
ON CONFLICT DO NOTHING;

INSERT INTO public.contest_entries (id, contest_id, work_id, pipeline_status, result_label, created_by, created_at)
SELECT s.id, s.contest_id, COALESCE(s.film_id, legacy_work.id), 'proses_submit', NULLIF(trim(s.award_status), 'Peserta'), s.created_by, s.created_at
FROM public.contest_submissions s
LEFT JOIN public.media_works legacy_work ON legacy_work.legacy_submission_id = s.id
JOIN public.media_works mw ON mw.id = COALESCE(s.film_id, legacy_work.id)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.create_contest_entry_atomic(
  p_contest_id UUID,
  p_work_id UUID,
  p_title TEXT,
  p_work_type_code TEXT,
  p_description TEXT,
  p_primary_asset_url TEXT,
  p_video_url TEXT,
  p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_work_id UUID := p_work_id;
  v_entry public.contest_entries;
BEGIN
  IF p_contest_id IS NULL OR p_actor_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_ENTRY_IDENTITY_INVALID';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_actor_id AND is_active = TRUE) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_ENTRY_ACTOR_INVALID';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contests WHERE id = p_contest_id) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_NOT_FOUND';
  END IF;
  IF p_work_id IS NULL THEN
    IF length(trim(COALESCE(p_title, ''))) NOT BETWEEN 2 AND 200 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'WORK_TITLE_INVALID';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.work_types WHERE code = p_work_type_code AND is_active = TRUE) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'WORK_TYPE_INVALID';
    END IF;
    INSERT INTO public.media_works (title, work_type_code, description, primary_asset_url, video_url, created_by, updated_by)
    VALUES (trim(p_title), p_work_type_code, NULLIF(trim(p_description), ''), NULLIF(trim(p_primary_asset_url), ''), NULLIF(trim(p_video_url), ''), p_actor_id, p_actor_id)
    RETURNING id INTO v_work_id;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.media_works WHERE id = p_work_id) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'WORK_NOT_FOUND';
    END IF;
  END IF;

  INSERT INTO public.contest_entries (contest_id, work_id, created_by, updated_by)
  VALUES (p_contest_id, v_work_id, p_actor_id, p_actor_id)
  RETURNING * INTO v_entry;

  RETURN jsonb_build_object(
    'entry', to_jsonb(v_entry),
    'work', (SELECT to_jsonb(mw) FROM public.media_works mw WHERE mw.id = v_work_id)
  );
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_ENTRY_ALREADY_EXISTS';
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_contest_entry_atomic(
  p_entry_id UUID,
  p_status TEXT,
  p_result_label TEXT,
  p_result_note TEXT,
  p_evidence_url TEXT,
  p_evidence_type TEXT,
  p_change_reason TEXT,
  p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry public.contest_entries;
  v_previous_status TEXT;
BEGIN
  IF p_actor_id IS NULL OR length(trim(COALESCE(p_change_reason, ''))) < 5 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHANGE_REASON_REQUIRED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_actor_id AND is_active = TRUE) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_ENTRY_ACTOR_INVALID';
  END IF;
  IF p_status NOT IN ('proses_submit', 'sudah_terkirim', 'menunggu_pengumuman', 'selesai') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ENTRY_STATUS_INVALID';
  END IF;
  IF p_status IN ('sudah_terkirim', 'selesai') AND length(trim(COALESCE(p_evidence_url, ''))) < 1 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ENTRY_EVIDENCE_REQUIRED';
  END IF;
  IF p_status = 'selesai' AND length(trim(COALESCE(p_result_label, ''))) < 2 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ENTRY_RESULT_REQUIRED';
  END IF;

  SELECT * INTO v_entry FROM public.contest_entries WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONTEST_ENTRY_NOT_FOUND';
  END IF;
  v_previous_status := v_entry.pipeline_status;

  IF p_evidence_url IS NOT NULL AND length(trim(p_evidence_url)) > 0 THEN
    INSERT INTO public.contest_entry_evidence (entry_id, evidence_type, public_url, created_by)
    VALUES (p_entry_id, COALESCE(NULLIF(p_evidence_type, ''), CASE WHEN p_status = 'selesai' THEN 'result' ELSE 'submission' END), trim(p_evidence_url), p_actor_id);
  END IF;

  UPDATE public.contest_entries
  SET pipeline_status = p_status,
      result_label = NULLIF(trim(p_result_label), ''),
      result_note = NULLIF(trim(p_result_note), ''),
      submitted_at = CASE WHEN p_status IN ('sudah_terkirim', 'menunggu_pengumuman', 'selesai') THEN COALESCE(submitted_at, NOW()) ELSE submitted_at END,
      completed_at = CASE WHEN p_status = 'selesai' THEN COALESCE(completed_at, NOW()) ELSE completed_at END,
      updated_by = p_actor_id,
      updated_at = NOW(),
      version = version + 1
  WHERE id = p_entry_id
  RETURNING * INTO v_entry;

  INSERT INTO public.contest_entry_status_history (entry_id, from_status, to_status, change_reason, changed_by)
  VALUES (p_entry_id, v_previous_status, p_status, trim(p_change_reason), p_actor_id);

  RETURN jsonb_build_object('entry', to_jsonb(v_entry));
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_contest_entry_atomic(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.transition_contest_entry_atomic(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO service_role;
REVOKE EXECUTE ON FUNCTION public.create_contest_entry_atomic(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.transition_contest_entry_atomic(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;

INSERT INTO public.contest_migration_history (migration_name)
VALUES ('048_contest_media_works.sql')
ON CONFLICT (migration_name) DO NOTHING;

NOTIFY pgrst, 'reload schema';
COMMIT;
