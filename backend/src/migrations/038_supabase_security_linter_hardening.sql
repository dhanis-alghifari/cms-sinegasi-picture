-- 038_supabase_security_linter_hardening.sql
-- Clear Supabase security advisor findings without broadening client access.
-- Apply after migrations 001-037.
--
-- The Fastify API uses the Supabase service role. Direct anon/authenticated
-- access to these internal relations is intentionally denied by both grants
-- and RLS. No client policy is created: no policy is the deny-by-default
-- posture for these server-owned stores.

BEGIN;

-- PostgreSQL views normally execute with the view owner's table privileges.
-- Invoker security makes the caller's RLS and table privileges apply instead,
-- eliminating privilege escalation through a public view. The API continues
-- to work because its service-role client bypasses RLS and is explicitly
-- granted the view read permission below.
ALTER VIEW public.v_student_dashboard_summary
  SET (security_invoker = true);

ALTER VIEW public.v_contest_win_rate
  SET (security_invoker = true);

-- These are internal cash-control relations. Enable RLS and remove the
-- default PostgREST-facing grants so anon/authenticated cannot read or mutate
-- settings and billing-run history directly. The service role remains the
-- only API data path.
ALTER TABLE public.cash_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_billing_runs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.cash_settings, public.cash_billing_runs
  FROM PUBLIC, anon, authenticated;

GRANT SELECT, UPDATE ON TABLE public.cash_settings TO service_role;
GRANT SELECT ON TABLE public.cash_billing_runs TO service_role;

-- Views are also kept off the direct client surface. Backend reads use the
-- service-role client and therefore remain available after this migration.
REVOKE ALL ON TABLE public.v_student_dashboard_summary,
  public.v_contest_win_rate
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.v_student_dashboard_summary,
  public.v_contest_win_rate
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;

-- Verification:
-- SELECT c.relname, c.relkind, c.reloptions,
--        c.relrowsecurity, c.relforcerowsecurity
-- FROM pg_class AS c
-- JOIN pg_namespace AS n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public'
--   AND c.relname IN (
--     'v_student_dashboard_summary', 'v_contest_win_rate',
--     'cash_settings', 'cash_billing_runs'
--   )
-- ORDER BY c.relname;
--
-- SELECT table_name, grantee, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public'
--   AND table_name IN (
--     'v_student_dashboard_summary', 'v_contest_win_rate',
--     'cash_settings', 'cash_billing_runs'
--   )
-- ORDER BY table_name, grantee, privilege_type;
