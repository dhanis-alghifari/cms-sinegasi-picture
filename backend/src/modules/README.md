# Feature module convention

## How to navigate the current tree

Small features may remain flat. Larger features use domain subfolders and a
public module facade. For example, cash is now organized as:

```text
modules/cash/
  cash.module.ts       # public interface used by app composition
  ledger/              # transactions and balance
  reports/             # reports, debts, billing rules
  payment-methods/     # payment master data
  disputes/            # transaction disputes
  shared/              # cash-owned types, schemas, helpers, memory state
```

Split by a stable reason to change, not by an arbitrary line-count target.
Keep shared code local to its owning module until a second module genuinely
needs the same interface.

This directory is the destination for incremental extraction from the legacy
composition root. Do not move all routes in one risky rewrite. Each feature should
become a Fastify plugin with the following files:

```text
modules/<feature>/
  <feature>.routes.ts
  <feature>.service.ts
  <feature>.repository.ts
  <feature>.types.ts
  <feature>.test.ts
```

Request/response JSON schemas live in `src/shared/http/schemas` so they can be
shared by route plugins and the OpenAPI contract without importing a feature's
database adapter.

Feature modules are extracted as vertical slices. The students module
owns bounded list/options queries, account provisioning RPCs, profile updates,
and the student-to-user active lifecycle; its in-memory state is shared with
cash modules for local development. Cash read operations
(`summary` and `transactions`) now use the same route/service/repository
seams. Payment-method master data is also extracted with its own
route/service/repository and audit callback. Cash ledger mutations now have a
separate route/service/repository; the repository keeps the atomic RPC boundary
and tests cover idempotent replay and balance protection. Their route plugins
are registered by `src/app/app.routes.ts`, while repositories own Supabase
queries and services own validation/use-case orchestration. Preserve existing response
envelopes during future extraction and add contract tests before changing
them. Cash reporting (`cash.reporting.*`) now owns report, debt, and
billing-rule queries. Cash disputes (`cash.disputes.*`) owns dispute
submission and resolution. Both modules keep HTTP concerns in routes,
validation in services, and Supabase/memory persistence in repositories; the
legacy endpoint envelopes are preserved and documented in `docs/openapi.yaml`.
The shared local cash fallback state is created by `shared/cash.memory.ts`, keeping
transaction, debt, payment-method, and billing-rule fixtures in one injected
object instead of the composition root.
Borrowing list and summary reads are now under `modules/borrowing` with the
same route/service/repository convention. Create, approve/reject, handover, and
return mutations use the same convention; repositories retain atomic RPCs and
services own validation while route plugins own authentication/RBAC and HTTP
envelopes. Grades are now extracted as a full vertical slice (grade reads,
assignment creation, bulk writes, and secretary reports). Contests are also
split into `contests.routes.ts`, `contests.service.ts`, `contests.repository.ts`,
`contests.helpers.ts`, and `contests.types.ts`; future assignment and film
changes should extend the existing `grades` and `film-works` modules.
The read-only film catalog is now under `modules/film-works`; future film
mutations should extend that module instead of adding handlers to the
composition root.
The contests service normalizes both legacy API fields and frontend presentation
fields. Migration `029_contest_frontend_contract.sql` adds presentation
metadata and rich submissions without removing the legacy seam.
The equipment catalog is now isolated in `modules/equipment`: route handlers
own HTTP schemas and the `equipment_team` guard, the service validates catalog
values and photo limits, and the repository owns explicit Supabase selects,
count-only summaries, reservation lookups, and the local memory adapter. Its
memory state is injected into borrowing mutations so local development has
one source of truth. The dashboard summary keeps a separate fixture adapter
until its cross-domain read model is specified. Migration
`030_equipment_query_hardening.sql` adds the damage-note field and catalog/
reservation indexes without changing the existing response envelopes.
Notifications are now isolated in `modules/notifications`: routes keep the
legacy envelopes and both read-all methods, the service validates user/id
inputs, and the repository owns user-scoped explicit selects, count-only
queries, deterministic pagination, and the memory fallback. Migration
`031_notifications_query_hardening.sql` adds the notification list/unread
indexes.
User account management is isolated in `modules/users`: routes keep the
teacher-only RBAC boundary and audit callback, the service owns password
policy and linked-student lifecycle rules, and the repository owns explicit
account selects, bounded role/status/search filters, password-hash writes, and
auth-version rotation. DTOs never include `password_hash`; create/reset return
the temporary password only in the immediate response. Migration
`032_users_query_hardening.sql` adds deterministic account-list and trigram
search indexes.
Class master data is isolated in `modules/classes`: the public active-options
read and teacher-only management routes share a service/repository seam, with
level validation, bounded pagination, duplicate protection, soft-deactivation,
explicit selects, audit callbacks, and a local memory adapter. Migration
`033_classes_query_hardening.sql` adds deterministic class-list and trigram
search indexes.
Student management is isolated in `modules/students`: routes preserve the
secretary/teacher boundaries and legacy envelopes, the service validates NIS,
profile, photo, change-reason, and lifecycle invariants, and the repository
owns explicit selects, bounded filters, account-provisioning RPCs, and the
memory adapter. Migration `034_students_query_hardening.sql` adds the list,
options, class-filter, and trigram indexes.
The legacy student dashboard summary is isolated in `modules/dashboard`:
`dashboard.routes.ts` preserves the existing response envelope and auth/
ownership guards, `dashboard.service.ts` validates the target identifier, and
`dashboard.repository.ts` contains the development fixture adapter. It is
intentionally not given a speculative SQL query because the current payload
spans several domains without a defined read model; a future view/RPC must be
designed and benchmarked on staging before replacing the adapter.

The audit trail is isolated in `modules/audit`: routes preserve the three
teacher-only read endpoints, the service validates actions, UUIDs, dates, and
bounded pagination, and the repository owns explicit `activity_logs` selects,
one-query actor enrichment, and the existing `write_audit_log` RPC. Migration
`017_audit_trail_hardening.sql` remains unchanged.

The overdue check is isolated in `modules/overdue`: the route keeps the
leader-only admin boundary and legacy response envelope, the service owns
recipient/audit/idempotency orchestration, and the repository owns explicit
Supabase reads and writes. The repository scans at most 500 rows per batch;
the worker only schedules the service. Diagnostic history is capped at 100
entries and manual responses return at most ten.

Weekly billing is isolated in `modules/billing`: the repository is the only
Supabase/RPC adapter, the service normalizes the date and maps failures to a
safe operational error, and `workers/weeklyBillingWorker.ts` only schedules
the injected service. The database function remains responsible for locking,
idempotency, and financial writes; the extraction does not change the billing
contract or add a route.

Authentication identity lookup and its short-lived revocation cache are kept
in `modules/auth/auth.identity.ts`; `middleware/authMiddleware.ts` only owns
JWT verification and authorization guards. The standalone R2 storage adapter
fails closed when credentials are missing and never returns a simulated upload
success.
