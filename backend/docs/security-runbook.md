# Security runbook

## Required production configuration

Set these values through the deployment secret manager, never in source:

- `NODE_ENV=production`
- `JWT_SECRET` with at least 32 random characters
- `CORS_ORIGINS` as a comma-separated allow-list of exact HTTPS origins
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- `STUDENT_DEFAULT_PASSWORD` set to a rotated, non-default value for account
  provisioning; the built-in local value is rejected in production
- `TRUST_PROXY=true` only when the reverse proxy is controlled and configured

`ALLOW_DEV_AUTH` is ignored in production. If Supabase is unavailable, login
returns `503`; mock credentials are never silently enabled.

## Migration gate

1. Take a database backup or confirm point-in-time recovery.
2. Apply migrations in order, including `025_security_privileges_hardening.sql`,
   `026_attendance_summary_aggregate.sql`, `027_resilience_stores.sql`,
   `028_contest_query_hardening.sql`, `029_contest_frontend_contract.sql`,
   `030_equipment_query_hardening.sql`, `031_notifications_query_hardening.sql`,
   `032_users_query_hardening.sql`, `033_classes_query_hardening.sql`, and
   `034_students_query_hardening.sql`, followed by `035_access_control_rbac.sql`,
   `036_access_control_actor_snapshots.sql`,
   `037_sensitive_mutation_audit.sql`,
   `038_supabase_security_linter_hardening.sql`, and
   `039_supabase_security_advisor_hardening.sql`.
3. Verify `classes` remains readable for the intended options endpoint.
4. Verify `classes` INSERT/UPDATE/DELETE fails for `authenticated` and works
   only through the service role.
5. Verify protected RPCs have no EXECUTE grant for `PUBLIC`, `anon`, or
   `authenticated`.
6. Refresh Supabase Advisor and confirm no `security_definer_view`,
   `rls_disabled_in_public`, `rls_policy_always_true`,
   `function_search_path_mutable`, `anon_security_definer_function_executable`,
   or `authenticated_security_definer_function_executable` findings remain for
   the relations and routines listed in migrations 038–039.

Example read-only checks:

```sql
SELECT routine_schema, routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN ('record_cash_in_atomic', 'write_audit_log');

SELECT policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'classes';
```

## API security checks

- Protected routes must include `authenticate` before capability or ownership
  guards.
- New mutation routes must use `X-Idempotency-Key` where retrying the request
  could duplicate a financial, attendance, borrowing, or contest operation.
- Do not log passwords, access tokens, service-role keys, or full personal
  records. Request IDs may be logged for correlation.
- Use Fastify's trusted `request.ip`; do not parse `X-Forwarded-For` in route
  code.
- Add a JSON schema to every new route. Reject unknown fields on sensitive
  write endpoints.
- The contest compatibility schema accepts exactly one of the legacy or
  frontend submission shapes; rich submission URLs are restricted to `http`/
  `https` before persistence and duplicate titles are database-protected.
- Equipment list/create/update/condition routes use JSON schemas with unknown
  fields rejected, an `equipment_team` role guard on mutations, allowlisted
  catalog enums, bounded page/pageSize values, sanitized search terms, and
  strict `http(s)` or base64 image validation capped at 600 KB per photo. The
  server never fetches user-supplied photo URLs, so this surface does not add
  an SSRF request path. The repository uses explicit selects and audit callbacks
  for mutations; delete conflicts from active borrowings are returned as 409.
- In a multi-worker deployment, verify the Supabase-backed idempotency and
  login-rate-limit functions are reachable by `service_role`; before migration
  `027`, the fallback is process-local and is not a cluster-wide guarantee.
- Include `X-Request-Id` in incident reports. Request telemetry records only
  method, route, status, and bounded latency; it must not contain credentials
  or request payloads.
- Audit reads are teacher-only, capped at 100 rows per page, use explicit
  columns, and sanitize search values before PostgREST `or` predicates. Audit
  responses are private/no-store and actor enrichment must remain one bounded
  lookup per page.
- The manual `/api/admin/overdue-check` trigger is leader-only and shares the
  scheduled worker service. Repository reads use explicit columns and bounded
  500-row batches; notification writes use idempotent event keys. Its
  diagnostic response is capped to ten log entries and the process buffer to
  100. Production-scale query plans still require a staged batch/RPC review.
- Weekly billing has no public trigger route. Its scheduler calls an injected
  service, and only the billing repository can invoke the
  `generate_weekly_cash_billing` RPC. Keep the financial transaction,
  locking, and idempotency rules in that database function; log only the
  aggregate result and run date, never student records or credentials.

## Authorized security testing only

SQL injection scanners and SQLMap are not run against this project without a
written scope covering a staging environment, test accounts, rate limits, and
an approved test window. Until that authorization exists, use code review,
parameterized Supabase queries, migration privilege checks, and non-destructive
staging tests only.
