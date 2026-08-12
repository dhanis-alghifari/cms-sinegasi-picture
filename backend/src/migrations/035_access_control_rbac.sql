-- 035_access_control_rbac.sql
-- Teacher-managed, deny-by-default role/capability policy store.
-- Apply after migrations 001-034. The backend uses the Supabase service role;
-- anon/authenticated clients intentionally receive no table policies.

BEGIN;

CREATE TABLE IF NOT EXISTS public.access_roles (
  role_key TEXT PRIMARY KEY CHECK (role_key IN (
    'teacher', 'leader', 'vice_leader', 'treasurer', 'secretary',
    'equipment_team', 'contest_team', 'member'
  )),
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.access_permissions (
  permission_key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.access_role_permissions (
  role_key TEXT NOT NULL REFERENCES public.access_roles(role_key) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES public.access_permissions(permission_key) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role_key, permission_key)
);

CREATE TABLE IF NOT EXISTS public.access_control_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  role_key TEXT NOT NULL,
  previous_capabilities TEXT[] NOT NULL DEFAULT '{}',
  next_capabilities TEXT[] NOT NULL DEFAULT '{}',
  change_reason TEXT NOT NULL CHECK (char_length(change_reason) BETWEEN 5 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_role_permissions_permission
  ON public.access_role_permissions (permission_key, role_key);
CREATE INDEX IF NOT EXISTS idx_access_control_audit_logs_role_created
  ON public.access_control_audit_logs (role_key, created_at DESC, id DESC);

INSERT INTO public.access_roles (role_key, label) VALUES
  ('teacher', 'Guru'),
  ('leader', 'Ketua'),
  ('vice_leader', 'Wakil Ketua'),
  ('treasurer', 'Bendahara'),
  ('secretary', 'Sekretaris'),
  ('equipment_team', 'Tim Alat'),
  ('contest_team', 'Tim Lomba'),
  ('member', 'Anggota')
ON CONFLICT (role_key) DO UPDATE SET label = EXCLUDED.label;

INSERT INTO public.access_permissions (permission_key, label)
SELECT permission_key, initcap(replace(permission_key, '.', ' '))
FROM unnest(ARRAY[
  'dashboard.read.operational', 'dashboard.read.own',
  'students.read', 'students.read.own', 'students.manage',
  'classes.read', 'classes.manage',
  'attendance.read', 'attendance.record', 'attendance.correct',
  'cash.read', 'cash.manage',
  'grades.read', 'grades.read.own', 'grades.manage',
  'equipment.read', 'equipment.manage',
  'borrowing.read', 'borrowing.manage',
  'contests.read', 'contests.submit', 'contests.manage',
  'overdue.manage',
  'notifications.read', 'audit.read', 'users.manage',
  'access_control.read', 'access_control.manage'
]::TEXT[]) AS permission(permission_key)
ON CONFLICT (permission_key) DO NOTHING;

-- Teacher: all modules and access settings.
INSERT INTO public.access_role_permissions (role_key, permission_key)
SELECT 'teacher', permission_key FROM unnest(ARRAY[
  'dashboard.read.operational', 'dashboard.read.own',
  'students.read', 'students.read.own', 'students.manage',
  'classes.read', 'classes.manage', 'attendance.read', 'attendance.record', 'attendance.correct',
  'cash.read', 'cash.manage', 'grades.read', 'grades.read.own', 'grades.manage',
  'equipment.read', 'equipment.manage', 'borrowing.read', 'borrowing.manage',
  'contests.read', 'contests.submit', 'contests.manage', 'notifications.read', 'audit.read',
  'overdue.manage', 'users.manage', 'access_control.read', 'access_control.manage'
]::TEXT[]) AS permission(permission_key)
ON CONFLICT DO NOTHING;

-- Operational role assignments follow the approved product matrix.
INSERT INTO public.access_role_permissions (role_key, permission_key)
SELECT assignments.role_key, permission.permission_key
FROM (VALUES
  ('leader', ARRAY['dashboard.read.own','students.read','students.manage','classes.read','classes.manage','attendance.read','attendance.record','attendance.correct','equipment.read','equipment.manage','borrowing.read','borrowing.manage','contests.read','contests.submit','contests.manage','grades.read.own','notifications.read']::TEXT[]),
  ('vice_leader', ARRAY['dashboard.read.own','attendance.read','attendance.record','attendance.correct','borrowing.read','borrowing.manage','contests.read','contests.submit','contests.manage','grades.read.own','notifications.read']::TEXT[]),
  ('treasurer', ARRAY['dashboard.read.own','cash.read','cash.manage','grades.read.own','notifications.read']::TEXT[]),
  ('secretary', ARRAY['dashboard.read.own','students.read','students.manage','classes.read','classes.manage','attendance.read','attendance.record','attendance.correct','grades.read.own','notifications.read']::TEXT[]),
  ('equipment_team', ARRAY['dashboard.read.own','equipment.read','equipment.manage','borrowing.read','borrowing.manage','grades.read.own','notifications.read']::TEXT[]),
  ('contest_team', ARRAY['dashboard.read.own','contests.read','contests.submit','contests.manage','grades.read.own','notifications.read']::TEXT[]),
  ('member', ARRAY['dashboard.read.own','grades.read.own','notifications.read']::TEXT[])
) AS assignments(role_key, capabilities)
CROSS JOIN LATERAL unnest(assignments.capabilities) AS permission(permission_key)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.replace_access_role_capabilities(
  p_role_key TEXT,
  p_capabilities TEXT[],
  p_actor_user_id UUID,
  p_change_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  previous_capabilities TEXT[];
BEGIN
  IF p_role_key = 'teacher' AND NOT ('access_control.manage' = ANY (COALESCE(p_capabilities, ARRAY[]::TEXT[]))) THEN
    RAISE EXCEPTION 'teacher access_control.manage capability cannot be removed';
  END IF;

  SELECT COALESCE(array_agg(permission_key ORDER BY permission_key), ARRAY[]::TEXT[])
    INTO previous_capabilities
  FROM public.access_role_permissions
  WHERE role_key = p_role_key;

  DELETE FROM public.access_role_permissions WHERE role_key = p_role_key;
  INSERT INTO public.access_role_permissions (role_key, permission_key)
  SELECT p_role_key, permission_key
  FROM unnest(COALESCE(p_capabilities, ARRAY[]::TEXT[])) AS requested(permission_key);

  INSERT INTO public.access_control_audit_logs (
    actor_user_id, role_key, previous_capabilities, next_capabilities, change_reason
  ) VALUES (
    p_actor_user_id, p_role_key, previous_capabilities,
    COALESCE(p_capabilities, ARRAY[]::TEXT[]), btrim(p_change_reason)
  );
END;
$$;

REVOKE ALL ON TABLE public.access_roles, public.access_permissions,
  public.access_role_permissions, public.access_control_audit_logs
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.access_roles,
  public.access_permissions, public.access_role_permissions,
  public.access_control_audit_logs TO service_role;
REVOKE ALL ON FUNCTION public.replace_access_role_capabilities(TEXT, TEXT[], UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_access_role_capabilities(TEXT, TEXT[], UUID, TEXT)
  TO service_role;

ALTER TABLE public.access_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_control_audit_logs ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
COMMIT;

-- Verification:
-- SELECT role_key, count(*) AS capability_count
-- FROM public.access_role_permissions GROUP BY role_key ORDER BY role_key;
-- SELECT relname, relrowsecurity FROM pg_class
-- WHERE relname IN ('access_roles','access_permissions','access_role_permissions','access_control_audit_logs');
