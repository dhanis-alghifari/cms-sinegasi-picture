# Security hardening — local implementation, not a completed live audit

No Supabase/server/provider query or mutation, deployment, commit, or push was
performed in this change. No environment file contents were read or printed.
Owner approval is required for **each** live Supabase action. Draft SQL lives
outside `backend/src/migrations` so an automatic deployment does not apply it.

## Locally prepared controls

- Shared IP/account rate limiting and stricter upload, credential, sensitive-read
  and export buckets. See [rate limit rollout](api-rate-limit.md).
- Failed login attempts are counted across IPs per normalized account as well as
  per IP/account pair. Public login fails closed on shared-store outages. See
  [login limits and lockout trade-offs](authentication.md).
- Credential/signed-URL responses are not persisted in the idempotency response
  cache. Legacy cached secrets are denied on replay; they are **not deleted**.
  Credential-issuing routes opt out entirely. Domain uniqueness still applies,
  but this is not an exactly-once credential-operation ledger.
- Temporary passwords are cryptographically random per account in every
  environment; `STUDENT_DEFAULT_PASSWORD` is no longer used for new accounts.
  Existing passwords are not reset by this patch.
- Internet-facing development requires configured JWT/Supabase credentials and
  disables mock authentication. Auth-version and policy failures deny public
  access rather than silently using legacy or baseline permissions. A fresh
  identity/policy cache can remain valid for up to five seconds after a change.
- Full `/api/students` requires `students.read`. The borrowing selector uses
  bounded minimal `/api/students/options` results instead of downloading contacts.
  Existing explicitly assigned `students.read` grants remain; no role policy or
  student data was changed in Supabase.
- New private R2 uploads use a browser-write staging key and a separate,
  conditionally created server-only final key. Read URLs point to final objects.
  See [upload guarantees and limitations](upload-integrity.md).
- New inline photo input in students, cash, equipment and contest achievements
  shares bounded JPEG/PNG/WebP base64/signature validation. External image URLs
  are parsed without fetching them; their actual content and later changes are
  not controlled. Existing stored photos are unchanged.
- Explicit credential headers/fields are redacted from default logging; auth and
  app error hooks no longer dump provider error objects. This does not certify
  every legacy feature/worker log as free of sensitive information.
- Containers are non-root (existing Dockerfile), read-only, capability-dropped,
  and bounded by memory/CPU/process limits. Scratch writes are limited to `/tmp`.
  Proxy trust is one hop in the supplied Compose deployments, not unconditional.
- External push bodies omit student names, evidence, transaction IDs and asset
  details; public-mode sends require HTTPS and a token. Compose defaults disable
  ntfy until topic privacy is verified. In-app notifications remain unchanged.
- Frontend framing/MIME/referrer protections are configured. CSP is deliberately
  **report-only**, not an enforced XSS defense yet. Review browser violations for
  the real API, asset and R2 origins before choosing an enforced policy.

## Important unfinished protections

The website is **not certified hack-proof** and these local files do not prove
that the running development/production deployment has these controls.

1. **Cookie/session transport is unchanged.** The frontend still stores its
   bearer token in localStorage; logout still does not revoke a JWT server-side.
   A valid copied token can be replayed until expiry/revocation, subject to its
   permissions and new account rate limit. CORS/Origin/User-Agent checks cannot
   turn bearer credentials into proof of a device. Do not claim otherwise.
2. Recommend a same-origin `/api` deployment before HttpOnly `Secure`, host-only
   session cookies with restrictive SameSite. A cookie rollout must include
   CSRF defenses, server-side revocation, safe rotation/expiry, old-token
   invalidation, and frontend bootstrap/logout updates together. It needs a
   domain/proxy choice; cross-site Pages/DuckDNS cookies can be blocked by
   browsers. HttpOnly restricts JavaScript reads, not browser-owner DevTools,
   compromised devices, or an XSS attacker making authorized requests.
3. Full image decoding, pixel/dimension limits and re-encoding require a
   maintained decoder in a resource-isolated process, dependency review and
   tests. Signature/type validation is **not** proof that an image is harmless.
   Neither technical validation nor rate limiting identifies inappropriate
   visual content. Optional moderation is a separate policy for public
   publication, not a blanket teacher queue for every private evidence upload.
4. Direct R2 PUTs can reuse a signed URL before expiry and can upload more bytes
   than reserved; API throttling does not govern that storage traffic. The
   backend refuses attachment/promotion of invalid/oversize objects but cannot
   retroactively prevent their storage/bandwidth cost. A private upload gateway,
   byte budgets and staging retention rules need approved provider changes.
5. Existing inline/base64 photos and legacy R2 keys are not migrated to the new
   object lifecycle. Actual R2 bucket privacy, public-domain exposure, Supabase
   grants/RLS/function permissions and edge WAF controls remain unverified.
6. Previously cached plaintext secrets, legacy plaintext password rows (if any),
   shared push topics and legacy logs need separately approved retention/key/
   credential remediation. Never run cleanup or reset user passwords by default.

## Owner-controlled rollout order

1. Specify the Supabase **development project** and authorize metadata-only
   inspection through a read-only connector. [verify-metadata.sql](verify-metadata.sql)
   selects catalogs, not business rows or function bodies; it has not been run.
   Never paste service-role keys/passwords into chat.
2. Review actual grants/RLS, auth-version migration and existing login limiter
   RPCs. Prepare narrowly scoped fixes only after findings; approve migrations
   separately. Do not blindly revoke existing privileges on production tables.
3. Create the counter migration using an installed Supabase CLI, then validate
   [api-rate-limit.sql](api-rate-limit.sql) with dummy data in an approved isolated
   database. Apply only after project-specific owner approval.
4. **Do not deploy the public API before its shared limiter RPC exists.** The
   intended missing/outage behavior is 503, which otherwise interrupts all API
   pages. Public deployments also require valid `users.auth_version`, seeded
   policy tables, and working shared failed-login RPCs before activation.
5. Choose the cookie/domain topology and approve the session rollout separately.
   Review bucket/privacy/gateway/retention settings separately before changes.
6. Run tests, typechecks, builds, dependency/static scans and migration checks in
   an approved OS-enforced sandbox: no external network, explicit empty-env
   allowlist, scratch HOME/cache, read-only code/toolchain, scratch-only writes,
   and CPU/memory/process/file-size/disk/wallclock caps. This complete sandbox
   was not available in this session, so execution was **not performed**.
7. Stage dummy authorization/ownership tests, replay rejection, 429/reset tests,
   malformed/oversize/swap upload tests and normal camera/gallery workflows.
   Verify proxy/IP headers cannot be forged via a direct backend path. Measure
   school-NAT concurrency and DB load; initial quotas/resources are not capacity
   guarantees. Review CSP reports before enforcement.
8. Approve development deployment, smoke-test without real student data, then
   approve production promotion separately. Roll back application code/config
   if needed; preserve new R2 key read mapping and never drop business data.

## Verification status

Source/diff review and `git diff --check` are the only completed local checks.
Tests were added but not run. No dependency scan, build, SQL execution or live
configuration verification was performed. Deployment approval remains pending.

References: [OWASP file upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html),
[Supabase API security](https://supabase.com/docs/guides/api/securing-your-api),
[R2 signed URL behavior](https://developers.cloudflare.com/r2/api/s3/presigned-urls/).
