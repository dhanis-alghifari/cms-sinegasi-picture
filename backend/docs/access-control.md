# Access control and role matrix

This project uses capabilities as the authorization contract. A role is only
the starting policy; route handlers check capabilities and ownership at the
backend boundary. Frontend navigation is a convenience and is never a
security boundary.

## Approved baseline policy

| Role | Allowed modules |
| --- | --- |
| teacher | All modules, dashboards, audit, users, and access settings |
| leader | Students, classes, attendance, equipment, borrowing, contests, own dashboard, own grades |
| vice_leader | Attendance, borrowing, contests, own dashboard, own grades |
| treasurer | Cash, own dashboard, own grades |
| secretary | Students, classes, attendance, own dashboard, own grades |
| equipment_team | Equipment, borrowing, own dashboard, own grades |
| contest_team | Contests, own dashboard, own grades |
| member | Own dashboard and own grades |

The canonical capability lists are kept in
`backend/src/middleware/capabilities.ts` and seeded in
`backend/src/migrations/035_access_control_rbac.sql`.

`overdue.manage` is an internal teacher-only capability for the manual overdue
notification trigger; it is not exposed as a normal navigation module.

## Rollout

1. Apply migrations `001` through `034` in order.
2. Apply `035_access_control_rbac.sql` once on the target Supabase database.
3. Verify all four access-control tables, RLS flags, the RPC, and the seed
   rows before restarting the backend.
4. Log in again so the returned user payload contains `capabilities`.
5. Open the teacher-only **Pengaturan Akses** page and test one capability
   change with a meaningful reason.

The migration revokes table access from `anon` and `authenticated`; only the
backend service role can read/write the policy tables. The RPC is
`SECURITY DEFINER`, pins `search_path`, validates teacher lockout protection,
and records each update in `access_control_audit_logs`.

## API examples

```bash
curl "$API_URL/api/access-control/matrix" \
  -H "Authorization: Bearer $TEACHER_TOKEN"

curl -X PUT "$API_URL/api/access-control/roles/contest_team/capabilities" \
  -H "Authorization: Bearer $TEACHER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"capabilities":["dashboard.read.own","contests.read","contests.submit","contests.manage","grades.read.own","notifications.read"],"change_reason":"Menetapkan akses tim lomba"}'
```

Never expose the Supabase service-role key to the browser. A `403` from the
API must be treated as authoritative even if a stale frontend session still
shows a previously visible menu.
