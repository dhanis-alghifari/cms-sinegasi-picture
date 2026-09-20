-- 070_agenda_activities.sql
-- Shared extracurricular activity log for teachers and committee officers.
-- Dates are factual (today or earlier); future scheduling is intentionally not
-- part of this module.

BEGIN;

SELECT set_config('app.system_operation', 'true', true);
SELECT set_config('app.change_reason', 'SYSTEM:MIGRATION_070_AGENDA_ACTIVITIES', true);

DO $$
BEGIN
  IF to_regclass('public.users') IS NULL
     OR to_regclass('public.access_permissions') IS NULL
     OR to_regclass('public.access_roles') IS NULL
     OR to_regclass('public.access_role_permissions') IS NULL THEN
    RAISE EXCEPTION 'AGENDA_SCHEMA_MISSING: jalankan migration pengguna dan access-control terlebih dahulu';
  END IF;
  IF to_regprocedure('public.write_audit_log(uuid,text,text,uuid,jsonb,jsonb,text,uuid,uuid,text,text,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'AUDIT_HELPER_MISSING: public.write_audit_log belum tersedia';
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.agenda_migration_history (
  migration_name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.agenda_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_date DATE NOT NULL,
  activity_name TEXT NOT NULL CHECK (length(btrim(activity_name)) BETWEEN 2 AND 120),
  activity_description TEXT NOT NULL CHECK (length(btrim(activity_description)) BETWEEN 2 AND 2000),
  instructor_name TEXT NOT NULL CHECK (length(btrim(instructor_name)) BETWEEN 2 AND 120),
  pic_names TEXT[] NOT NULL CHECK (cardinality(pic_names) BETWEEN 1 AND 10),
  pic_names_search TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  archived_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.agenda_activity_operations (
  idempotency_key TEXT PRIMARY KEY CHECK (length(btrim(idempotency_key)) BETWEEN 8 AND 128),
  activity_id UUID REFERENCES public.agenda_activities(id) ON DELETE CASCADE,
  operation_kind TEXT NOT NULL CHECK (operation_kind IN ('create', 'update', 'archive', 'photo_reserve', 'photo_attach')),
  actor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  response_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.agenda_activity_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES public.agenda_activities(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE CHECK (length(btrim(object_key)) BETWEEN 8 AND 1024),
  storage_provider TEXT NOT NULL DEFAULT 'r2' CHECK (storage_provider = 'r2'),
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes BETWEEN 1 AND 614400),
  original_filename TEXT NOT NULL CHECK (length(btrim(original_filename)) BETWEEN 1 AND 255),
  upload_status TEXT NOT NULL DEFAULT 'pending' CHECK (upload_status IN ('pending', 'attached', 'abandoned')),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Keep PIC search consistent between the memory fallback and Supabase reads.
-- PostgreSQL does not allow array_to_string in a generated column here because
-- the function is not marked immutable, so the trigger below maintains this
-- derived search value atomically with pic_names.
ALTER TABLE public.agenda_activities
  ADD COLUMN IF NOT EXISTS pic_names_search TEXT;

UPDATE public.agenda_activities
SET pic_names_search = array_to_string(pic_names, ' ')
WHERE pic_names_search IS DISTINCT FROM array_to_string(pic_names, ' ');

ALTER TABLE public.agenda_activities
  ALTER COLUMN pic_names_search SET DEFAULT '',
  ALTER COLUMN pic_names_search SET NOT NULL;

CREATE OR REPLACE FUNCTION public.guard_agenda_activity_date()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.pic_names_search := array_to_string(NEW.pic_names, ' ');
  IF NEW.activity_date > (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_FUTURE_DATE_FORBIDDEN';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(NEW.pic_names) AS pic(name)
    WHERE name IS NULL OR length(btrim(name)) NOT BETWEEN 2 AND 100 OR name ~ '[[:cntrl:]]'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_PIC_INVALID';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_agenda_activity_date ON public.agenda_activities;
CREATE TRIGGER trg_guard_agenda_activity_date
  BEFORE INSERT OR UPDATE OF activity_date, pic_names ON public.agenda_activities
  FOR EACH ROW EXECUTE FUNCTION public.guard_agenda_activity_date();

CREATE UNIQUE INDEX IF NOT EXISTS uq_agenda_photo_pending
  ON public.agenda_activity_photos (activity_id)
  WHERE upload_status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS uq_agenda_photo_attached
  ON public.agenda_activity_photos (activity_id)
  WHERE upload_status = 'attached';
CREATE INDEX IF NOT EXISTS idx_agenda_activity_date_id
  ON public.agenda_activities (activity_date DESC, id DESC)
  WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_agenda_activity_updated_at_id
  ON public.agenda_activities (updated_at DESC, id DESC)
  WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_agenda_photo_cleanup
  ON public.agenda_activity_photos (expires_at, id)
  WHERE upload_status = 'pending';

ALTER TABLE public.agenda_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_activity_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_activity_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_migration_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.agenda_migration_history, public.agenda_activities,
  public.agenda_activity_operations, public.agenda_activity_photos
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.agenda_activities TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.agenda_activity_operations TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.agenda_activity_photos TO service_role;
GRANT SELECT, INSERT ON TABLE public.agenda_migration_history TO service_role;

INSERT INTO public.access_permissions (permission_key, label)
VALUES
  ('agenda.read', 'Melihat agenda kegiatan'),
  ('agenda.write', 'Menambah dan mengubah agenda kegiatan'),
  ('agenda.archive', 'Mengarsipkan agenda kegiatan')
ON CONFLICT (permission_key) DO UPDATE SET label = EXCLUDED.label;

INSERT INTO public.access_role_permissions (role_key, permission_key)
SELECT role_key, permission_key
FROM public.access_roles
CROSS JOIN (VALUES ('agenda.read'), ('agenda.write')) AS permissions(permission_key)
WHERE role_key IN ('teacher', 'leader', 'vice_leader', 'secretary')
ON CONFLICT DO NOTHING;

INSERT INTO public.access_role_permissions (role_key, permission_key)
SELECT role_key, 'agenda.archive'
FROM public.access_roles
WHERE role_key = 'teacher'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.create_agenda_activity_atomic(
  p_activity_date DATE,
  p_activity_name TEXT,
  p_activity_description TEXT,
  p_instructor_name TEXT,
  p_pic_names TEXT[],
  p_actor_id UUID,
  p_idempotency_key TEXT,
  p_request_id UUID DEFAULT NULL,
  p_operation_id UUID DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_activity public.agenda_activities;
  v_existing public.agenda_activity_operations;
  v_response JSONB;
BEGIN
  IF p_actor_id IS NULL OR p_activity_date IS NULL OR p_activity_date > (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE
     OR length(btrim(COALESCE(p_idempotency_key, ''))) NOT BETWEEN 8 AND 128
     OR length(btrim(COALESCE(p_activity_name, ''))) NOT BETWEEN 2 AND 120
     OR length(btrim(COALESCE(p_activity_description, ''))) NOT BETWEEN 2 AND 2000
     OR length(btrim(COALESCE(p_instructor_name, ''))) NOT BETWEEN 2 AND 120
     OR cardinality(p_pic_names) NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_INPUT_INVALID';
  END IF;

  INSERT INTO public.agenda_activity_operations (idempotency_key, operation_kind, actor_id)
  VALUES (btrim(p_idempotency_key), 'create', p_actor_id)
  ON CONFLICT (idempotency_key) DO NOTHING;
  IF NOT FOUND THEN
    SELECT * INTO v_existing FROM public.agenda_activity_operations WHERE idempotency_key = btrim(p_idempotency_key);
    IF v_existing.operation_kind <> 'create' OR v_existing.actor_id IS DISTINCT FROM p_actor_id THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_IDEMPOTENCY_REUSED';
    END IF;
    IF v_existing.response_payload IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_OPERATION_INCOMPLETE';
    END IF;
    RETURN v_existing.response_payload || jsonb_build_object('idempotent_replay', TRUE);
  END IF;

  INSERT INTO public.agenda_activities (
    activity_date, activity_name, activity_description, instructor_name, pic_names, created_by, updated_by
  ) VALUES (
    p_activity_date, btrim(p_activity_name), btrim(p_activity_description), btrim(p_instructor_name), p_pic_names, p_actor_id, p_actor_id
  ) RETURNING * INTO v_activity;

  PERFORM public.write_audit_log(
    p_actor_id, 'INSERT', 'agenda_activities', v_activity.id, NULL, public.redact_audit_json(to_jsonb(v_activity)),
    'Membuat agenda kegiatan', p_request_id, p_operation_id, 'api', p_user_agent,
    jsonb_build_object('audit_scope', 'agenda_activity_create')
  );

  v_response := jsonb_build_object('activity', to_jsonb(v_activity), 'idempotent_replay', FALSE);
  UPDATE public.agenda_activity_operations SET activity_id = v_activity.id, response_payload = v_response
  WHERE idempotency_key = btrim(p_idempotency_key);
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_agenda_activity_atomic(
  p_activity_id UUID,
  p_activity_date DATE,
  p_activity_name TEXT,
  p_activity_description TEXT,
  p_instructor_name TEXT,
  p_pic_names TEXT[],
  p_expected_version INTEGER,
  p_change_reason TEXT,
  p_actor_id UUID,
  p_idempotency_key TEXT,
  p_request_id UUID DEFAULT NULL,
  p_operation_id UUID DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current public.agenda_activities;
  v_updated public.agenda_activities;
  v_existing public.agenda_activity_operations;
  v_response JSONB;
BEGIN
  IF p_activity_id IS NULL OR p_actor_id IS NULL OR p_expected_version IS NULL OR p_expected_version < 1
     OR p_activity_date IS NULL OR p_activity_date > (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE
     OR length(btrim(COALESCE(p_activity_name, ''))) NOT BETWEEN 2 AND 120
     OR length(btrim(COALESCE(p_activity_description, ''))) NOT BETWEEN 2 AND 2000
     OR length(btrim(COALESCE(p_instructor_name, ''))) NOT BETWEEN 2 AND 120
     OR cardinality(p_pic_names) NOT BETWEEN 1 AND 10
     OR length(btrim(COALESCE(p_idempotency_key, ''))) NOT BETWEEN 8 AND 128
     OR length(btrim(COALESCE(p_change_reason, ''))) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_UPDATE_INPUT_INVALID';
  END IF;
  INSERT INTO public.agenda_activity_operations (idempotency_key, activity_id, operation_kind, actor_id)
  VALUES (btrim(p_idempotency_key), p_activity_id, 'update', p_actor_id)
  ON CONFLICT (idempotency_key) DO NOTHING;
  IF NOT FOUND THEN
    SELECT * INTO v_existing FROM public.agenda_activity_operations WHERE idempotency_key = btrim(p_idempotency_key);
    IF v_existing.activity_id IS DISTINCT FROM p_activity_id OR v_existing.operation_kind <> 'update' OR v_existing.actor_id IS DISTINCT FROM p_actor_id THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_IDEMPOTENCY_REUSED';
    END IF;
    IF v_existing.response_payload IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_OPERATION_INCOMPLETE'; END IF;
    RETURN v_existing.response_payload || jsonb_build_object('idempotent_replay', TRUE);
  END IF;

  SELECT * INTO v_current FROM public.agenda_activities WHERE id = p_activity_id FOR UPDATE;
  IF NOT FOUND OR v_current.archived_at IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_NOT_FOUND'; END IF;
  IF v_current.version <> p_expected_version THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_VERSION_CONFLICT'; END IF;
  UPDATE public.agenda_activities
  SET activity_date = p_activity_date,
      activity_name = btrim(p_activity_name), activity_description = btrim(p_activity_description),
      instructor_name = btrim(p_instructor_name), pic_names = p_pic_names,
      updated_by = p_actor_id, updated_at = NOW(), version = version + 1
  WHERE id = p_activity_id RETURNING * INTO v_updated;

  PERFORM public.write_audit_log(
    p_actor_id, 'UPDATE', 'agenda_activities', p_activity_id, public.redact_audit_json(to_jsonb(v_current)), public.redact_audit_json(to_jsonb(v_updated)),
    left(btrim(p_change_reason), 500), p_request_id, p_operation_id, 'api', p_user_agent,
    jsonb_build_object('audit_scope', 'agenda_activity_update')
  );
  v_response := jsonb_build_object('activity', to_jsonb(v_updated), 'idempotent_replay', FALSE);
  UPDATE public.agenda_activity_operations SET response_payload = v_response WHERE idempotency_key = btrim(p_idempotency_key);
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_agenda_activity_atomic(
  p_activity_id UUID,
  p_change_reason TEXT,
  p_actor_id UUID,
  p_idempotency_key TEXT,
  p_request_id UUID DEFAULT NULL,
  p_operation_id UUID DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current public.agenda_activities;
  v_updated public.agenda_activities;
  v_existing public.agenda_activity_operations;
  v_response JSONB;
BEGIN
  IF p_activity_id IS NULL OR p_actor_id IS NULL OR length(btrim(COALESCE(p_change_reason, ''))) NOT BETWEEN 5 AND 500
     OR length(btrim(COALESCE(p_idempotency_key, ''))) NOT BETWEEN 8 AND 128 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_ARCHIVE_INPUT_INVALID';
  END IF;
  INSERT INTO public.agenda_activity_operations (idempotency_key, activity_id, operation_kind, actor_id)
  VALUES (btrim(p_idempotency_key), p_activity_id, 'archive', p_actor_id)
  ON CONFLICT (idempotency_key) DO NOTHING;
  IF NOT FOUND THEN
    SELECT * INTO v_existing FROM public.agenda_activity_operations WHERE idempotency_key = btrim(p_idempotency_key);
    IF v_existing.activity_id IS DISTINCT FROM p_activity_id OR v_existing.operation_kind <> 'archive' OR v_existing.actor_id IS DISTINCT FROM p_actor_id THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_IDEMPOTENCY_REUSED'; END IF;
    IF v_existing.response_payload IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_OPERATION_INCOMPLETE'; END IF;
    RETURN v_existing.response_payload || jsonb_build_object('idempotent_replay', TRUE);
  END IF;
  SELECT * INTO v_current FROM public.agenda_activities WHERE id = p_activity_id FOR UPDATE;
  IF NOT FOUND OR v_current.archived_at IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_NOT_FOUND'; END IF;
  UPDATE public.agenda_activities SET archived_at = NOW(), archived_by = p_actor_id, updated_at = NOW(), updated_by = p_actor_id, version = version + 1
  WHERE id = p_activity_id RETURNING * INTO v_updated;
  PERFORM public.write_audit_log(p_actor_id, 'UPDATE', 'agenda_activities', p_activity_id, public.redact_audit_json(to_jsonb(v_current)), public.redact_audit_json(to_jsonb(v_updated)), left(btrim(p_change_reason), 500), p_request_id, p_operation_id, 'api', p_user_agent, jsonb_build_object('audit_scope', 'agenda_activity_archive'));
  v_response := jsonb_build_object('activity', to_jsonb(v_updated), 'idempotent_replay', FALSE);
  UPDATE public.agenda_activity_operations SET response_payload = v_response WHERE idempotency_key = btrim(p_idempotency_key);
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_agenda_photo_atomic(
  p_activity_id UUID, p_object_key TEXT, p_mime_type TEXT, p_file_size_bytes BIGINT, p_original_filename TEXT,
  p_actor_id UUID, p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_photo public.agenda_activity_photos;
  v_existing public.agenda_activity_operations;
  v_response JSONB;
BEGIN
  IF p_activity_id IS NULL OR p_actor_id IS NULL OR length(btrim(COALESCE(p_object_key, ''))) NOT BETWEEN 8 AND 1024
     OR btrim(p_object_key) !~ '^[A-Za-z0-9][A-Za-z0-9._/-]+$'
     OR p_mime_type NOT IN ('image/jpeg', 'image/png', 'image/webp')
     OR p_file_size_bytes IS NULL OR p_file_size_bytes NOT BETWEEN 1 AND 614400
     OR length(btrim(COALESCE(p_original_filename, ''))) NOT BETWEEN 1 AND 255
     OR length(btrim(COALESCE(p_idempotency_key, ''))) NOT BETWEEN 8 AND 128 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_PHOTO_INPUT_INVALID';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.agenda_activities WHERE id = p_activity_id AND archived_at IS NULL) THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_NOT_FOUND'; END IF;
  INSERT INTO public.agenda_activity_operations (idempotency_key, activity_id, operation_kind, actor_id)
  VALUES (btrim(p_idempotency_key), p_activity_id, 'photo_reserve', p_actor_id)
  ON CONFLICT (idempotency_key) DO NOTHING;
  IF NOT FOUND THEN
    SELECT * INTO v_existing FROM public.agenda_activity_operations WHERE id = btrim(p_idempotency_key);
    IF v_existing.activity_id IS DISTINCT FROM p_activity_id OR v_existing.operation_kind <> 'photo_reserve' OR v_existing.actor_id IS DISTINCT FROM p_actor_id THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_IDEMPOTENCY_REUSED'; END IF;
    IF v_existing.response_payload IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_OPERATION_INCOMPLETE'; END IF;
    RETURN v_existing.response_payload || jsonb_build_object('idempotent_replay', TRUE);
  END IF;
  IF EXISTS (SELECT 1 FROM public.agenda_activity_photos WHERE activity_id = p_activity_id AND upload_status = 'pending') THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_PHOTO_UPLOAD_IN_PROGRESS'; END IF;
  INSERT INTO public.agenda_activity_photos (activity_id, object_key, mime_type, file_size_bytes, original_filename, created_by, expires_at)
  VALUES (p_activity_id, btrim(p_object_key), p_mime_type, p_file_size_bytes, btrim(p_original_filename), p_actor_id, NOW() + INTERVAL '24 hours')
  RETURNING * INTO v_photo;
  v_response := jsonb_build_object('photo', to_jsonb(v_photo), 'idempotent_replay', FALSE);
  UPDATE public.agenda_activity_operations SET response_payload = v_response WHERE idempotency_key = btrim(p_idempotency_key);
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.attach_agenda_photo_atomic(
  p_activity_id UUID, p_photo_id UUID, p_actor_id UUID, p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_photo public.agenda_activity_photos;
  v_existing public.agenda_activity_operations;
  v_response JSONB;
BEGIN
  IF p_activity_id IS NULL OR p_photo_id IS NULL OR p_actor_id IS NULL OR length(btrim(COALESCE(p_idempotency_key, ''))) NOT BETWEEN 8 AND 128 THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_PHOTO_INPUT_INVALID'; END IF;
  INSERT INTO public.agenda_activity_operations (idempotency_key, activity_id, operation_kind, actor_id)
  VALUES (btrim(p_idempotency_key), p_activity_id, 'photo_attach', p_actor_id)
  ON CONFLICT (idempotency_key) DO NOTHING;
  IF NOT FOUND THEN
    SELECT * INTO v_existing FROM public.agenda_activity_operations WHERE idempotency_key = btrim(p_idempotency_key);
    IF v_existing.activity_id IS DISTINCT FROM p_activity_id OR v_existing.operation_kind <> 'photo_attach' OR v_existing.actor_id IS DISTINCT FROM p_actor_id THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_IDEMPOTENCY_REUSED'; END IF;
    IF v_existing.response_payload IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_OPERATION_INCOMPLETE'; END IF;
    RETURN v_existing.response_payload || jsonb_build_object('idempotent_replay', TRUE);
  END IF;
  SELECT * INTO v_photo FROM public.agenda_activity_photos WHERE id = p_photo_id AND activity_id = p_activity_id FOR UPDATE;
  IF NOT FOUND OR v_photo.upload_status <> 'pending' THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_PHOTO_INVALID'; END IF;
  UPDATE public.agenda_activity_photos SET upload_status = 'abandoned', updated_at = NOW()
  WHERE activity_id = p_activity_id AND upload_status = 'attached';
  UPDATE public.agenda_activity_photos SET upload_status = 'attached', expires_at = NULL, updated_at = NOW() WHERE id = p_photo_id RETURNING * INTO v_photo;
  v_response := jsonb_build_object('photo', to_jsonb(v_photo), 'idempotent_replay', FALSE);
  UPDATE public.agenda_activity_operations SET response_payload = v_response WHERE idempotency_key = btrim(p_idempotency_key);
  RETURN v_response;
END;
$$;

REVOKE ALL ON FUNCTION public.create_agenda_activity_atomic(DATE,TEXT,TEXT,TEXT,TEXT[],UUID,TEXT,UUID,UUID,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_agenda_activity_atomic(UUID,DATE,TEXT,TEXT,TEXT,TEXT[],INTEGER,TEXT,UUID,TEXT,UUID,UUID,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.archive_agenda_activity_atomic(UUID,TEXT,UUID,TEXT,UUID,UUID,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_agenda_photo_atomic(UUID,TEXT,TEXT,BIGINT,TEXT,UUID,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.attach_agenda_photo_atomic(UUID,UUID,UUID,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_agenda_activity_atomic(DATE,TEXT,TEXT,TEXT,TEXT[],UUID,TEXT,UUID,UUID,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_agenda_activity_atomic(UUID,DATE,TEXT,TEXT,TEXT,TEXT[],INTEGER,TEXT,UUID,TEXT,UUID,UUID,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.archive_agenda_activity_atomic(UUID,TEXT,UUID,TEXT,UUID,UUID,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_agenda_photo_atomic(UUID,TEXT,TEXT,BIGINT,TEXT,UUID,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.attach_agenda_photo_atomic(UUID,UUID,UUID,TEXT) TO service_role;

INSERT INTO public.agenda_migration_history (migration_name)
VALUES ('070_agenda_activities.sql')
ON CONFLICT (migration_name) DO NOTHING;

NOTIFY pgrst, 'reload schema';
COMMIT;
