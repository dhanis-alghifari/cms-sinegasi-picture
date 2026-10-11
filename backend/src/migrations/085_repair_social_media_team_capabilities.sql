-- Restore the expected least-privilege Humas grants when an earlier RBAC seed
-- was incomplete. Account registry management remains teacher-only.
BEGIN;

SELECT set_config('app.system_operation', 'true', true);
SELECT set_config('app.change_reason', 'SYSTEM:MIGRATION_085_REPAIR_SOCIAL_MEDIA_TEAM_CAPABILITIES', true);

DO $$
BEGIN
  IF to_regclass('public.access_roles') IS NULL
     OR to_regclass('public.access_permissions') IS NULL
     OR to_regclass('public.access_role_permissions') IS NULL THEN
    RAISE EXCEPTION 'SOCIAL_MEDIA_RBAC_SCHEMA_MISSING';
  END IF;
END;
$$;

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

DELETE FROM public.access_role_permissions
WHERE role_key = 'social_media_team'
  AND permission_key = 'social_media.accounts.manage';

NOTIFY pgrst, 'reload schema';
COMMIT;
