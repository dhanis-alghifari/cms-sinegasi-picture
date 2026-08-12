# Query optimization gate

Cash reports delegate aggregation to `get_cash_report_with_method` so the
application does not load a period's ledger into Node. The in-memory report is
only a deterministic local fallback. Unpaid debt lists select explicit debt
and student columns, push status/member/search predicates into PostgREST, sort
by `created_at, id`, and cap each page at 100 rows. Billing rules are a
single-row settings lookup. Dispute writes select only the transaction fields
needed for ownership checks and use the database unique constraint on
`transaction_id` as the final duplicate guard.

Borrowing list reads select only the borrowing, student, and equipment fields
needed by the UI, push status and member ownership predicates to PostgREST,
and cap pages at 100. Search across nested equipment/student names is still a
compatibility filter after the bounded query; before production scale-up,
replace it with a dedicated indexed search RPC and verify it with
`EXPLAIN (ANALYZE, BUFFERS)` on staging data.
Borrowing mutations call the indexed, row-locking atomic RPCs from the
repository seam; the HTTP layer never performs a read-modify-write sequence.
This keeps equipment availability checks and state transitions in one
transaction and preserves idempotent create retries.

The attendance module pushes joined-student filters, ordering, count, and page
range to PostgREST. Its daily summary uses the indexed
`get_attendance_summary(date)` SQL aggregate from migration `026`, with a
temporary compatibility fallback while that migration is rolling out. A few
other monolithic handlers still fetch large result sets or perform report
aggregation in Node. Before changing them, capture a baseline with realistic
staging data.

The cash read slice follows the same gate. `GET /api/cash/summary` delegates
to the `get_cash_summary(p_student_id)` aggregate, while
`GET /api/cash/transactions` selects only response columns, pushes type/date/
payment-method/search filters to PostgREST, orders by `tanggal`, `created_at`,
and `id`, and applies a maximum page size of 100 before the range query. A
member scope is applied as `student_id = <JWT student id>` in the repository,
so authorization is enforced in the query rather than by filtering an already
loaded result set. The local memory adapter mirrors the same filters for
development and tests.

Payment-method master data is a small, bounded table. Its repository selects
the explicit audit columns, orders by `sort_order, label`, and caps the list at
100 rows; writes never
touch transaction rows. The `is_active` guard and immutable `code` rule are
enforced before the update so historical transactions remain addressable.

Cash income and expense writes are not implemented as read-modify-write logic
in Node. `ledger/cash.mutations.repository.ts` delegates them to
`record_cash_in_with_status_atomic` and `record_cash_out_with_method_atomic`,
passing the idempotency key and actor identity into the database transaction.
This keeps ledger locking, balance validation, debt settlement, and audit
ordering on the database side. The memory adapter is only for local fallback
and tests; it mirrors idempotent replay and rejects expenses above the current
balance.

## Required procedure for each hotspot

1. Record the request filters, sort order, and maximum page size.
2. Translate the filter into a parameterized database query.
3. Run `EXPLAIN (ANALYZE, BUFFERS)` on a representative staging dataset.
4. Add the smallest composite index matching the equality filters followed by
   the sort/range column.
5. Re-run the plan and compare latency, rows removed, and buffer reads.
6. Add a regression test for pagination and authorization scope.

Known first candidates are attendance search/class filtering, borrowing due-date
checks, and cash report aggregation. Do not add indexes blindly: every index
adds write cost and storage. Use keyset pagination for tables that will exceed
large offset ranges, and select only the columns needed by the response instead
of `select('*')`. For cash transactions, verify the existing date/type/payment
method indexes with `EXPLAIN (ANALYZE, BUFFERS)` before adding a composite
index; the exact index choice depends on the production filter distribution.

Grades and assignments use explicit column selects and bounded ranges. Bulk
grading is delegated to `record_grades_bulk_atomic`, so a request cannot
partially write a class roster. Search across joined student/assignment text
is currently a compatibility filter on the bounded page; production search
should move to an indexed reporting/search RPC before very large datasets.

Contest list reads select only the response columns, push status/level/search
filters into PostgREST, use deterministic date/id ordering, and cap pages at
100 rows. Contest summary uses count-only queries rather than transferring the
entire table to Node; win-rate reporting reads the aggregate view. Apply the
contest migration indexes in staging and verify the list and count plans with
`EXPLAIN (ANALYZE, BUFFERS)` before production scale-up. Contest-film writes
remain protected by the database unique constraint `(contest_id, film_id)` and
are surfaced as HTTP 409 on duplicate submissions.
The additive `029_contest_frontend_contract.sql` migration adds presentation
status/deadline indexes and `(contest_id, created_at, id)` for rich submissions.
The list path loads submissions for the current page in one bounded second
query, avoiding an N+1 query per contest.

The equipment catalog now follows the same performance boundary. Its list
repository selects only the response columns, sanitizes the contains-search
term before building the PostgREST `or` filter, orders by `created_at, id`, and
caps each page at 100 rows. Reservation status is resolved with one bounded
`borrowing_items` query for the current page rather than one query per item.
The summary endpoint uses five `count`/`head` queries in parallel instead of
transferring the entire equipment table into Node. Migration
`030_equipment_query_hardening.sql` adds the status/condition/category sort
indexes, trigram search indexes, and the reservation lookup index. Run
`EXPLAIN (ANALYZE, BUFFERS)` on representative staging data before applying
additional indexes or moving to keyset pagination for very large offsets.

Film catalog reads select explicit film and crew columns, push the optional
status filter to PostgREST, and sort by production year/id. The `film_crew`
foreign-key indexes in the contest migration keep the nested join predictable;
if the catalog gains free-text search, add a dedicated trigram/search RPC
instead of filtering a large joined result in Node.

Notifications are scoped by `user_id` before any page range is evaluated and
select only the fields used by the frontend. The repository uses a count-only
head query for unread badges, deterministic `created_at DESC, id DESC`
ordering for stable pagination, and a second count/update pair for mark-all so
it never transfers every notification row to Node.js. Migration
`031_notifications_query_hardening.sql` adds the `(user_id, created_at, id)`
index and a partial unread index. Validate both list and unread-count plans
with `EXPLAIN (ANALYZE, BUFFERS)` on representative staging data before
adding further indexes or moving to keyset pagination for very large offsets.

The users list is teacher-scoped and bounded to 100 rows per request. Its
repository selects only account fields safe for the UI, pushes role/status
filters and the sanitized username/name search to PostgREST, and orders by
`created_at DESC, id DESC` for deterministic pages. Migration
`032_users_query_hardening.sql` adds the role/status ordering indexes and
trigram indexes used by the contains-search contract. Verify the filtered and
unfiltered list plans with `EXPLAIN (ANALYZE, BUFFERS)` on staging before
raising page limits or moving the endpoint to keyset pagination. Linked-student
checks use the existing partial unique `students(user_id)` index, so account
update/delete invariants remain an indexed existence lookup.

Class management uses a maximum page size of 100 and explicit account-safe
columns. The repository pushes `tingkat`, `is_active`, and sanitized
`nama_kelas` search predicates into PostgREST, then orders by
`nama_kelas ASC, id ASC` so range pagination is stable. Active dropdown options
use one bounded master-data query instead of loading students or joining the
dashboard view. Migration `033_classes_query_hardening.sql` adds the
name/order, status/level, and trigram indexes; validate filtered list and
options plans with `EXPLAIN (ANALYZE, BUFFERS)` on staging before increasing
page limits or introducing keyset pagination.

Student management now follows the same boundary. The list endpoint selects
only the student profile and audit columns needed by the UI, pushes sanitized
search, class-level, peminatan, and active-status predicates into PostgREST,
orders by `created_at DESC, id DESC`, and caps each page at 100 rows. The
options endpoint selects only `id, nis, nama, kelas, is_active`, limits each
request to 20 rows, and orders by `nama, id` for stable searchable pickers.
Account creation, legacy account provisioning, profile updates, and active/
alumni transitions remain atomic RPC boundaries; Node never performs a
read-modify-write account transition. Migration `034_students_query_hardening.sql`
adds deterministic list/options indexes and a `kelas` trigram index. Validate
the filtered list, options, and class-prefix plans with `EXPLAIN (ANALYZE,
BUFFERS)` on a representative staging dataset before changing page limits or
adding further indexes. SQL injection probes and SQLMap runs require a written
authorized staging scope; only static query-construction review was performed
here.

The legacy student dashboard summary is deliberately different from the
query-backed read modules. Its repository currently returns a bounded
development fixture and does not issue a broad multi-table query. This avoids
shipping an unverified N+1 or cross-domain join while the dashboard read model
is still being specified. Before production data is connected, design one
parameterized SQL view/RPC for the attendance, cash, grades, borrowing, and
contest sections, select only the fields in the documented response, and run
`EXPLAIN (ANALYZE, BUFFERS)` on representative staging data. Do not replace
the adapter or add indexes until those plans and row/cardinality limits are
reviewed. Static SQL injection review was performed; SQLMap or live probes
require a written authorized staging scope.

Audit reads are bounded at 100 rows, use explicit audit columns, and sort by
`created_at DESC, id DESC` for stable pages. Actor enrichment is one
`users.id IN (...)` lookup per page rather than an N+1 query. Migration
`017_audit_trail_hardening.sql` provides the `(created_at, id)`, table/record,
and user ordering indexes used by these paths. Before raising limits or adding
search indexes, run `EXPLAIN (ANALYZE, BUFFERS)` on representative staging
data; search input is allowlist-sanitized before the PostgREST `or` expression.

The overdue repository reads only the required borrowing, student, and
equipment fields, orders deterministically, and processes at most 500 rows per
batch. Audit existence is checked once per batch instead of once per
borrowing. Notification writes remain idempotent through the unique
`event_key`, while diagnostic history is capped at 100 entries and the manual
endpoint returns only ten. Before production volumes reach millions of rows, validate
the `borrowings(status, due_at, id)` access path with
`EXPLAIN (ANALYZE, BUFFERS)` on staging; if offset pages show degradation,
replace the loop with a keyset/RPC implementation. No live plan or SQLMap probe
was run without an authorized staging scope.

Weekly billing does not scan ledger rows in Node. The repository sends one
typed `p_run_date` argument to the database-owned
`generate_weekly_cash_billing` RPC, which keeps locking, settings, idempotency,
and debt inserts in one transaction. Treat that RPC as the query/performance
boundary: benchmark it with `EXPLAIN (ANALYZE, BUFFERS)` on staging and review
its execution plan before changing indexes or moving any billing logic into
the application process.
