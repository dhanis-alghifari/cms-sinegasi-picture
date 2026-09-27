-- 083_social_media_schema_and_rbac.sql
-- Social publication and account-analytics records; all client access goes
-- through authenticated Fastify routes using the service role.
BEGIN;

SELECT set_config('app.system_operation', 'true', true);
SELECT set_config('app.change_reason', 'SYSTEM:MIGRATION_083_SOCIAL_MEDIA', true);

DO $$
BEGIN
  IF to_regclass('public.users') IS NULL
     OR to_regclass('public.access_roles') IS NULL
     OR to_regclass('public.access_permissions') IS NULL
     OR to_regclass('public.access_role_permissions') IS NULL
     OR to_regclass('public.agenda_activities') IS NULL
     OR to_regprocedure('public.write_audit_log(uuid,text,text,uuid,jsonb,jsonb,text,uuid,uuid,text,text,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'SOCIAL_MEDIA_SCHEMA_PREREQUISITE_MISSING';
  END IF;
END;
$$;

-- Extend only the known RBAC role check; table access remains service-role-only.
ALTER TABLE public.access_roles DROP CONSTRAINT IF EXISTS access_roles_role_key_check;
ALTER TABLE public.access_roles
  ADD CONSTRAINT access_roles_role_key_check
  CHECK (role_key IN (
    'teacher', 'leader', 'vice_leader', 'treasurer', 'secretary',
    'equipment_team', 'contest_team', 'social_media_team', 'member'
  ));

INSERT INTO public.access_roles (role_key, label)
VALUES ('social_media_team', 'Tim Humas')
ON CONFLICT (role_key) DO UPDATE SET label = EXCLUDED.label;

INSERT INTO public.access_permissions (permission_key, label)
VALUES
  ('social_media.read', 'Melihat Humas dan Media Sosial'),
  ('social_media.publications.manage', 'Mengelola publikasi media sosial'),
  ('social_media.metrics.manage', 'Mencatat statistik media sosial'),
  ('social_media.accounts.manage', 'Mengelola akun media sosial resmi')
ON CONFLICT (permission_key) DO UPDATE SET label = EXCLUDED.label;

INSERT INTO public.access_role_permissions (role_key, permission_key)
SELECT 'teacher', permission_key
FROM unnest(ARRAY[
  'social_media.read', 'social_media.publications.manage',
  'social_media.metrics.manage', 'social_media.accounts.manage'
]::TEXT[]) AS permission(permission_key)
ON CONFLICT DO NOTHING;

INSERT INTO public.access_role_permissions (role_key, permission_key)
SELECT 'social_media_team', permission_key
FROM unnest(ARRAY[
  'dashboard.read.own', 'grades.read.own', 'notifications.read',
  'agenda.read', 'agenda.write', 'social_media.read',
  'social_media.publications.manage', 'social_media.metrics.manage'
]::TEXT[]) AS permission(permission_key)
ON CONFLICT DO NOTHING;

-- Do not grant social_media.accounts.manage to the Humas role. Account registry
-- mutations are also teacher-only at the route boundary.
DELETE FROM public.access_role_permissions
WHERE role_key = 'social_media_team' AND permission_key = 'social_media.accounts.manage';

CREATE TABLE IF NOT EXISTS public.social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'youtube', 'whatsapp')),
  account_name TEXT NOT NULL CHECK (length(btrim(account_name)) BETWEEN 2 AND 120),
  account_url TEXT NOT NULL CHECK (length(btrim(account_url)) BETWEEN 12 AND 500),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  idempotency_key TEXT CHECK (idempotency_key IS NULL OR length(btrim(idempotency_key)) BETWEEN 8 AND 128),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_social_accounts_platform_name UNIQUE (platform, account_name)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_social_accounts_created_idempotency
  ON public.social_accounts (created_by, idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.social_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  social_account_id UUID NOT NULL REFERENCES public.social_accounts(id) ON DELETE RESTRICT,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'youtube', 'whatsapp')),
  content_type TEXT NOT NULL CHECK (content_type IN ('feed', 'reel', 'story', 'video', 'short', 'community_post', 'channel_post')),
  caption TEXT NOT NULL DEFAULT '' CHECK (length(caption) <= 5000),
  published_at DATE NOT NULL,
  platform_url TEXT,
  agenda_activity_id UUID REFERENCES public.agenda_activities(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'recorded', 'archived')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  idempotency_key TEXT NOT NULL CHECK (length(btrim(idempotency_key)) BETWEEN 8 AND 128),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_social_publication_idempotency UNIQUE (created_by, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.social_account_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  social_account_id UUID NOT NULL REFERENCES public.social_accounts(id) ON DELETE RESTRICT,
  as_of_date DATE NOT NULL,
  audience_count BIGINT NOT NULL CHECK (audience_count >= 0),
  idempotency_key TEXT NOT NULL CHECK (length(btrim(idempotency_key)) BETWEEN 8 AND 128),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_social_snapshot_account_date UNIQUE (social_account_id, as_of_date),
  CONSTRAINT uq_social_snapshot_idempotency UNIQUE (created_by, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.social_insight_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  social_account_id UUID NOT NULL REFERENCES public.social_accounts(id) ON DELETE RESTRICT,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  views BIGINT CHECK (views IS NULL OR views >= 0),
  reach BIGINT CHECK (reach IS NULL OR reach >= 0),
  interactions BIGINT CHECK (interactions IS NULL OR interactions >= 0),
  profile_visits BIGINT CHECK (profile_visits IS NULL OR profile_visits >= 0),
  published_count INTEGER CHECK (published_count IS NULL OR published_count >= 0),
  notes TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 2000),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'recorded', 'archived')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  idempotency_key TEXT NOT NULL CHECK (length(btrim(idempotency_key)) BETWEEN 8 AND 128),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT social_insight_period_dates_valid CHECK (period_start <= period_end),
  CONSTRAINT uq_social_insight_period_account_dates UNIQUE (social_account_id, period_start, period_end),
  CONSTRAINT uq_social_insight_idempotency UNIQUE (created_by, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.social_media_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID REFERENCES public.social_publications(id) ON DELETE CASCADE,
  insight_period_id UUID REFERENCES public.social_insight_periods(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE CHECK (length(btrim(object_key)) BETWEEN 8 AND 1024),
  storage_provider TEXT NOT NULL DEFAULT 'r2' CHECK (storage_provider = 'r2'),
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes BETWEEN 1 AND 5242880),
  original_filename TEXT NOT NULL CHECK (length(btrim(original_filename)) BETWEEN 1 AND 255),
  upload_status TEXT NOT NULL DEFAULT 'pending' CHECK (upload_status IN ('pending', 'attached', 'abandoned')),
  idempotency_key TEXT NOT NULL CHECK (length(btrim(idempotency_key)) BETWEEN 8 AND 128),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  CONSTRAINT social_media_evidence_exactly_one_parent CHECK ((publication_id IS NOT NULL)::INTEGER + (insight_period_id IS NOT NULL)::INTEGER = 1),
  CONSTRAINT uq_social_media_evidence_idempotency UNIQUE (created_by, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_social_publications_date_id
  ON public.social_publications (published_at DESC, id DESC) WHERE status <> 'archived';
CREATE INDEX IF NOT EXISTS idx_social_publications_platform_date
  ON public.social_publications (platform, published_at DESC, id DESC) WHERE status <> 'archived';
CREATE INDEX IF NOT EXISTS idx_social_publications_agenda
  ON public.social_publications (agenda_activity_id) WHERE agenda_activity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_social_snapshots_account_date
  ON public.social_account_snapshots (social_account_id, as_of_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_social_insight_account_period
  ON public.social_insight_periods (social_account_id, period_start DESC, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_social_evidence_publication
  ON public.social_media_evidence (publication_id, created_at, id) WHERE upload_status = 'attached';
CREATE INDEX IF NOT EXISTS idx_social_evidence_insight_period
  ON public.social_media_evidence (insight_period_id, created_at, id) WHERE upload_status = 'attached';
CREATE INDEX IF NOT EXISTS idx_social_evidence_pending_expiry
  ON public.social_media_evidence (expires_at, id) WHERE upload_status = 'pending';
-- One verified image is enough for each story, WA post, or insight period.
-- Expired pending rows are moved to abandoned before a new reservation.
CREATE UNIQUE INDEX IF NOT EXISTS uq_social_evidence_publication_active
  ON public.social_media_evidence (publication_id)
  WHERE publication_id IS NOT NULL AND upload_status IN ('pending', 'attached');
CREATE UNIQUE INDEX IF NOT EXISTS uq_social_evidence_insight_active
  ON public.social_media_evidence (insight_period_id)
  WHERE insight_period_id IS NOT NULL AND upload_status IN ('pending', 'attached');

-- Defense in depth for writes performed outside the application service.
CREATE OR REPLACE FUNCTION public.guard_social_publication_recorded()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_platform TEXT;
  v_evidence_count INTEGER;
BEGIN
  SELECT platform INTO v_platform FROM public.social_accounts WHERE id = NEW.social_account_id;
  IF v_platform IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SOCIAL_ACCOUNT_NOT_FOUND'; END IF;
  IF NEW.platform IS DISTINCT FROM v_platform THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SOCIAL_PLATFORM_MISMATCH'; END IF;
  IF NEW.content_type = 'story' AND NEW.platform NOT IN ('instagram', 'tiktok') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SOCIAL_STORY_PLATFORM_INVALID';
  END IF;
  IF NOT (
    (NEW.platform = 'instagram' AND NEW.content_type IN ('feed', 'reel', 'story'))
    OR (NEW.platform = 'tiktok' AND NEW.content_type IN ('video', 'story'))
    OR (NEW.platform = 'youtube' AND NEW.content_type IN ('video', 'short', 'community_post'))
    OR (NEW.platform = 'whatsapp' AND NEW.content_type = 'channel_post')
  ) THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SOCIAL_PLATFORM_MISMATCH'; END IF;
  IF NEW.platform_url IS NOT NULL AND btrim(NEW.platform_url) <> '' AND NOT (
    (NEW.platform = 'instagram' AND NEW.platform_url ~* '^https://([a-z0-9-]+\.)?instagram\.com(/|$)')
    OR (NEW.platform = 'tiktok' AND NEW.platform_url ~* '^https://(([a-z0-9-]+\.)?tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)(/|$)')
    OR (NEW.platform = 'youtube' AND NEW.platform_url ~* '^https://(([a-z0-9-]+\.)?youtube\.com|youtu\.be)(/|$)')
    OR (NEW.platform = 'whatsapp' AND NEW.platform_url ~* '^https://(([a-z0-9-]+\.)?whatsapp\.com|([a-z0-9-]+\.)?whatsapp\.net|wa\.me)(/|$)')
  ) THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SOCIAL_PUBLICATION_LINK_INVALID'; END IF;
  IF NEW.status = 'recorded' THEN
    IF NEW.content_type = 'story' THEN
      SELECT count(*) INTO v_evidence_count FROM public.social_media_evidence
      WHERE publication_id = NEW.id AND upload_status = 'attached';
      IF v_evidence_count < 1 THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SOCIAL_STORY_EVIDENCE_REQUIRED'; END IF;
    ELSIF NEW.platform IN ('instagram', 'tiktok', 'youtube') THEN
      IF NEW.platform_url IS NULL OR btrim(NEW.platform_url) = '' THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SOCIAL_PUBLICATION_LINK_REQUIRED'; END IF;
    ELSIF NEW.platform = 'whatsapp' THEN
      SELECT count(*) INTO v_evidence_count FROM public.social_media_evidence
      WHERE publication_id = NEW.id AND upload_status = 'attached';
      IF (NEW.platform_url IS NULL OR btrim(NEW.platform_url) = '') AND v_evidence_count < 1 THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SOCIAL_PUBLICATION_EVIDENCE_REQUIRED';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_social_publication_recorded ON public.social_publications;
CREATE TRIGGER trg_guard_social_publication_recorded
  BEFORE INSERT OR UPDATE OF social_account_id, platform, content_type, platform_url, status
  ON public.social_publications FOR EACH ROW EXECUTE FUNCTION public.guard_social_publication_recorded();

CREATE OR REPLACE FUNCTION public.guard_social_insight_recorded()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE v_evidence_count INTEGER;
BEGIN
  IF NEW.status = 'recorded' THEN
    SELECT count(*) INTO v_evidence_count FROM public.social_media_evidence
    WHERE insight_period_id = NEW.id AND upload_status = 'attached';
    IF v_evidence_count < 1 THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SOCIAL_INSIGHT_EVIDENCE_REQUIRED'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_social_insight_recorded ON public.social_insight_periods;
CREATE TRIGGER trg_guard_social_insight_recorded
  BEFORE INSERT OR UPDATE OF status ON public.social_insight_periods
  FOR EACH ROW EXECUTE FUNCTION public.guard_social_insight_recorded();

ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_account_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_insight_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_media_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.social_accounts, public.social_publications,
  public.social_account_snapshots, public.social_insight_periods, public.social_media_evidence
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.social_accounts,
  public.social_publications, public.social_account_snapshots,
  public.social_insight_periods, public.social_media_evidence TO service_role;
REVOKE ALL ON FUNCTION public.guard_social_publication_recorded() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_social_insight_recorded() FROM PUBLIC, anon, authenticated;

-- Extend existing SQL student-account safeguards without rewriting their
-- security mode, search_path, owner, or grants.
DO $$
DECLARE
  v_target RECORD;
  v_signature REGPROCEDURE;
  v_definition TEXT;
  v_rewritten TEXT;
  v_occurrences INTEGER;
  v_is_definer BOOLEAN;
  v_service_execute BOOLEAN;
  v_anon_execute BOOLEAN;
  v_authenticated_execute BOOLEAN;
BEGIN
  FOR v_target IN
    SELECT * FROM (VALUES
      ('public.create_student_with_account_atomic(text, text, text, text, text, text, text, text, uuid, text)',
       $old$IF v_role NOT IN ('leader', 'vice_leader', 'secretary', 'treasurer', 'equipment_team', 'contest_team', 'member')$old$,
       $new$IF v_role NOT IN ('leader', 'vice_leader', 'secretary', 'treasurer', 'equipment_team', 'contest_team', 'social_media_team', 'member')$new$,
       TRUE, TRUE),
      ('public.update_user_account_atomic(uuid, jsonb, uuid, text, uuid, uuid)',
       $old$'equipment_team', 'contest_team', 'member'$old$,
       $new$'equipment_team', 'contest_team', 'social_media_team', 'member'$new$,
       TRUE, TRUE),
      ('public.enforce_user_role_account_boundary()',
       $old$NEW.role::TEXT NOT IN ('leader', 'vice_leader', 'secretary', 'treasurer', 'equipment_team', 'contest_team', 'member')$old$,
       $new$NEW.role::TEXT NOT IN ('leader', 'vice_leader', 'secretary', 'treasurer', 'equipment_team', 'contest_team', 'social_media_team', 'member')$new$,
       FALSE, FALSE),
      ('public.enforce_user_role_account_boundary()',
       $old$OLD.role::TEXT IN ('leader', 'vice_leader', 'secretary', 'equipment_team', 'contest_team', 'member')$old$,
       $new$OLD.role::TEXT IN ('leader', 'vice_leader', 'secretary', 'equipment_team', 'contest_team', 'social_media_team', 'member')$new$,
       FALSE, FALSE),
      ('public.list_unlinked_student_accounts(text, integer, uuid)',
       $old$u.role::TEXT IN ('leader', 'vice_leader', 'secretary', 'treasurer', 'equipment_team', 'contest_team', 'member')$old$,
       $new$u.role::TEXT IN ('leader', 'vice_leader', 'secretary', 'treasurer', 'equipment_team', 'contest_team', 'social_media_team', 'member')$new$,
       FALSE, TRUE),
      ('public.link_existing_student_account_atomic(uuid, text, text, text, text, text, text, uuid, text)',
       $old$v_target.role::TEXT NOT IN ('leader', 'vice_leader', 'secretary', 'treasurer', 'equipment_team', 'contest_team', 'member')$old$,
       $new$v_target.role::TEXT NOT IN ('leader', 'vice_leader', 'secretary', 'treasurer', 'equipment_team', 'contest_team', 'social_media_team', 'member')$new$,
       TRUE, TRUE),
      ('public.link_account_to_existing_student_atomic(uuid, uuid, uuid, text)',
       $old$v_target.role::TEXT NOT IN ('leader', 'vice_leader', 'secretary', 'treasurer', 'equipment_team', 'contest_team', 'member')$old$,
       $new$v_target.role::TEXT NOT IN ('leader', 'vice_leader', 'secretary', 'treasurer', 'equipment_team', 'contest_team', 'social_media_team', 'member')$new$,
       TRUE, TRUE)
    ) AS changes(signature, old_clause, new_clause, expects_definer, expects_service_execute)
  LOOP
    v_signature := pg_catalog.to_regprocedure(v_target.signature);
    IF v_signature IS NULL THEN RAISE EXCEPTION 'SOCIAL_STUDENT_ROLE_FUNCTION_MISSING: %', v_target.signature; END IF;
    v_definition := pg_catalog.pg_get_functiondef(v_signature::OID);
    v_occurrences := (pg_catalog.length(v_definition) - pg_catalog.length(pg_catalog.replace(v_definition, v_target.old_clause, ''))) / pg_catalog.length(v_target.old_clause);
    IF v_occurrences <> 1 THEN RAISE EXCEPTION 'SOCIAL_STUDENT_ROLE_EXPECTED_ONE_CHECK: %', v_target.signature; END IF;
    EXECUTE pg_catalog.replace(v_definition, v_target.old_clause, v_target.new_clause);
    v_definition := pg_catalog.pg_get_functiondef(v_signature::OID);
    IF pg_catalog.strpos(v_definition, v_target.new_clause) = 0 OR pg_catalog.strpos(v_definition, v_target.old_clause) > 0 THEN
      RAISE EXCEPTION 'SOCIAL_STUDENT_ROLE_REWRITE_FAILED: %', v_target.signature;
    END IF;
    SELECT proc.prosecdef,
      pg_catalog.has_function_privilege('service_role', proc.oid, 'EXECUTE'),
      pg_catalog.has_function_privilege('anon', proc.oid, 'EXECUTE'),
      pg_catalog.has_function_privilege('authenticated', proc.oid, 'EXECUTE')
    INTO v_is_definer, v_service_execute, v_anon_execute, v_authenticated_execute
    FROM pg_catalog.pg_proc AS proc WHERE proc.oid = v_signature::OID;
    IF v_is_definer IS DISTINCT FROM v_target.expects_definer
      OR v_service_execute IS DISTINCT FROM v_target.expects_service_execute
      OR v_anon_execute IS DISTINCT FROM FALSE
      OR v_authenticated_execute IS DISTINCT FROM FALSE THEN
      RAISE EXCEPTION 'SOCIAL_STUDENT_ROLE_SECURITY_CHANGED: %', v_target.signature;
    END IF;
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
