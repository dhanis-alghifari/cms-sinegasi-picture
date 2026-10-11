# Guarded development deploy

Run this on the VPS from the repository root after updating `develop`:

```bash
cd /opt/sinegasi
git fetch origin develop
git pull --ff-only origin develop
./ops/deploy-dev.sh
```

The script deliberately does not use `--remove-orphans`. It verifies that
`caddy-proxy` is running before and after the deploy, takes a lock so deploys
cannot overlap, builds `api-dev`, runs every pending numbered SQL migration
through `dist/scripts/applyMigrations.js`, recreates only `api-dev`, and waits
for `/api/health`. Compose orphan notices are suppressed with
`COMPOSE_IGNORE_ORPHANS=1`; the script still verifies `caddy-proxy` directly and
never uses `--remove-orphans`.

The existing **development** deployment remains in `/opt/sinegasi`. Its legacy
automatic migration behavior is not the production database procedure; do not
assume a `074` baseline proves that an existing schema is complete.

If Caddy is stopped or missing, the deploy fails closed. Restore it separately
without orphan cleanup:

```bash
docker compose -f docker-compose.caddy.yml up -d caddy
```

## Isolated production releases — gated, not yet live

`main` is the reviewed production release source. `develop` is a development
branch, **not** a production backup. Production rollback uses the previous
approved image **digest and deployment package**, with independently tested
database compatibility/backups.

Production must never switch the shared dev checkout to `main`, build on the
VPS, run SQL as part of container startup, or restart Caddy. The new production
workflow is manual (`workflow_dispatch`) and requires the `production`
environment plus `PRODUCTION_DEPLOYMENT_READY=true`. Configure required
reviewers and main-only deployment restrictions where supported by your GitHub
plan; a variable alone is not evidence that readiness checks passed.

The approved operator must provision this layout separately, owned by `ubuntu`
with directory mode `0700` and sensitive file mode `0600`:

```text
/opt/sinegasi-prod/
├── incoming/                         # checksummed CI deployment package
├── releases/<full-commit-sha>/        # new directory; never overwrite
│   ├── docker-compose.prod.yml
│   └── ops/                          # wrapper, release helper, preflight
├── config/
│   ├── backend.env                   # production secrets, not dev credentials
│   └── approvals/<full-sha>.txt       # reviewed non-secret release evidence
└── state/current-release.txt         # atomic SHA/digest/manifest metadata
```

The workflow builds/tests on GitHub's runner, publishes an amd64 GHCR image,
then displays its immutable `ghcr.io/...@sha256:...` digest. Before approving
the deployment job, the operator must independently review that digest, the
applied migration manifest, backup/restore and staging evidence; install this
private approval file through the verified admin path:

```text
release_sha=<40-lowercase-hex-main-commit>
api_image=ghcr.io/<owner>/<repository>/api@sha256:<64-lowercase-hex>
migration_manifest_sha256=<64-lowercase-hex-approved-canonical-manifest-fingerprint>
project_ref=pvbdiftvzoeelibxlxzb
trust_proxy_hops=<0-through-4-from-verified-proxy-topology>
database_rollback_compatible=true
backup_reference=<private-evidence-reference-without-secrets>
rehearsal_reference=<private-evidence-reference-without-secrets>
approved_by=<approved-operator-identifier>
```

These references attest to separately reviewed evidence; the release script
cannot prove that a backup restored successfully or that the production schema
matches the manifest. Do not insert fictitious references or set the readiness
variable to bypass those gates. No approval file is generated automatically.
The manifest fingerprint uses SHA256 of `JSON.stringify(JSON.parse(file))`,
matching the production migration runner, not a raw file-byte checksum. The
workflow validates a separately approved manifest from the non-secret repository
variable `PRODUCTION_MIGRATION_MANIFEST`, exact release SHA, inventory and SQL
checksums offline before publishing. Create that approval artifact only after
the release commit exists; committing a manifest that embeds its own commit
SHA would create a circular hash dependency. Keep its private evidence outside
the variable; use references, never secrets or database credentials.
`ops/production-migrations.manifest.json` is only the draft source inventory,
not an approval artifact. Its current blocked SQL must first be reconciled and
rehearsed; changing the status/decision fields cannot make it executable.

Required before remote execution:

- Verified private SSH/rescue access with pinned ED25519 host key, production
  environment reviewers and scoped credentials; do not close the working admin
  path or change firewall rules in this workflow.
- Private GHCR pull authentication on the VPS (read-packages only), Docker
  Compose, `curl`, `flock`, GNU core utilities (`timeout` included), existing `caddy_net`, and running
  dev/Caddy containers. Never put the registry token into the release package.
- Separate runtime secrets for production Supabase/R2/JWT. Keep migration admin
  credentials out of runtime config. Do not print/source the runtime env file
  or dump `docker compose config`; validation uses `config --quiet`.
- Actual Docker/Compose image and rollback rehearsal on an isolated host before
  launch. Local mocked tests do not substitute for this environment check.
- The shared `/tmp/sinegasi-vps-deploy.lock` must already be a regular,
  non-symlink file owned by `ubuntu` with mode `0600`; provision/verify it through
  the approved admin path while no deployment is running. Production opens it
  read-only and never truncates it. Keep dev/manual deploys on this same inode.

After the approved package is installed, the host-specific entry point accepts
only an immutable release directory on `ubuntu@VM-11-154-ubuntu`:

```bash
cd /opt/sinegasi-prod/releases/<approved-full-commit-sha>
bash ./ops/deploy-prod.sh <approved-full-commit-sha> <approved-ghcr-digest> <approved-manifest-sha256>
```

The script checks ownership/permissions and approval binding, takes the same
VPS lock as dev, pre-pulls the previous/new digests, checks OCI revision labels,
and imports only the image's runtime config in a one-off container (no DB calls
or workers). Both image preflights must pass before it recreates **only**
`api-prod` on `127.0.0.1:3002`, with workers/NTFY/dev-auth disabled, exact production
Supabase URL/CORS origin, and explicitly approved proxy hops. The existing dev
and Caddy container IDs/running state must remain unchanged.

Health is bounded to at most 30 checks (each Docker health inspection and HTTP
check ≤3 seconds, with ≤2
seconds between attempts). A failed start/health check restores the previous
approved package/digest and checks it again; release metadata is not advanced.
If this is the first deployment, there is no previous release: only the failed
production API is stopped. Reconcile that stopped untracked container manually
before retrying; it is not removed automatically. A failed rollback reports a
private rescue requirement without printing runtime logs/secrets.

This is a single-container cutover, **not zero-downtime**, and does not restore
database changes. The `/api/health` response and Docker health status prove only
process health; auth, database/RPC grants, uploads and product flows still need
the runbook's independent smoke/pilot checks. Keep background jobs disabled
until billing/overdue idempotency and singleton behavior are separately tested.

Finally configure the reviewed Cloudflare Tunnel API route and Pages custom
domain; this package creates no DNS records, Tunnel, public Caddy label, Pages
deployment or firewall rules. Frontend production must use
`https://api.sinegasi.pictures/api`, not DuckDNS or a Supabase project URL.

Local safety checks (no VPS/database credentials or real containers required):

```bash
bash -n ops/deploy-prod.sh ops/production-release.sh
node --test ops/production-release.test.mjs
node scripts/verify-guardrails.mjs
```

## Migration and initial Guru checkpoint

The new schema-only reconciliation candidate and exact Mac operator commands
are documented in [production reconciliation](production-reconciliation.md).
It is rehearsal-only and does not approve/unblock the historical manifest.

The budget path uses disposable PostgreSQL/PostgREST/API containers on the
existing VPS, not a third Supabase project. The 21-flow
[API receipt](production-api.rehearsal.json) passed and cleanup was verified;
it is not full managed-Supabase/UI acceptance. A new **read-only**, exact-target
preflight is available on the Mac; it has no apply/reset mode:

```bash
npm --prefix backend run db:reconciliation:preflight:plan
npm --prefix backend run db:reconciliation:preflight
```

The second command may request Keychain Allow; it never prints credentials or
loads `.env`. A successful report does not authorize production writes. See
[current checkpoint and remaining gates](production-reconciliation.md#checkpoint-berikut--preflight-production-baca-saja).

A separate [reconciliation write runner](#production-reconciliation-writer)
now has an offline review plan, read-only catalog inspection and an explicitly
approved apply path. It is **not approved or executed on production**. Exact Mac
commands, private review/recovery evidence, fresh-backup/CI/window gates, enum
partial-commit handling and isolated test limits are documented there. It does
not unblock the old manifest or deployment workflow.

```bash
npm --prefix backend run db:reconciliation:writer:plan
npm --prefix backend run db:reconciliation:writer:rehearse
```

Read [production preparation and migration review](production-migration-review.md)
before using the production runners. The current 90-file manifest is draft and
cannot be applied safely to either a fresh database or the observed legacy
production schema. Production has no approved bootstrap/migration package yet.

Safe offline commands (no runtime env loading or database writes):

```bash
npm --prefix backend run db:production:plan
npm --prefix backend run db:bootstrap:teacher -- --project-ref pvbdiftvzoeelibxlxzb --username admin --name Admin
```

Real runner mechanics were tested with `ops/rehearse-migration-runner-vps.sh`
in an isolated, resource-limited disposable PostgreSQL 17.11 on the existing
VPS. It accepts only that exact host/user and a newly provisioned private
compiled-script bundle. It creates no app DB/service, publishes no port, reads
no application environment file, preserves dev/Caddy, and removes only its own
labelled containers. This is a synthetic runner check, not an approved SQL
package rehearsal or backup/restore drill; do not generalize its result.

## Encrypted production backup (Mac operator only)

The backup command never loads application env files. It reads the approved
admin URL from the local login Keychain, validates the exact production session
pooler, pins the supplied Supabase Root 2021 CA, and uses a read-only exported
snapshot. PostgreSQL 17.11 `pg_dump` streams a custom archive directly into
`age` 1.3.2 encryption. The password is delivered to the detached client's
password prompt over stdin, not a URL/argument, environment variable or file.
No unencrypted archive is written on the Mac.

The separate age identity is stored as a generic password in login Keychain:
service `sinegasi-prod-backup-age-identity`, account `pvbdiftvzoeelibxlxzb`.
Its trust list is empty: choose **Allow** when required, not unrestricted app
access. It is never printed or written as a plaintext key file. Backup output
is outside Git at `~/Library/Application Support/Sinegasi/Backups/<backup-id>`;
owned directories are `0700`, files `0600`, and existing files are not replaced.
An incomplete run without a receipt is not a verified backup.

Run from the Mac with the reviewed CA at
`/Users/memberid/Downloads/prod-ca-2021.crt`, client tools already installed,
and the Keychain item `sinegasi-prod-postgres-admin-url` (account `postgres`):

```bash
npm --prefix backend run db:production:backup -- create
cd backend
npx tsc
npm run db:rehearse:backup -- <exact-backup-id>
```

The restore drill checks encrypted hashes and authenticated decryption, then
restores **only `public` application objects/data/ACLs** on an isolated cached
PostgreSQL 17.11 container on the approved VPS. Managed-role names are fixtures
with NOLOGIN, never live credentials; needed bundled extensions are prepared
separately. The container has no network, ports or persistent data volumes;
data/archive live in tmpfs with cgroup swap disabled. A fresh verification
client uses image contents only, not dev environment/mounts. Catalog/data/RLS
checks compare against metadata from the same source snapshot. Cleanup removes
only labelled disposable containers and the exact temporary verification
bundle; dev/Caddy IDs and running state must remain unchanged.

The full logical archive is retained encrypted. This drill is **not** a restore
of all Supabase-managed Auth/Storage/Vault schemas, platform secrets/settings,
cluster role passwords, R2/storage file bytes, or a rehearsal of the SQL
migration package. It does not prove API authorization or future rollback
compatibility. Keep those gates separate. Off-device backup and independent
recovery-key custody/retention must be chosen and verified before go-live;
a single Mac plus its login Keychain is not disaster recovery.

### Private encrypted copy on the application VPS

After a verified public restore drill, the Mac operator may copy **only**
`database.dump.age`, `metadata.json.age`, and the two non-secret backup/restore
receipts to the approved VPS. No database connection or Keychain access is used.

```bash
npm --prefix backend run db:backup:copy-vps -- <exact-backup-id>
```

The receiver validates the pinned SSH target, root-owned parents, exact ID and
file allowlist. It creates `/opt/sinegasi-backups/production/<backup-id>` with
`0700` directories and exclusive `0600` files owned by root, fsyncs each upload,
then checks file size, SHA256 read-back and unchanged dev/Caddy container IDs,
start times and restart counts. A separate `vps-copy-verification.json` is
saved privately on both machines; initial receipts are not rewritten. The
command never overwrites or deletes an existing backup.

If initialization was interrupted, inspect the exact destination first.
`--resume-empty` is allowed only for a verified **entirely empty** private
destination; it refuses any existing file. A partial transfer without the final
verification record is not a verified copy and needs scoped investigation.

This is an off-Mac ciphertext copy, **not** a new running PostgreSQL database,
scheduled backup, full managed-Supabase restore proof, or approval to migrate.
The age private key and admin URL remain in Mac Keychain. Export independent
recovery-key custody through an approved private channel before launch; losing
the Mac/Keychain otherwise makes the ciphertext unusable. The same VPS also
hosts the application: root/Docker-level compromise or host loss can damage
this copy. Keep a further independent recovery copy, establish RPO/RTO and
retention, and rehearse recovery; root-only permissions are not immutability.

## Production reconciliation writer

Scope: reconcile the **empty 17-table public application schema** to the reviewed
73-table snapshot and insert **213 canonical configuration rows**, including
Rp5.000 cash settings with `skip_week=true`. No DEV rows, accounts, passwords,
historical receipts, deployment, DNS changes or scheduled billing are copied.

This is a separate runner, not `db push`, SQL Editor paste, the historical
90-file manifest, or the rehearsal runner with a removed guard. Production SQL
is generated in memory from the reviewed snapshot. The two rehearsal SQL files
and their original database-name guard are unchanged.

### Operator location and commands

All commands below use **Terminal Mac Lokal** (`DhanisAlghifari`), not the VPS
terminal (`ubuntu@VM-11-154-ubuntu`). Do not edit or source `backend/.env`.

Offline review only, safe on the current `develop` checkout:

```bash
cd /Users/memberid/Documents/cms-sinegasi-picture/backend
npm run db:reconciliation:writer:plan
```

Re-run the isolated regression suite only when writer code changes:

```bash
cd /Users/memberid/Documents/cms-sinegasi-picture/backend
npm run db:reconciliation:writer:rehearse
```

The latter compiles locally, verifies every uploaded artifact hash, runs the
same writer core against PostgreSQL 17 in a **new labelled, network-none,
memory-limited container** on the existing VPS, then removes that container.
It publishes no ports, reads no production secret/backup, and verifies existing
DEV/Caddy container IDs/running state. Test approvals/backups are synthetic
fixtures and are explicitly rejected by the production CLI. Reports are
timestamped, exclusive files; failed tests never issue a pass report.

At a later, approved migration checkpoint, observe the **current** production
catalog without writes:

```bash
cd /Users/memberid/Documents/cms-sinegasi-picture/backend
npm run db:reconciliation:writer:inspect
```

`inspect` uses the existing Keychain item and pinned Supabase CA, Session pooler
5432, TLS/hostname verification and a READ ONLY repeatable-read transaction.
Allow only the requested Keychain dialog. It prints counts and hashes, never
credentials or catalog bodies. This new hash includes public ACL/options,
default privileges and memberships; **do not substitute the older preflight
inventory hash** for `baselineCatalogSha256`.

### Gates before any production write

1. Review the new code and isolated report; commit/push to `develop`, check CI.
   **Do not merge to `main` yet if Pages production builds are not held.** Main
   promotion, Pages build controls and the migration window need a coordinated
   review so the frontend cannot go live before its database/API.
2. Bind a reviewed, clean `main` checkout to the actual remote `main` SHA.
   `apply` checks this with Git, then fetches the named GitHub **Code Quality**
   push run and requires successful backend/frontend jobs for that exact SHA.
   A DEV run, PR run, old SHA or checkbox alone does not pass this gate.
3. Create a **new** encrypted production backup, rehearse public restore, and
   copy/verify ciphertext on the VPS using the existing automation. Its ID must
   be at most **2 hours old at every phase/commit**. The historical backup from
   10 October is not a live-apply authorization.
4. Keep an independently recoverable decryption-key copy **outside both the Mac
   and application VPS**, and test recovery there. An encrypted dump on the VPS
   without its independent recovery key is not sufficient. The key itself must
   not be put into JSON, chat, Git, application environment or the VPS.
5. Use `inspect` to bind a fresh full public catalog/ACL hash. The writer decrypts
   only backup metadata in memory and requires its entire public inventory to
   match the current empty baseline. Local ciphertext/receipts are rehashed and
   root-owned 0600 remote ciphertext is read-checked again before admin access.
6. A human supplies private `approval.json` and `recovery.json`, mode **0600**, in
   `/Users/memberid/Library/Application Support/Sinegasi/Reconciliation` (0700).
   Both are evidence/configuration, **not secrets**. Approval SHA256 must be
   confirmed independently; the runner never creates an approved document.

`approval.json` is the `WriterApproval` interface in
`backend/src/scripts/reconciliationWriterPolicy.ts`. Required bindings:

- `format:1`, production project, `approved:true`, reviewer, 40-hex `releaseSha`;
- `packageSha256` from `plan`, selected timestamped `writerEvidenceFile`, its
  raw-file `evidenceSha256`; evidence must also match current writer source and
  all four previous rehearsal receipts;
- fresh `baselineCatalogSha256`, exact `backupId`, encrypted archive/metadata
  checksums, raw `recoveryEvidenceSha256`;
- `qualityRunId` plus quality/maintenance acknowledgements;
- ISO timestamps `windowStart`/`windowEnd`, active window of at most **1 hour**;
- explicit acknowledgements for non-atomic enum commits, shared VPS recovery
  risk, and still-required managed acceptance.

`recovery.json` contains `receipt`, `restore`, `copy`: the exact parsed contents
of that backup's existing `receipt.json`, `public-restore-verification.json`,
`vps-copy-verification.json`. It also contains `independentKeyRecovery` with
`verified:true`, `sameDeviceAsMac:false`, `sameHostAsApplication:false`, `medium`,
`verifiedBy`, `verifiedAt`. This last section is a **human recovery-test
attestation**, not a programmatic inspection of an offline key. Never set it
true merely to bypass a gate.

Only after those checks and explicit approval, the Mac command is:

```bash
cd /Users/memberid/Documents/cms-sinegasi-picture/backend
npm run db:reconciliation:writer -- apply \
  --approval '/Users/memberid/Library/Application Support/Sinegasi/Reconciliation/approval.json' \
  --confirm-approval THE_INDEPENDENTLY_REVIEWED_APPROVAL_SHA256
```

The last token is intentionally invalid until an actual 64-hex approved digest
exists. **This command has not been executed on production.** No `--force`,
arbitrary database URL, alternate project, `reset`, environment selection or
rehearsal-to-production bypass is supported.

### Transaction, retry and failure contract

- One connected Session pooler client and a session advisory lock across both
  transactions. Database `postgres`, actor `postgres`, PG17 and backend PID are
  checked; all existing public tables are locked with bounded wait times.
- **Transaction 1:** verify empty exact baseline/backup and approval hashes,
  create private journal, reconcile enums, commit enum checkpoint.
- **Transaction 2:** recheck the checkpoint, reconcile schema/permissions and
  insert canonical config, verify exact tables/columns/constraints/indexes/
  enums/views/triggers/policies/function definitions/body/config, reference
  values, RLS and browser/private access; commit final journal with target hash.
- Schema/config and their final checkpoint roll back together. PostgreSQL
  requires newly added enum values to be committed before using them, so the
  whole package is **not one atomic transaction**. No automatic enum removal,
  downgrade, reset or database restore is attempted.
- Retry accepts the **same** package, release, approval and recovery binding,
  within the original window. An enum checkpoint can resume only with exact
  catalog parity; a completed run becomes a verified read-only no-op. Changed
  config/catalog/history or later business/accounts are refused, not overwritten.
- Lost COMMIT acknowledgement or failed rollback reports `mutation:"unknown"`;
  inspect the private checkpoint before deciding whether to resume. Lock-release
  uncertainty is also an error, not silently ignored. Never blindly retry after
  an expired window, network failure or partial commit; a changed approval is
  deliberately refused and requires a separately reviewed recovery procedure.

Private journal: `sinegasi_ops.production_reconciliation_runs`. It does not forge
Supabase CLI or historical migration receipts, and browser/service roles cannot
access it. `PUBLIC`/browser table and RPC access remains denied; custom JWT
authorization belongs to Fastify, not direct browser database roles.

### Evidence and limits

Latest passing report:
[11 October 2026, 15:31 WIB](production-reconciliation.writer-rehearsal.2026-10-11T08-31-57-655Z.json).
All 14 isolated PostgreSQL checks passed and cleanup was verified. Its source
digest was rechecked against the final runner code. Backend quality: 453 tests,
452 passed, 1 local-PostgreSQL test skipped, 0 failed; typecheck/build and OpenAPI
parity for 159 operations passed. These are local/rehearsal results, not a new
successful GitHub run or permission to apply. Earlier timestamped reports are
historical; only the report matching the reviewed source may be selected.

The timestamped writer rehearsal report proves the actual writer on a
**synthetic legacy baseline** in disposable PostgreSQL, including 14 positive/
negative checks, table-lock timeout, both commit-response-loss cases, real DDL/
reference rollback, resume and no-op. The earlier separate reconciliation report
proves snapshot reconciliation against the restored historical public backup.
The writer regression itself is **not a new live-backup restore test**.

Local quality checks, isolated DB tests and successful CI reduce risk; they are
not a promise of zero bugs or a managed-Supabase acceptance test. Managed
schemas/provider configuration, production PostgREST behavior, media, UI and
recovery acceptance still need separate verification. Successful writer output
always has `readyForPublicLaunch:false`, and does not create the first `admin`
teacher account or enable background jobs.

The old production deployment workflow still requires an approved historical
manifest, which remains draft/blocked. This writer does **not** mark it approved
or open that deployment gate. Account bootstrap and release/deployment gate
integration must be reviewed next; do not run the old apply/bootstrap pipeline
as a shortcut.

Threat boundaries: reviewed Git source/artifacts and private operator evidence
→ TLS-protected admin connection → privileged DDL/config/journal. Controls bind
target/release/checksums, bound resources/locks/windows, deny incomplete recovery
proof and sanitize failures. A local administrator can manufacture JSON or
alter reviewed code; these are operator review controls, not cryptographic
multi-party authorization or protection against a compromised administrator.

References: [PostgreSQL enum transaction rule](https://www.postgresql.org/docs/17/sql-altertype.html),
[session advisory locks](https://www.postgresql.org/docs/17/explicit-locking.html#ADVISORY-LOCKS),
[Supabase migration deployment](https://supabase.com/docs/guides/deployment/database-migrations).
