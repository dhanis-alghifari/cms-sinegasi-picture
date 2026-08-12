-- 039_supabase_security_advisor_hardening.sql
-- Resolve the remaining Supabase security-advisor warnings reported after
-- migrations 001-038. The API uses the service-role client exclusively; no
-- browser client needs direct access to SECURITY DEFINER RPCs.
--
-- This migration is forward-only and idempotent. It does not change business
-- logic or remove any backend capability. It only tightens direct PostgREST
-- access and pins function search paths.

BEGIN;

-- The old authenticated ALL policy bypassed RBAC. Keep the read policies for
-- dropdowns, but deny writes to client roles. service_role bypasses RLS and
-- remains the backend write path.
DROP POLICY IF EXISTS "Allow manage classes for authenticated users"
  ON public.classes;

-- Pin search_path on the five functions reported by the advisor. The lookup
-- is restricted to these exact legacy function names so older deployments are
-- repaired without touching unrelated routines.
DO $do$
DECLARE
  function_record RECORD;
BEGIN
  FOR function_record IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'protect_activity_logs',
        'validate_cash_transaction',
        'redact_audit_json',
        'audit_changed_fields',
        'sync_contest_frontend_contract'
      )
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %s SET search_path = public, pg_temp',
      function_record.signature
    );
  END LOOP;
END;
$do$;

-- These are the exact SECURITY DEFINER routines reported by Advisor. Remove
-- the default PUBLIC EXECUTE grant (which includes anon/authenticated) and
-- preserve the Fastify service-role path. Trigger routines are included so
-- they cannot be called as arbitrary /rest/v1/rpc endpoints.
REVOKE EXECUTE ON FUNCTION public.approve_borrowing_atomic(UUID, TEXT, TEXT, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_borrowing_atomic(UUID, TEXT, TEXT, UUID, TEXT)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.audit_cash_row_change()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_cash_row_change()
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.create_borrowing_atomic(UUID, UUID[], DATE, DATE, TEXT, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_borrowing_atomic(UUID, UUID[], DATE, DATE, TEXT, UUID, TEXT)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.enforce_cash_transaction_ledger()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_cash_transaction_ledger()
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.enrich_activity_log()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enrich_activity_log()
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.enrich_debt_record_state()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enrich_debt_record_state()
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.generate_weekly_cash_billing(DATE)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_weekly_cash_billing(DATE)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_cash_report(DATE, DATE)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_cash_report(DATE, DATE)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_cash_summary(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_cash_summary(UUID)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.handover_borrowing_atomic(UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handover_borrowing_atomic(UUID, UUID, TEXT)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.log_activity()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_activity()
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.notify_borrowing_recipients(
  UUID, TEXT, public.notification_type, TEXT, TEXT, UUID[], JSONB
)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_borrowing_recipients(
  UUID, TEXT, public.notification_type, TEXT, TEXT, UUID[], JSONB
)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.notify_borrowing_status_change()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_borrowing_status_change()
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.prevent_cash_transaction_mutation()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_cash_transaction_mutation()
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.record_cash_in_atomic(
  TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC
)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_cash_in_atomic(
  TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC
)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.record_cash_in_on_date_atomic(
  TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, DATE
)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_cash_in_on_date_atomic(
  TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, DATE
)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.record_cash_out_atomic(
  NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT
)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_cash_out_atomic(
  NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT
)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.return_borrowing_atomic(
  UUID, DATE, JSONB, TEXT, UUID, TEXT
)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.return_borrowing_atomic(
  UUID, DATE, JSONB, TEXT, UUID, TEXT
)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.snapshot_access_control_audit_actor()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.snapshot_access_control_audit_actor()
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.validate_cash_transaction_final()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_cash_transaction_final()
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.write_audit_log(
  UUID, TEXT, TEXT, UUID, JSONB, JSONB, TEXT, UUID, UUID, TEXT, TEXT, JSONB
)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.write_audit_log(
  UUID, TEXT, TEXT, UUID, JSONB, JSONB, TEXT, UUID, UUID, TEXT, TEXT, JSONB
)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;

-- Verification:
-- SELECT policyname, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'classes'
-- ORDER BY policyname;
--
-- SELECT p.oid::regprocedure AS function_signature,
--        p.prosecdef AS security_definer,
--        p.proconfig AS function_config,
--        has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
--        has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
--        has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute
-- FROM pg_proc AS p
-- JOIN pg_namespace AS n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public'
--   AND p.proname IN (
--     'approve_borrowing_atomic', 'audit_cash_row_change',
--     'create_borrowing_atomic', 'enforce_cash_transaction_ledger',
--     'enrich_activity_log', 'enrich_debt_record_state',
--     'generate_weekly_cash_billing', 'get_cash_report',
--     'get_cash_summary', 'handover_borrowing_atomic', 'log_activity',
--     'notify_borrowing_recipients', 'notify_borrowing_status_change',
--     'prevent_cash_transaction_mutation', 'record_cash_in_atomic',
--     'record_cash_in_on_date_atomic', 'record_cash_out_atomic',
--     'return_borrowing_atomic', 'snapshot_access_control_audit_actor',
--     'validate_cash_transaction_final', 'write_audit_log'
--   )
-- ORDER BY function_signature;
