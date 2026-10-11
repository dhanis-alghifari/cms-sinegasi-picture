# API abuse protection: rollout requires owner approval

The local code adds one rate-limit module at the Fastify app hooks seam. No live
Supabase query, migration, deploy, or data change was performed. The draft SQL in
`api-rate-limit.sql` is deliberately outside the automatic migrations directory.
The Supabase CLI is not installed here, so no migration filename was invented.

## Behavior

- Before body parsing and authentication, every API request consumes an IP quota.
- After successful `authenticate`, the account consumes its own quota before
  permissions, response-cache replay, and the feature handler. A decoded or
  invalid JWT never establishes this identity. Token rotation cannot reset it.
- OPTIONS and `/api/health` are exempt. Registered route templates select
  policies; query strings, resource IDs, and copied tokens cannot create extra
  account buckets. All protected routes retain their existing authorization.
- Public deployments require atomic shared Supabase counters. A missing RPC,
  timeout, or outage returns generic `503 RATE_LIMIT_UNAVAILABLE`, not a silent
  memory fallback. Offline/local development can use bounded process memory.
- Each worker rejects hot keys locally, has at most 10,000 active local counters,
  at most 128 pending shared decisions, a two-second RPC timeout, and a five-second
  outage circuit breaker. Active counters are not evicted to let key churn reset
  quotas. Capacity exhaustion fails closed with a retryable 503.
- Rate rejection returns `429 RATE_LIMIT_EXCEEDED`, `Retry-After`, and
  `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers.
  Successful headers describe the final applicable bucket, not every bucket.

Initial policy values are configuration-in-code starting points, not measured
capacity guarantees:

| Bucket | Shared quota |
| --- | --- |
| One IP, all API requests | 1,200/minute |
| One IP, login requests | 180/minute, plus the existing failed-login limiter |
| One verified account, all requests | 180/minute |
| One account, writes | 60/minute |
| One account, upload/photo/evidence operations | 60/minute |
| One account, account creation/edit/reset/link/permission changes | 10/5 minutes |
| One account, student/user/grade/attendance/audit reads | 60/minute |
| One account, reports/exports | 10/minute |

Quotas are cumulative: an upload also consumes the IP, account, and write buckets.
Reserve and completion each count, so 60 upload operations means at most 30
reserve/complete pairs if no retries are needed. A generous IP ceiling reduces,
but cannot eliminate, school-NAT contention. Measure expected concurrent school
use before changing it. Fixed UTC windows allow up to twice a quota near a window
boundary; they are not a sliding-window or volumetric-DDoS guarantee.

Only hashed, policy-scoped principal identifiers enter shared counters. Hashes
are pseudonymous, not encrypted secrets: restrict table access and retention.
No tokens, passwords, raw IPs, URLs, query parameters, or request bodies are saved
by this module. Existing logging policy still needs independent review.

## Deployment gate

1. Obtain explicit owner approval for the named Supabase project/environment,
   new counter table, RPC functions, execution grants, and any maintenance task.
   Do not change or inspect business rows to validate counters.
2. In an approved isolated environment, discover installed CLI commands with
   `supabase --help` and `supabase migration --help`, then create the migration
   using `supabase migration new api_rate_limit_windows`. Review the draft SQL and
   follow the project's numbered-migration convention when promoting the artifact.
3. Validate SQL and service-only grants with dummy keys in an isolated database:
   concurrent calls must never admit more than a quota; browser roles must not be
   able to read counters or execute either function. Verify next-window recovery.
4. After separate owner approval, apply the migration **before** deploying the
   rate-limited public API. Without this RPC the public API intentionally returns
   503, so deploying the code first would interrupt authenticated pages.
5. Check trusted proxy configuration. `request.ip` is only trustworthy when
   clients cannot forge the forwarded IP and all direct paths to the API enforce
   the same proxy trust. Do not set unbounded `trustProxy: true` as a workaround.
6. Run source and fixture tests in an OS-isolated environment: no external
   network, explicit empty-environment allowlist and scratch HOME, read-only
   source/toolchain, scratch-only writes, CPU/memory/process/file/disk/time caps.
   No such fully enforced sandbox was available here; tests were added but not run.
7. Observe aggregate 429/503 rates, RPC latency, pending operations, and database
   counter growth during staging use. Tune quotas with actual staff/student usage.
   Rollback code deployment if necessary; do not drop the table or modify data.

## Explicit limitations / follow-up

This is API request throttling, not a Cloudflare edge/WAF rule, image moderation,
or upload-byte quota. Direct browser PUTs to R2 bypass Fastify. Their reserved
URLs need separate upload size/integrity controls and consumption budgets.
The new shared RPC also adds database work to legitimate API traffic; load-test
only an approved isolated setup before deciding whether a dedicated shared cache
is warranted. A 503 during store outage prioritizes security over availability.

Counter expiry does not physically remove rows automatically. The draft provides
an optional service-only, 1,000-row-bounded cleanup RPC for counters untouched for
two days. Scheduling or invoking it is a separate data-changing action requiring
owner approval. It deletes only security counters, never business data.

Sources: [Fastify hooks](https://fastify.dev/docs/latest/Reference/Hooks/),
[Supabase API security](https://supabase.com/docs/guides/api/securing-your-api).
