# Feature map

Use this table when you know the business area but not the filename yet.
Every feature follows `route → service → repository`; tests sit next to the
layer they verify.

Each module now has a short `README.md` with its reading order and security
invariants. Small modules intentionally keep a flat feature folder; cash and
other multi-capability features may add subfolders when a separate reason to
change is visible.

| Feature | HTTP entry | Business logic | Data adapter | Main concern |
| --- | --- | --- | --- | --- |
| Health | `health/health.routes.ts` | none | none | liveness |
| Auth | `auth/auth.routes.ts` | `auth.service.ts` | `auth.repository.ts` | JWT, password, session identity |
| Attendance | `attendance/attendance.routes.ts` | `attendance.service.ts` | `attendance.repository.ts` | date/status validation and corrections |
| Audit | `audit/audit.routes.ts` | `audit.service.ts` | `audit.repository.ts` | immutable activity history |
| Students | `students/students.routes.ts` | `students.service.ts` | `students.repository.ts` | profile and account lifecycle |
| Classes | `classes/classes.routes.ts` | `classes.service.ts` | `classes.repository.ts` | master data and soft deactivation |
| Users | `users/users.routes.ts` | `users.service.ts` | `users.repository.ts` | role, password, linked student rules |
| Dashboard | `dashboard/dashboard.routes.ts` | `dashboard.service.ts` | `dashboard.repository.ts` | bounded cross-domain summary adapter |
| Cash | `cash/cash.module.ts` | `cash/{ledger,reports,...}` | same subdomains | financial invariants and idempotency |
| Borrowing | `borrowing/*.routes.ts` | `borrowing.*.service.ts` | `borrowing.*.repository.ts` | state transitions and ownership |
| Equipment | `equipment/equipment.routes.ts` | `equipment.service.ts` | `equipment.repository.ts` | catalog and photo validation |
| Notifications | `notifications/notifications.routes.ts` | `notifications.service.ts` | `notifications.repository.ts` | user-scoped reads and read state |
| Grades | `grades/grades.routes.ts` | `grades.service.ts` | `grades.repository.ts` | assignment and bulk grade writes |
| Contests | `contests/contests.routes.ts` | `contests.service.ts` | `contests.repository.ts` | submissions and unique constraints |
| Film works | `film-works/film-works.routes.ts` | `film-works.service.ts` | `film-works.repository.ts` | read-only catalog |
| Overdue | `overdue/overdue.routes.ts` | `overdue.service.ts` | `overdue.repository.ts` | bounded scan and notifications |
| Billing worker | no HTTP route | `billing.service.ts` | `billing.repository.ts` | weekly atomic billing RPC |

## Reading rule

Open the HTTP entry first. Follow its service import, then the repository
constructor received by that service. Do not start at `server.ts` unless you are
debugging startup, plugin order, or worker lifecycle.
