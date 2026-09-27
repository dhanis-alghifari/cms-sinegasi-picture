-- Allows treasurers to view all dispute outcomes without granting review rights.

BEGIN;

SELECT set_config('app.system_operation', 'true', true);
SELECT set_config('app.change_reason', 'SYSTEM:MIGRATION_079_CASH_DISPUTE_READ_ALL', true);

DO $$
BEGIN
  IF to_regclass('public.access_permissions') IS NULL
     OR to_regclass('public.access_roles') IS NULL
     OR to_regclass('public.access_role_permissions') IS NULL
     OR to_regclass('public.cash_disputes') IS NULL THEN
    RAISE EXCEPTION 'CASH_DISPUTE_READ_ALL_SCHEMA_MISSING';
  END IF;
END;
$$;

INSERT INTO public.access_permissions (permission_key, label)
VALUES ('cash.dispute.read.all', 'Cash Dispute Read All')
ON CONFLICT (permission_key) DO UPDATE SET label = EXCLUDED.label;

INSERT INTO public.access_role_permissions (role_key, permission_key)
VALUES ('treasurer', 'cash.dispute.read.all')
ON CONFLICT DO NOTHING;

-- The review decision remains teacher-only, even if an old role grant exists.
DELETE FROM public.access_role_permissions
WHERE role_key = 'treasurer' AND permission_key = 'cash.dispute.review';

NOTIFY pgrst, 'reload schema';
COMMIT;
