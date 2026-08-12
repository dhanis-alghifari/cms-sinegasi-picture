# Password reset rollout

## Before applying migration 040

1. Use a staging Supabase project and a dedicated non-critical target account.
2. Confirm the target account is not the teacher account currently used for
   deployment, and keep a second teacher session available.
3. Apply `040_admin_password_reset_atomic.sql` after migrations 001–039.

## Verification SQL

```sql
SELECT to_regprocedure(
  'public.reset_user_password_atomic(uuid,text,uuid,text,text,uuid,uuid)'
) AS reset_function;

SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'password_reset_operations';

SELECT has_function_privilege(
  'anon',
  'public.reset_user_password_atomic(uuid,text,uuid,text,text,uuid,uuid)',
  'EXECUTE'
) AS anon_can_execute,
has_function_privilege(
  'service_role',
  'public.reset_user_password_atomic(uuid,text,uuid,text,text,uuid,uuid)',
  'EXECUTE'
) AS service_role_can_execute;
```

Expected: the function exists, RLS is enabled, `anon_can_execute` is false,
and `service_role_can_execute` is true.

## HTTP smoke test

```bash
curl -i -X POST "http://localhost:5001/api/users/<target-id>/reset-password" \
  -H "Authorization: Bearer <teacher-token>" \
  -H "Content-Type: application/json" \
  -H "X-Change-Reason: Siswa lupa password" \
  -H "X-Idempotency-Key: reset-smoke-20260812-01" \
  -d '{}'
```

Check that the response contains `temporary_password` once, never contains
`password_hash`, and that retrying with the same key returns `409` with
`error_code=RESET_OPERATION_REPLAY`.

The database audit query should show one `users` update for the operation and
no password/hash key in its new audit payload. The old JWT for the target must
be rejected because `auth_version` was incremented; the target must be forced
through first-login password change.
