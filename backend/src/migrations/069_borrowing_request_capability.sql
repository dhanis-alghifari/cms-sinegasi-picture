-- 069_borrowing_request_capability.sql
-- Separate submitting a borrowing request from staff-only workflow management.
-- Apply after 068_borrowing_self_return_verification.sql.

BEGIN;

SELECT set_config('app.system_operation', 'true', true);
SELECT set_config('app.change_reason', 'SYSTEM:MIGRATION_069_BORROWING_REQUEST_CAPABILITY', true);

DO $$
BEGIN
  IF to_regclass('public.borrowing_migration_history') IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM public.borrowing_migration_history
       WHERE migration_name = '068_borrowing_self_return_verification.sql'
     ) THEN
    RAISE EXCEPTION 'BORROWING_MIGRATION_ORDER_INVALID: jalankan migration 068 terlebih dahulu';
  END IF;
  IF to_regclass('public.access_permissions') IS NULL
     OR to_regclass('public.access_roles') IS NULL
     OR to_regclass('public.access_role_permissions') IS NULL THEN
    RAISE EXCEPTION 'ACCESS_CONTROL_SCHEMA_MISSING: jalankan migration access-control terlebih dahulu';
  END IF;
END;
$$;

INSERT INTO public.access_permissions (permission_key, label)
VALUES ('borrowing.request', 'Ajukan peminjaman alat')
ON CONFLICT (permission_key) DO UPDATE SET label = EXCLUDED.label;

-- Teachers can submit for any active student. Committee roles can submit only
-- for the active student linked to their own account; the API enforces that
-- ownership invariant before calling the database mutation.
INSERT INTO public.access_role_permissions (role_key, permission_key)
SELECT role_key, 'borrowing.request'
FROM public.access_roles
WHERE role_key IN ('teacher', 'leader', 'vice_leader', 'secretary', 'treasurer', 'equipment_team')
ON CONFLICT DO NOTHING;

-- Keep read/report access aligned with the borrowing role contract. Existing
-- rows are preserved; this only fills the permissions missing from older RBAC
-- migrations.
INSERT INTO public.access_role_permissions (role_key, permission_key)
SELECT roles.role_key, permissions.permission_key
FROM public.access_roles AS roles
CROSS JOIN (VALUES ('borrowing.read'), ('borrowing.return.report')) AS permissions(permission_key)
WHERE roles.role_key IN (
  'teacher', 'leader', 'vice_leader', 'secretary', 'treasurer',
  'equipment_team', 'contest_team', 'member'
)
ON CONFLICT DO NOTHING;

-- Approval, handover, teacher-side return processing, and legacy evidence
-- endpoints remain staff workflow operations. No student role receives them.
DELETE FROM public.access_role_permissions
WHERE role_key IN (
  'leader', 'vice_leader', 'secretary', 'treasurer',
  'equipment_team', 'contest_team', 'member'
)
  AND permission_key = 'borrowing.manage';

INSERT INTO public.borrowing_migration_history (migration_name)
VALUES ('069_borrowing_request_capability.sql')
ON CONFLICT (migration_name) DO NOTHING;

NOTIFY pgrst, 'reload schema';
COMMIT;
