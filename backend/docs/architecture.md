# Backend architecture and extraction plan

The backend is a Fastify modular monolith. `src/app/createApplication.ts` is
the composition root; `src/server.ts` is only the process entrypoint. New work
must be split by vertical feature.
Feature modules are extracted as vertical slices. The students vertical now owns options, bounded
management CRUD, account provisioning, and the alumni lifecycle; its memory
adapter is injected into cash modules so local development has one student
source of truth. The cash read slice is now extracted as well:
`modules/cash/ledger/cash.read.routes.ts` owns the two read endpoints,
`ledger/cash.read.service.ts` owns validation and response mapping, and
`ledger/cash.read.repository.ts` owns Supabase/memory queries. Payment-method master
data is also extracted into `payment-methods/cash.payment-methods.routes.ts`,
`payment-methods/cash.payment-methods.service.ts`, and `payment-methods/cash.payment-methods.repository.ts`;
its writes keep the existing change-reason audit requirement. Ledger mutations
are now isolated in `ledger/cash.mutations.routes.ts`, `ledger/cash.mutations.service.ts`,
and `ledger/cash.mutations.repository.ts`; the repository retains the atomic RPC
boundary and the memory adapter is covered by idempotency and balance tests.
Cash reporting is now isolated in `reports/cash.reporting.routes.ts`,
`reports/cash.reporting.service.ts`, and `reports/cash.reporting.repository.ts`; the report
uses the aggregate RPC in production, while debt listing applies member scope,
bounded pagination, and explicit selects. Billing-rule reads and writes share
that reporting boundary. Cash disputes are isolated in
`disputes/cash.disputes.routes.ts`, `disputes/cash.disputes.service.ts`, and
`disputes/cash.disputes.repository.ts`; ownership, duplicate protection, and manager
resolution are enforced before persistence.
Cash's local fallback state is created by `shared/cash.memory.ts` and injected into
the read, mutation, reporting, payment-method, and dispute repositories as one
shared object; the composition root no longer owns cash DTO definitions or
fixture records.
Borrowing workflow mutations are now isolated in
`borrowing.mutations.routes.ts`, `borrowing.mutations.service.ts`, and
`borrowing.mutations.repository.ts`. Create, approve/reject, handover, and
return preserve the existing atomic RPC contracts, idempotency header, member
ownership rule, role guards, and change-reason requirements. The repository
also provides a small in-memory adapter for local development and tests.
The contests vertical slice is now isolated in `modules/contests`: routes keep
authentication, leader/capability guards, schemas, and audit callbacks;
`contests.service.ts` validates use cases; and `contests.repository.ts` owns
bounded Supabase queries, count-only summary aggregates, the win-rate view, and
the contest-film unique constraint boundary. The memory adapter is limited to
local development and tests.
The read-only `film-works` catalog follows the same boundary and joins crew
names in the repository, so the composition root no longer owns film fixture
data or response mapping.
The equipment catalog now follows the same deep-module seam in
`modules/equipment`: the route plugin preserves the legacy raw response
envelopes and `equipment_team` guard, the service validates enum fields,
bounded pagination, and photo data URLs, and the repository owns explicit
catalog selects, count-only summaries, reservation lookups, and the memory
adapter. `src/app/app.dependencies.ts` injects that adapter into borrowing mutations so local
state is shared rather than duplicated; the dashboard summary has its own
bounded fixture adapter until a cross-domain read model is approved.
The notifications center is now isolated in `modules/notifications`: routes
preserve the existing list/unread/read/read-all envelopes and both POST/PATCH
read-all methods, the service owns identity and error mapping, and the
repository owns user-scoped explicit selects, count-only unread queries,
deterministic ordering, and the local fallback adapter. Migration
`031_notifications_query_hardening.sql` adds the user/sort and partial unread
indexes without changing the notification contract.
The contest adapter also accepts the frontend presentation contract. Migration
`029_contest_frontend_contract.sql` stores organizer-facing metadata and rich
film submissions additively; legacy `contests` and `contest_films` clients stay
supported during the transition.

```text
src/
  app/                    # composition root: dependencies, hooks, route registry, lifecycle
  config/                 # environment parsing and process configuration
  middleware/             # cross-cutting auth, audit, idempotency, capability guards
  shared/http/            # reusable HTTP schemas and error contracts
  modules/<feature>/
    <feature>.routes.ts   # URL registration only
    <feature>.service.ts  # use-case orchestration and authorization decisions
    <feature>.repository.ts # Supabase/Postgres queries and transactions
    <feature>.types.ts    # feature-owned domain and DTO types
  workers/                # scheduled jobs with explicit lifecycle handles
  migrations/             # append-only SQL migrations
```

The high-volume cash capability uses the deeper feature layout below. Other
capabilities remain flat until they have multiple independent subdomains; this
keeps a small feature discoverable instead of creating folders for every file.

```text
modules/cash/
  cash.module.ts           # public facade used by app/routes and dependencies
  ledger/                  # transaction reads and mutations
  reports/                 # reports, debts, billing rules
  payment-methods/         # payment-method master data
  disputes/                # dispute lifecycle
  shared/                  # cash-only types, helpers, memory, HTTP schema
```

The composition root is grouped by responsibility as well:

```text
app/
  dependencies/
    core.dependencies.ts       # auth, audit, billing, overdue, idempotency
    catalog.dependencies.ts    # students, users, classes, grades, catalog
    borrowing.dependencies.ts  # borrowing workflows and shared equipment state
    cash.dependencies.ts       # cash module seam
  routes/
    core.routes.ts              # health, auth, audit, attendance, billing, overdue
    catalog.routes.ts           # catalog and user-facing read features
    borrowing.routes.ts         # borrowing read/mutation plugins
```

Feature request/response schemas live in `src/shared/http/schemas` so route
plugins and the OpenAPI contract share one validation vocabulary without
coupling schemas to database adapters.

## Dependency rule

Routes may depend on middleware, schemas, and a feature service. Services may
depend on repositories and pure domain helpers. Repositories own database
queries. A repository must not import Fastify request/reply objects, and a
route must not contain SQL, password hashing, or authorization policy logic.

## Safe extraction order

1. Keep the existing route behavior and add a feature schema first.
2. Move one handler at a time into a service with the same input/output shape.
3. Move the Supabase query into a repository and add a focused service test.
4. Register the feature route plugin from `src/app/app.routes.ts`.
5. Verify the frontend contract before changing response envelopes.
6. Remove the old closure only after the new route is exercised in staging.

All currently registered HTTP features now have a dedicated route/service/
repository seam. Grades reads, assignment creation, bulk grading, and
secretary reports are now isolated in `modules/grades`; the repository keeps
the `record_grades_bulk_atomic` RPC boundary while the service validates
bounded payloads and the route layer owns RBAC and audit callbacks.
Borrowing read operations (`borrowing.read.*`) and workflow mutations
(`borrowing.mutations.*`) are now extracted with explicit select columns,
member scope, bounded pagination, and atomic state transitions. Extract the
remaining slices one vertical slice at a time, after adding
characterization tests for their existing RPC contracts. The cash modules are
the reference seam for that work: routes -> service -> repository, with the
memory adapter retained only as a local-development fallback.

The users management vertical is now isolated in `modules/users`: routes keep
the teacher-only RBAC boundary, legacy response envelopes, and audit callback;
`users.service.ts` owns password policy, linked-student lifecycle invariants,
and generic database-error mapping; `users.repository.ts` owns explicit user
selects, bounded filters, password-hash writes, auth-version rotation, and the
in-memory adapter. Password hashes are never returned in DTOs or audit values,
and reset/create responses expose a temporary password only in the immediate
HTTP response. Migration `032_users_query_hardening.sql` adds deterministic
list/status indexes and trigram search indexes for the account table.
The classes master-data vertical is now isolated in `modules/classes`: the
public `/api/options/kelas` read and teacher-only admin CRUD share one deep
interface, while the service validates class levels, duplicate names, bounded
pagination, and soft-deactivation rules. The repository owns explicit selects,
deterministic ordering, the Supabase/memory adapters, and actor metadata; all
mutations continue to emit the existing audit events. Migration
`033_classes_query_hardening.sql` adds name/order and trigram indexes without
changing the student relation or response envelopes. Migration
`034_students_query_hardening.sql` adds deterministic student-list/options and
class/search indexes; it is additive and must be validated on staging before
production.

The legacy student dashboard summary is now isolated in `modules/dashboard`.
Its route keeps the existing ownership and first-login guards, the service
validates the student identifier, and the repository owns the temporary
fixture adapter. No dashboard migration is added: the existing payload is not
yet backed by one agreed relational read model. A future SQL view/RPC should be
introduced only after the attendance, cash, grades, borrowing, and contest
joins are specified and validated on staging.

The audit trail read/write seam is now isolated in `modules/audit`.
`audit.routes.ts` owns the three teacher-only read endpoints, `audit.service.ts`
owns action, UUID, date, and pagination validation, and `audit.repository.ts`
owns bounded `activity_logs` queries, one-query actor enrichment, and the
existing `write_audit_log` RPC. Migration `017_audit_trail_hardening.sql`
remains the source of the audit schema; this extraction adds no schema change.

The overdue-check endpoint is isolated in `modules/overdue`.
`overdue.routes.ts` owns the leader-only HTTP boundary, `overdue.service.ts`
owns recipient, notification, and audit idempotency rules (with one audit
lookup per batch), and
`overdue.repository.ts` is the Supabase adapter with explicit selects and
bounded 500-row scans. `workers/overdueWorker.ts` is now a scheduler-only
adapter that invokes the same service as the manual route. The in-memory
diagnostic history is capped at the most recent 100 entries; no database
migration is required.

Weekly cash billing follows the same deep-module seam. `billing.repository.ts`
is the only application boundary for the `generate_weekly_cash_billing` RPC,
`billing.service.ts` owns run-date normalization, safe unavailable-database
handling, and error logging, and `workers/weeklyBillingWorker.ts` only owns
Monday-midnight scheduling and lifecycle cleanup. The RPC remains the owner of
database locking, settings, idempotency, and debt inserts; no new HTTP route or
schema change is introduced.

## Composition root responsibilities

`src/app/createApplication.ts` owns plugin order, global hooks, route modules,
and worker lifecycle. `src/app/app.dependencies.ts` builds the dependency graph,
`src/app/app.routes.ts` registers feature plugins, and `src/app/app.hooks.ts`
contains cross-cutting request behavior. `src/server.ts` only starts the
application and reports startup failure. Runtime configuration is centralized
in `src/config/env.ts`. Production must not enable development mock
authentication.

Authentication policy remains in `middleware/authMiddleware.ts`; authoritative
account lookup, short-lived session-state caching, and legacy student-ID
resolution live in `modules/auth/auth.identity.ts`. This keeps Supabase access
behind the auth identity seam while preserving the existing route guard API.

The R2 adapter is fail-closed and signs real PUT/DELETE requests with SigV4.
When R2 variables are absent it returns an explicit configuration error rather
than a simulated success or a fake public URL. Upload endpoints should be added
only after a route/service contract and size/content validation are defined.

The line-count rule is a warning signal, not a target. A composition root is
healthier below roughly 100 lines; route plugins and services are commonly
50–250 lines; repositories may reach 300 lines when a feature has several
queries. Split when a file owns more than one reason to change (or when a
query/route family has its own stable seam), not merely to force every file to
300–500 lines. Current measured outliers are `contests.repository.ts` (389)
and `authMiddleware.ts` (228); they are separate follow-up refactors because
their contracts are not changed by the composition-root extraction.

## Current migration status

Migrations `025_security_privileges_hardening.sql`,
`026_attendance_summary_aggregate.sql`, `027_resilience_stores.sql`, and
`028_contest_query_hardening.sql`, `029_contest_frontend_contract.sql`,
`030_equipment_query_hardening.sql`, `031_notifications_query_hardening.sql`,
`032_users_query_hardening.sql`, `033_classes_query_hardening.sql`, and
`034_students_query_hardening.sql`
are
additive. The first revokes direct client execution of protected
security-definer functions and changes class mutations to service-role only.
The second adds the indexed attendance summary function used by
`modules/attendance`; the third adds cross-worker idempotency and login-rate
limit stores. The fourth adds the additive contest presentation/submission
contract; the equipment and notification migrations add query/schema
hardening. Apply them after `001` through `034` in a staging database, then
run the verification checklist in
`docs/security-runbook.md`.

The post-RBAC security migrations `035_access_control_rbac.sql` through
`039_supabase_security_advisor_hardening.sql` are also forward-only. They add
teacher-managed capability data, immutable actor snapshots, canonical audit
events, deny-by-default handling for internal views/tables, and targeted
Supabase Advisor hardening for client-role RPC execution, the class write
policy, and mutable function search paths. The Fastify service-role client
remains the only application data path for these server-owned relations and
functions.
