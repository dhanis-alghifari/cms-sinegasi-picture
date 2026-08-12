# Database migration runbook

Migrations are forward-only and must be applied in numeric order. The latest
migration file is `041_user_account_update_atomic.sql`; after it is applied,
the schema ends at migration 041.

## RBAC and audit rollout

Run these statements in Supabase SQL editor or through the project migration
runner, after `001`–`034` have completed:

1. `035_access_control_rbac.sql` — role/capability policy tables and the
   teacher-managed replacement function.
2. `036_access_control_actor_snapshots.sql` — immutable name/username/role
   snapshots for access-policy audit rows.
3. `037_sensitive_mutation_audit.sql` — canonical audit events for bulk grades
   and password changes. Password hashes are never written to audit payloads.
4. `038_supabase_security_linter_hardening.sql` — marks dashboard/contest views
   as `security_invoker`, enables deny-by-default RLS on cash control tables,
   and restricts their direct PostgREST grants to `service_role`.
5. `039_supabase_security_advisor_hardening.sql` — removes the broad
   authenticated class-management policy, pins the five reported function
   search paths, and revokes direct `anon`/`authenticated` execution from the
   reported `SECURITY DEFINER` routines while preserving `service_role` RPCs.
6. `040_admin_password_reset_atomic.sql` — teacher-only atomic password reset,
   idempotency ledger, auth-version rotation, and redacted audit event.
7. `041_user_account_update_atomic.sql` — atomic user profile/username/role/status
   updates, capability enforcement, linked-student invariants, and one canonical
   audit event. This replaces the direct `UPDATE users` path that could fail in
   the audit trigger when transaction context was missing.

Apply each file as one transaction and stop if it fails. Do not run a later
file against a partially applied predecessor. The backend uses the Supabase
service role for these tables; `anon` and `authenticated` remain denied by
RLS and explicit grants.

## Verification queries

```sql
SELECT role_key, count(*) AS capability_count
FROM public.access_role_permissions
GROUP BY role_key
ORDER BY role_key;

SELECT relname, relrowsecurity
FROM pg_class
WHERE relname IN (
  'access_roles', 'access_permissions',
  'access_role_permissions', 'access_control_audit_logs'
)
ORDER BY relname;

SELECT to_regprocedure('public.replace_access_role_capabilities(text,text[],uuid,text)') AS rbac_function,
       to_regprocedure('public.record_grades_bulk_atomic(uuid,jsonb,uuid,text)') AS grades_function,
       to_regprocedure('public.change_password_atomic(uuid,text,uuid,text,integer)') AS password_function,
       to_regprocedure('public.reset_user_password_atomic(uuid,text,uuid,text,text,uuid,uuid)') AS reset_password_function,
       to_regprocedure('public.update_user_account_atomic(uuid,jsonb,uuid,text,uuid,uuid)') AS update_user_function,
       to_regprocedure('public.write_audit_log(uuid,text,text,uuid,jsonb,jsonb,text,uuid,uuid,text,text,jsonb)') AS audit_function;

SELECT action, table_name, record_id,
       actor_name_snapshot, actor_username_snapshot, actor_role_snapshot,
       metadata, created_at
FROM public.activity_logs
WHERE table_name IN ('grades', 'users')
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

The last query should show `UPSERT` rows for bulk grading and `UPDATE` rows for
credential rotation after those flows are exercised once in staging.

## Supabase security-advisor verification

After applying migrations 038 and 039, run the following in the Supabase SQL
editor:

```sql
SELECT c.relname, c.relkind, c.reloptions,
       c.relrowsecurity, c.relforcerowsecurity
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'v_student_dashboard_summary', 'v_contest_win_rate',
    'cash_settings', 'cash_billing_runs'
  )
ORDER BY c.relname;

SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'v_student_dashboard_summary', 'v_contest_win_rate',
    'cash_settings', 'cash_billing_runs'
  )
ORDER BY table_name, grantee, privilege_type;
```

Expected results:

- Both views include `security_invoker=true` in `reloptions`.
- Both cash tables have `relrowsecurity = true`.
- `anon` and `authenticated` have no table privileges for the four relations.
- `service_role` can read both views and read/update `cash_settings`; it can
  read `cash_billing_runs`.

The backend must continue using `SUPABASE_SERVICE_ROLE_KEY`. Do not add an
anon/authenticated policy for these relations unless the product explicitly
introduces a browser-to-Supabase data path; such a policy would change the
deny-by-default contract.

Migration 039 verification should show no authenticated `ALL` policy on
`classes`, `anon_execute = false` and `authenticated_execute = false` for the
listed `SECURITY DEFINER` routines, and `service_role_execute = true`. The
reported five functions should also show `search_path=public, pg_temp` in
`pg_proc.proconfig`.

```sql
SELECT policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'classes'
ORDER BY policyname;

SELECT p.oid::regprocedure AS function_signature,
       p.prosecdef AS security_definer,
       p.proconfig AS function_config,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'approve_borrowing_atomic', 'audit_cash_row_change',
    'create_borrowing_atomic', 'enforce_cash_transaction_ledger',
    'enrich_activity_log', 'enrich_debt_record_state',
    'generate_weekly_cash_billing', 'get_cash_report',
    'get_cash_summary', 'handover_borrowing_atomic', 'log_activity',
    'notify_borrowing_recipients', 'notify_borrowing_status_change',
    'prevent_cash_transaction_mutation', 'record_cash_in_atomic',
    'record_cash_in_on_date_atomic', 'record_cash_out_atomic',
    'return_borrowing_atomic', 'snapshot_access_control_audit_actor',
    'validate_cash_transaction_final', 'write_audit_log'
  )
ORDER BY function_signature;

SELECT p.oid::regprocedure AS function_signature, p.proconfig
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'protect_activity_logs', 'validate_cash_transaction',
    'redact_audit_json', 'audit_changed_fields',
    'sync_contest_frontend_contract'
  )
ORDER BY function_signature;
```
