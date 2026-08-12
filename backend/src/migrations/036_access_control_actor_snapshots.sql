-- 036_access_control_actor_snapshots.sql
-- Immutable actor identity snapshots for RBAC policy changes.
-- Apply after 035_access_control_rbac.sql.

BEGIN;

ALTER TABLE public.access_control_audit_logs
  ADD COLUMN IF NOT EXISTS actor_name_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS actor_username_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS actor_role_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS request_id TEXT,
  ADD COLUMN IF NOT EXISTS operation_id TEXT;

CREATE INDEX IF NOT EXISTS idx_access_control_audit_logs_actor_created
  ON public.access_control_audit_logs (actor_user_id, created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION public.snapshot_access_control_audit_actor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_name TEXT;
  v_actor_username TEXT;
  v_actor_role TEXT;
BEGIN
  IF NEW.actor_user_id IS NOT NULL THEN
    SELECT u.nama, u.username, u.role::TEXT
      INTO v_actor_name, v_actor_username, v_actor_role
    FROM public.users AS u
    WHERE u.id = NEW.actor_user_id;
    NEW.actor_name_snapshot := COALESCE(NULLIF(NEW.actor_name_snapshot, ''), v_actor_name);
    NEW.actor_username_snapshot := COALESCE(NULLIF(NEW.actor_username_snapshot, ''), v_actor_username);
    NEW.actor_role_snapshot := COALESCE(NULLIF(NEW.actor_role_snapshot, ''), v_actor_role);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_access_control_audit_actor_snapshot
  ON public.access_control_audit_logs;
CREATE TRIGGER trg_access_control_audit_actor_snapshot
  BEFORE INSERT ON public.access_control_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.snapshot_access_control_audit_actor();

-- Backfill only missing snapshots. Existing audit records are never deleted or
-- rewritten when the user later changes name, username, or role.
UPDATE public.access_control_audit_logs AS log
SET actor_name_snapshot = COALESCE(log.actor_name_snapshot, u.nama),
    actor_username_snapshot = COALESCE(log.actor_username_snapshot, u.username),
    actor_role_snapshot = COALESCE(log.actor_role_snapshot, u.role::TEXT)
FROM public.users AS u
WHERE log.actor_user_id = u.id
  AND (log.actor_name_snapshot IS NULL
    OR log.actor_username_snapshot IS NULL
    OR log.actor_role_snapshot IS NULL);

COMMENT ON COLUMN public.access_control_audit_logs.actor_name_snapshot IS
  'Actor display name captured at policy-change time.';
COMMENT ON COLUMN public.access_control_audit_logs.actor_username_snapshot IS
  'Actor username captured at policy-change time.';
COMMENT ON COLUMN public.access_control_audit_logs.actor_role_snapshot IS
  'Actor role captured at policy-change time.';

NOTIFY pgrst, 'reload schema';
COMMIT;

-- Verification:
-- SELECT role_key, actor_user_id, actor_name_snapshot,
--        actor_username_snapshot, actor_role_snapshot, created_at
-- FROM public.access_control_audit_logs
-- ORDER BY created_at DESC, id DESC;
