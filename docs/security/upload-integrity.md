# Private R2 upload integrity

## Local code changes

The existing private-upload module keeps its feature interface: reservation returns
an object key and signed PUT; completion calls `verifyCloudflareR2ImageUpload`; an
authorized feature now returns an authenticated API reference; see
[private media access](private-media.md). No Supabase rows,
policies, migrations, bucket settings or deployed services were changed here.

New private uploads use two server-generated object locations:

1. `staging-v2/<feature>/<random-file>` is the only new location for which the
   browser receives a signed PUT. The signed content type is unchanged; the write
   URL expires after 300 seconds.
2. Completion reads one whole, bounded snapshot. The response must be HTTP 200,
   with the declared JPEG/PNG/WebP type and an explicit positive byte length that
   matches the reservation. The stream must contain exactly that many bytes, at
   most 5 MiB. Missing metadata, partial responses, unsupported encoding, overflow,
   truncation and a mismatching file signature fail verification. Requests reject
   redirects and time out after 10 seconds each.
3. The backend uploads **those same bytes**, not a second copy of the mutable
   staging object, to `validated-v2/<feature>/<random-file>`. The server-only PUT
   signs `Content-Type`, `Content-MD5` and `If-None-Match: *`. A conditional conflict
   is accepted only after a bounded read verifies the existing final object's
   type, size and signature. Invalid final objects are not replaced.
4. The database continues storing the reservation's staging key for compatibility.
   The central read module maps that key to its final object. It never issues a
   browser PUT for a `validated-v2/` key. Signed GET URLs are no longer issued to
   the browser. Reports/viewers use authenticated byte responses with fresh domain
   checks and `private, no-store`; `expires_in_seconds: 0` denotes an API reference.

An upload completion retry uses the existing valid final object. Reusing a
still-valid browser PUT can modify only staging, not the displayed final object.
This is application-enforced write separation, **not** bucket Object Lock: storage
administrators and other holders of server write credentials remain privileged.

Cloudflare documents conditional PUT and Content-MD5 support in its
[S3 API compatibility documentation](https://developers.cloudflare.com/r2/api/s3/api/).
Signed URLs are bearer credentials and remain reusable until expiry; see
[Cloudflare presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/).

## Important limits and remaining work

- Signature checks are not full image decoding. This change does **not** validate
  dimensions, re-encode images, remove embedded metadata, scan malware or classify
  inappropriate content. A maintained image decoder in an isolated,
  resource-limited worker requires a separately reviewed dependency and runtime
  design. Do not describe this module as complete image sanitization.
- The module name "private" does not establish bucket privacy. An owner must
  confirm that `r2.dev`, public custom domains and public Workers routes cannot
  expose either staging or evidence. These settings were not inspected or changed.
- Direct browser PUT size is checked **after** storage receives it. This does not
  prevent oversized traffic or storage costs before completion. Pre-upload byte
  enforcement, upload quotas and global rate limits need their own trusted ingress
  and policy. Short URL expiry is not a substitute for those controls.
- Existing legacy object keys keep their existing access locations. Pending legacy
  reservations may still be re-signed for compatibility. They do not gain the new
  staging/final separation. Migrating old files requires an owner-approved,
  reversible storage-and-database plan; do not silently rename keys or delete rows.
- Inline image fields also receive the separate source-level checks below. They
  do not gain R2 staging/final separation; their bytes remain within authenticated
  API responses, not public bucket URLs.
- No automatic cleanup runs. Configure a narrowly scoped lifecycle rule for
  `staging-v2/` only after confirming retention needs and owner approval. Never
  apply that rule to `validated-v2/`. Stored reservations and final objects must
  be considered together in any approved cleanup plan.
- Technical verification is separate from transaction approval or human content
  moderation. Existing roles and business verification flows remain unchanged.

## Inline image references

The shared `backend/src/shared/uploads/imageReference.ts` validator is used for
student photos (create, profile update and legacy account linking), equipment
photo arrays and legacy photo fields, repair inspection/replacement photos, cash
income/expense proof, cash dispute evidence and legacy contest achievement
evidence. New inline uploads must declare JPEG, PNG or WebP, contain canonical
base64 and match that format's minimal signature. SVG, HTML, GIF, arbitrary MIME
types, malformed base64 and signature/type mismatches are rejected before a
repository write. Decoded sizes are checked before allocating their buffers.

Existing endpoint budgets remain: student photos have a two-million-character
budget, cash/contest achievement proof has a 900k-character budget, and equipment
photos have a decoded 600 KiB limit. Recovery/replacement now enforce that same
equipment photo byte limit server-side. Optional blank student/cash proof fields
remain optional; a dispute still requires evidence.

New private image fields reject HTTP(S) links by default. Previously stored remote
images are unavailable through the application's viewers; no arbitrary URL fetch
or JSON redirect fallback is provided. Re-upload/import requires separate approval;
the code cannot make an already public off-site object private. External metadata
links require explicit validation opt-in and are not a private-image upload path.
Certificate/document URLs in `contests.service.ts` remain on their existing
HTTP(S)-only validation because they are not a photo-only contract. Previously
stored rows are unchanged and can still contain legacy references; no automatic
database cleanup or migration was performed. Exported legacy public R2 utilities
have no production callers in the reviewed source and were not converted into
the private staging workflow.

The signature helper is shared with R2 verification and intentionally is **not**
a full decoder. A syntactically accepted raster can still contain malformed
image structures, metadata or inappropriate visual content. Full bounded
decoding/re-encoding and a moderation policy remain separate work; no new human
approval queue was introduced.

## Verification and safe rollout

The regression tests use dummy storage settings and mocked responses. They cover
exact-length streamed reads, missing metadata, conditional finalization, races,
retries, legacy reads and prohibition of final-key browser PUTs. No live R2
requests or Supabase writes are required by these tests.

Local verification on 13 October 2026 used `ENV_FILE_LOADING=disabled`, mocked R2
transport and repository fixtures. Backend quality passed 594 tests with one real
PostgreSQL rehearsal skipped; typecheck/build and OpenAPI parity (160 operations)
passed. Frontend quality passed its six private-media and twelve build/asset tests,
with zero hard bundle violations and 22 target warnings. This is not live provider,
browser acceptance, full image sanitization, full SAST or production approval.

Before enabling online, obtain separate owner approval for any provider checks.
Validate the PUT condition and signed headers against a dedicated non-production
test bucket, and exercise normal upload/gallery/camera/completion/retry flows.
Keep evidence private. Backend rollback does not understand new key mapping, so
retain this read-mapping module during rollback or explicitly plan compatibility
before publishing a version that uses new prefixes.
