# Sinegasi CMS API guide

`docs/openapi.yaml` is the canonical, machine-readable contract. It is the
source for Swagger UI, client generation, and contract review; this document
explains the conventions that every consumer and new endpoint must follow.
Run `npm run api:check` after changing a route to verify method-and-path parity.

Validator tersebut memindai route di semua subfolder feature, menghitung
operation Fastify, lalu membandingkannya dengan `docs/openapi.yaml`. Saat
menambah endpoint, ubah route schema dan OpenAPI dalam pull request yang sama.

## Base URL and transport

Local development uses `http://localhost:5001`. Production must terminate TLS
at the controlled edge and expose an HTTPS origin. The API is currently
mounted under `/api`; new breaking changes should be introduced under a
versioned prefix (for example `/api/v1`) instead of silently changing an
existing response envelope.

## Authentication

1. `POST /api/auth/login` with `{ "username": "...", "password": "..." }`.
2. Store the returned access token in the frontend's in-memory auth state.
3. Send `Authorization: Bearer <token>` on protected requests.
4. Call `POST /api/auth/logout` when the session ends. A password change or
   auth-version rotation invalidates older tokens.

The server re-checks the authoritative account state for UUID-backed users,
rejects inactive accounts, and enforces the first-login password change gate.
Never put a service-role key, password, or token into a URL, log line, or
client bundle.

`users.username` is a mutable login identifier, while `users.id` is the stable
identity used by students, audit fields, and other feature relations. An actor
with `users.manage` may change a target account's username through
`PUT /api/users/{id}` with `X-Change-Reason`; the next login must use the new
username. The unique database constraint remains the source of truth and a
conflict is returned as HTTP 409. The production repository uses the atomic
`update_user_account_atomic` RPC, so the update and its redacted audit event
commit together; a retry that produces no effective state change is a safe
no-op.

## Response and error contract

Successful endpoints preserve their feature-specific legacy envelope and are
described in OpenAPI. Unhandled errors are normalized by the global Fastify
handler:

```json
{
  "success": false,
  "error": "RequestError",
  "message": "Data yang dikirim belum valid.",
  "request_id": "req-..."
}
```

Use `request_id` when reporting a problem. The public message is deliberately
generic for 5xx responses; internal details are available only in structured
server logs. A few legacy feature handlers intentionally keep their historical
`statusCode`/`message` error envelope; those cases are described in the
OpenAPI operation and should not be changed without a compatibility review.

## Actor and audit projections

Records retain their canonical `*_by` UUID fields for joins and backward
compatibility. Responses from authenticated feature endpoints add an actor
projection beside those fields, for example `created_actor` and
`updated_actor`, with `id`, `nama`, `username`, and `role`. The server resolves
all actor UUIDs for one response in a single batched users query with a short
cache; it never performs one query per row. If an actor was deleted, the UUID
remains visible and the projection is marked `Aktor tidak ditemukan`.

Picker endpoints such as `GET /api/options/kelas` deliberately opt out of the
projection and return only the fields needed by the picker. This keeps public
option payloads small and prevents audit metadata from leaking into generic
UI controls.

## Pagination, filtering, and ordering

List endpoints use `page` and `pageSize` unless their OpenAPI schema documents
an endpoint-specific limit. The server clamps normal pages to 100 rows and
picker/options endpoints to a smaller bound. Responses expose `data`,
`total`, `page`, `pageSize`, and `totalPages` where applicable. Ordering is
deterministic (usually a business timestamp followed by `id`) so retries and
page navigation do not reshuffle rows.

Search values are validated and sanitized before they reach PostgREST. Clients
must not build SQL or PostgREST expressions themselves; pass plain query
parameters only.

## Mutation headers and retries

Financial, attendance, borrowing, contest, and other retryable mutations use
`X-Idempotency-Key` (8–128 characters). Reuse the same key for a retry of the
same logical operation; use a new key for a new operation. The domain database
RPC/unique constraint remains the source of truth for exactly-once behavior;
the HTTP cache only replays a completed response. Mutations that change an
audited record also require `X-Change-Reason` as documented by their schema.

Example:

```bash
curl -X POST "$API_URL/api/cash/transactions/in" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: cash-in-20260812-0001" \
  -H "X-Change-Reason: Initial deposit" \
  -d '{"student_id":"<uuid>","nominal":50000,"keterangan":"August fee"}'
```

## Capability model

Authentication and authorization are separate checks. Routes first call
`authenticate`, then apply a minimum role, explicit role allow-list, capability
guard, or ownership guard. The most important capability groups are:

| Capability | Purpose |
| --- | --- |
| `students.read` / `students.read.own` | Global or self-only student access |
| `students.manage` | Student/account lifecycle management |
| `attendance.record` / `attendance.correct` | Attendance writes and corrections |
| `cash.manage` | Cash ledger and payment master-data mutations |
| `borrowing.manage` | Borrowing workflow mutations |
| `contests.submit` / `contests.manage` | Film submissions and contest administration |

The complete role matrix is implemented in `src/middleware/capabilities.ts`;
the endpoint-level requirements are the `security` and description fields in
`docs/openapi.yaml`.

The policy can be inspected and changed through the teacher-only access-control
API after migration `035_access_control_rbac.sql` is applied:

- `GET /api/access-control/matrix` returns the persisted role/capability matrix.
- `PUT /api/access-control/roles/{role}/capabilities` replaces one role's
  capabilities and requires `change_reason` (5–500 characters). The operation
  is persisted through a transaction-safe database function and writes an audit
  row. The teacher role cannot remove `access_control.manage` from itself.

The dashboard contract is also role-scoped: `GET /api/dashboard/summary`
returns `scope: "operational"` for teachers and `scope: "personal"` for every
other role. Personal responses are resolved from the authenticated user's
linked student account; callers cannot request another student's summary from
this endpoint.

## Endpoint families

The contract currently covers health/auth, students and classes, dashboard,
attendance, grades, users, notifications, equipment, borrowing, cash,
contests/film works, audit logs, and the overdue administrator trigger. Each
family is a vertical module under `src/modules/<feature>` with the same
route → service → repository boundary. Add a new endpoint to its owning
module, its local JSON schema, and `docs/openapi.yaml`; do not add feature
handlers to `src/server.ts` or the composition root.

## Compatibility and rollout checklist

Before shipping a contract change:

1. Update the route JSON schema and OpenAPI path together.
2. Preserve existing envelopes or introduce a versioned endpoint.
3. Add a route/service regression test for validation, authorization, and the
   happy path (including idempotent replay for retryable writes).
4. Check query select lists, filters, bounds, and indexes against
   `docs/query-optimization.md`.
5. Run `npm run typecheck`, `npm run build`, `npm test`, the OpenAPI validator,
   and the architecture/security static scans.
6. Run database privilege and `EXPLAIN (ANALYZE, BUFFERS)` checks only on an
   authorized staging dataset before production rollout.
