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

### Recovering the committed enum checkpoint (runner repair, not yet authorized)

The 11 October production attempt stopped at `TARGET_BROWSER_ACCESS_EXPOSED`:
the enum/private journal transaction committed, but schema/reference data rolled
back. Do **not** reset production, replay DEV data, change the old approval, or
reuse its checksum to authorize repaired code. The SQL package is unchanged;
the runner source and its rehearsal evidence changed and need fresh release CI.

The repaired verifier permits only the 31 native, SECURITY INVOKER functions of
`public.pg_trgm` 1.6 owned by `supabase_admin`, which `postgres` cannot revoke.
Their exact signatures, native entry points, execution attributes, owner and ACL
are reviewed through `managedExtensionSha256` and must remain unchanged. This
is **not** a blanket extension-member exclusion. Unknown members, SECURITY
DEFINER/SQL replacements and browser-accessible application RPCs still fail.
Existing browser EXECUTE on these native functions is preserved, not granted;
the `extension_in_public` advisory remains a documented platform risk. Application
tables/views/RPCs stay inaccessible to `anon` and `authenticated`.

The migration skill's checkpoint/backup gates are enforced by a distinct
`resume` command. Use **Terminal Mac Lokal**, not Supabase SQL Editor, Cloudflare,
or SSH into the VPS. Safe diagnostic commands now available:

```bash
cd /Users/memberid/Documents/cms-sinegasi-picture/backend
ENV_FILE_LOADING=disabled npm run db:reconciliation:writer:plan
ENV_FILE_LOADING=disabled npm run db:reconciliation:writer:inspect
```

`inspect` is READ ONLY and additionally prints the exact journal bindings,
`managedExtensionSha256` and the native extension function count. It does not
grant approval, alter extension ACLs, create accounts or run migrations.

Before resuming, in this exact order:

1. Review/commit/promote the repaired source to clean current `main` and require
   successful backend/frontend Code Quality **push** jobs for that exact SHA.
   An old passing CI run and old writer receipt cannot authorize the repair.
2. Create a **new backup of the current enum checkpoint**, verify public restore,
   copy/check ciphertext on the VPS, and review new `recovery.json`. Do not
   overwrite historical approvals/recovery evidence or transfer the Keychain key.
3. Run READ ONLY `inspect`; require one journal row at `enums`, 17 empty public
   application tables, and matching checkpoint/full backup inventory. Mac-only
   recovery also requires empty Auth/Storage under pre-snapshot table locks.
4. Review a new private timestamped approval, a new <=1-hour window and a new
   explicitly confirmed raw-file checksum. Keep all normal `WriterApproval`
   fields and `managedExtensionSha256`. Add `resumeFrom` with:
   `approvalFile`, `approvalSha256`, `releaseSha`, `backupInventorySha256`,
   `enumsCatalogSha256` from the **original** enum journal. The old approval file
   must exist unchanged in the same 0700 Mac review directory, mode 0600.
5. The new `baselineCatalogSha256` must equal that original enum checkpoint;
   current backup inventory must match it, while the original backup inventory
   binding remains immutable. Package/schema/reference-data checksum changes,
   missing journal, drift, changed old document, or reused backup ID refuse resume.
6. Only after the operator approves the new checksum, run
   `npm run db:reconciliation:writer -- resume --approval <absolute-new-file> --confirm-approval <new-sha256>`.
   These placeholders are **not executable instructions**; the operator is given
   an exact concrete command when the newly reviewed files exist.

Resume does not rerun enum SQL. Schema plus the 213 canonical configuration rows
and completion receipt commit together. The original journal's package, approval,
release, backup inventory, enum hash and `applied_at` stay unchanged; a separate
`completion_authorization` JSONB column records the new approval/release/backup
bindings. Rollback retains the original enum row and does not leave the new
column behind. A repeated exact completion authorization verifies a no-op;
lost COMMIT response is `unknown`, requiring inspection before any retry.

This procedure does not authorize production writes now. Managed Supabase
acceptance, independent key recovery, scheduled backups and go-live remain
separate gates. Isolated PostgreSQL role/ACL simulation is not full managed
Supabase integration or a zero-bug guarantee.

Actual repaired-runner evidence:
`production-reconciliation.writer-rehearsal.2026-10-11T13-10-15-346Z.json`:
**27 checks passed**, PostgreSQL 17.11, isolated 73 tables/213 configuration rows,
cleanup verified and DEV/Caddy unchanged. Source SHA256:
`e7a2867a780a18fa3ba9254635594ad8efa6abd071e4f612daa565132a62b08a`.
The evidence now binds the runtime, fixture, PostgreSQL verifier and disposable
test harness source, not just runtime files. The SQL package remains
`919dd3aa2a1ea18726216cbad5986d2e9d9e6ffca09d97821338c8d3212b5b65`.
Do not reinterpret this receipt as production approval or managed integration.

ACL comparison expands PostgreSQL's NULL default ACL via `acldefault` and
`aclexplode`, binding every grantor/grantee/privilege/grant option. A no-op REVOKE
can materialize an equivalent explicit ACL; this representation change is not
an effective permission change. Function attributes and effective grants remain
reviewed and invariant. See [PostgreSQL REVOKE](https://www.postgresql.org/docs/17/sql-revoke.html)
and [extension membership dependencies](https://www.postgresql.org/docs/17/catalog-pg-depend.html).

### Original apply gates (still enforced for resume)

1. Review the new code and isolated report; commit/push to `develop`, check CI.
   If an application-production Pages project tracks `main`, hold its automatic
   production builds before promotion so the frontend cannot go live before its
   database/API. Do not disable or retarget the existing DEV Pages project that
   tracks `develop`. If no application-production Pages project exists, there
   is no such production build to hold; verify that condition rather than
   treating the DEV project's primary deployment label as application production.
2. Bind a reviewed, clean `main` checkout to the actual remote `main` SHA.
   `apply` checks this with Git, then fetches the named GitHub **Code Quality**
   push run and requires successful backend/frontend jobs for that exact SHA.
   A DEV run, PR run, old SHA or checkbox alone does not pass this gate.
   The GitHub lookup uses `/opt/homebrew/bin/gh` with only fixed `github.com`
   **GET** endpoints for the numeric run ID and its jobs in this repository.
   The remote `main` check first requires the exact credential-free HTTPS
   `origin` for this repository, then uses a separate `readGithubMainSha()`
   helper. It runs `/usr/bin/git ls-remote` against only that fixed URL/ref,
   outside the checkout, with system/global Git config disabled, TLS verification
   enabled, redirects/interactive prompts disabled and an invocation-only
   `/opt/homebrew/bin/gh auth git-credential` helper. No user Git config is changed;
   no push, fetch, token output or database command is performed. The result must
   be exactly one 40-hex SHA for `refs/heads/main`, equal to local clean `main`.
   Its 30-second/1-KiB bound and sanitized `GITHUB_MAIN_METADATA_UNAVAILABLE`
   failure are enforced before approval or database access.
   Only these two helpers receive the trusted Mac home/config/state paths to find
   the operator's existing GitHub login; backup/Keychain subprocesses retain
   their original `PATH`/`LANG` environment. Parent tokens, debug flags, proxy
   settings and config overrides are not inherited. Each CI lookup is capped at
   30 seconds/1 MiB; failures or malformed JSON stop before database access,
   with no raw CLI diagnostics. Do not add tokens to `.env` or Git as a fix.
3. Create a **new** encrypted production backup, rehearse public restore, and
   copy/verify ciphertext on the VPS using the existing automation. Its ID must
   be at most **2 hours old at every phase/commit**. The historical backup from
   10 October is not a live-apply authorization.
4. Default recovery mode: keep an independently recoverable decryption-key copy
   **outside both the Mac and application VPS**, and test recovery there.
   For the explicitly accepted, **initial empty production migration only**, the
   operator may instead select `mac-only-initialization` as documented below.
   Ciphertext on the VPS is not independently recoverable if the only key is
   lost with the Mac. The key itself must not be put into JSON, chat, Git,
   application environment or the VPS; this exception does not authorize launch.
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

### Budget-constrained initial migration: Mac-only key

The operator elected to keep the key in Mac login Keychain for now. This is an
explicit recovery-risk exception, **not** a verified independent key copy and
not a `--force` option. It adds these fields to the otherwise fully reviewed
`approval.json`:

```json
{
  "recoveryMode": "mac-only-initialization",
  "macOnlyRecoveryRiskAcknowledged": true,
  "initialEmptyProductionOnly": true
}
```

These are **additional fields**, not a complete approval. Keep all release,
CI, backup, evidence, checksum, reviewer and window bindings listed above.
The matching `recovery.json` retains the actual backup/restore/VPS-copy receipts
and records the unavailable independent copy honestly:

```json
{
  "independentKeyRecovery": {
    "verified": false,
    "sameDeviceAsMac": true,
    "sameHostAsApplication": false,
    "medium": "macOS login Keychain only"
  }
}
```

The runner still requires a fresh encrypted backup (at most two hours old),
successful public restore, hash-verified root-only VPS ciphertext, working Mac
Keychain decryption, exact clean remote `main` and its successful quality run,
source-matching isolated evidence, and a human-reviewed approval/window. It
requires the exact empty legacy public baseline and additionally **reads/locks**
`auth.users` and `storage.objects` in each transaction, refusing any accounts or
stored objects, including ones that appear between enum/schema commits. Managed
tables and initial public tables are locked before the first SELECT so that
repeatable-read does not hide a concurrent write committed before lock acquisition;
see [PostgreSQL LOCK](https://www.postgresql.org/docs/17/sql-lock.html).
It does
not delete accounts/files or modify managed Supabase schemas. If managed-table
permissions or checks fail, it stops; do not remove the check.

Loss of the Mac/Keychain means the VPS encrypted backup cannot be decrypted.
The exception is only for initializing this reviewed empty project; it must
not be reused for migrations of a populated system. Successful output keeps
`independentKeyRecoveryAttested:false` and `readyForPublicLaunch:false`.
An independent recovery route and managed acceptance remain pre-launch work.

### Approved apply

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
[11 October 2026, 17:35 WIB](production-reconciliation.writer-rehearsal.2026-10-11T10-35-27-537Z.json).
All 16 isolated PostgreSQL checks passed and cleanup was verified. Its source
digest was rechecked against the GitHub-auth fix. Backend quality: 459 tests,
458 passed, 1 local-PostgreSQL test skipped, 0 failed; typecheck/build and OpenAPI
parity for 159 operations passed. These are local/rehearsal results, not a new
successful GitHub run or permission to apply. Earlier timestamped reports are
historical; only the report matching the reviewed source may be selected.

The timestamped writer rehearsal report proves the actual writer on a
**synthetic legacy baseline** in disposable PostgreSQL, including 16 positive/
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

### Managed production read-only integration (Mac)

The initial schema/configuration migration and its final catalog checks are
separate from application integration. Run this test only while production has
the initial 213 canonical configuration rows and no business/account data. It
refuses count/configuration drift; it never resets a populated project.

1. Open [production API Keys](https://supabase.com/dashboard/project/pvbdiftvzoeelibxlxzb/settings/api-keys).
   Use an **existing** backend secret key (`sb_secret_...`) or legacy
   `service_role` key. Do not rotate/generate signing keys, disable Data API,
   paste credentials in chat, or edit DEV `.env`.
2. In **Keychain Access → login**, create generic password items with the
   exact names below. Set **Account** to `pvbdiftvzoeelibxlxzb` for both:
   - `sinegasi-prod-supabase-service-role-key`: the backend secret/service-role key.
   - `sinegasi-prod-supabase-publishable-key`: the existing publishable/anon key.
   These are API keys, not the PostgreSQL admin URL or age backup identity.
   Do not use the separate Passwords app as a substitute for these CLI items.
3. In **Terminal Mac Lokal**, run these actual commands:

   ```bash
   cd /Users/memberid/Documents/cms-sinegasi-picture/backend
   npm run typecheck
   ENV_FILE_LOADING=disabled node --import tsx --test src/scripts/productionManagedIntegration.test.ts
   ENV_FILE_LOADING=disabled npm run db:production:integration:plan
   ENV_FILE_LOADING=disabled npm run db:production:integration -- check --confirm-project pvbdiftvzoeelibxlxzb
   ```

   Choose **Allow** for the requested API-key Keychain dialogs. No secrets enter
   process arguments, repository files, or test output. A missing/denied item
   stops the test with a sanitized stage; fix that item rather than retrying SQL.
4. Require `MANAGED_SUPABASE_READ_ONLY_INTEGRATION_PASSED`, not simply exit 0.
   The receipt names the tested release and runner digest and explicitly reports
   a dirty local tree. A local runner result is not CI/release promotion.

Enforced transport allows only bounded GET/HEAD requests to the exact production
Data API, reviewed relations, and three read-only GET RPCs. Redirects, other
projects/schemas, Auth/Storage, write methods and all other RPCs are blocked
before network access. TLS verification remains enabled; no server port or
workers are started. Checks cover reads/counts of 68 application tables and two
views, exact canonical rows, three GET RPC contracts, anonymous relation/RPC
permission errors, unchanged application row counts, actual Fastify
liveness/security headers and two real application read adapters. The five
private migration journals (`schema_migrations` and the agenda/borrowing/cash/
contest migration histories) must return HTTP 401/403 with SQLSTATE `42501` for
both service and anonymous keys. A readable journal, invalid key, missing
relation or gateway failure does not pass this check. No database grants or
migration artifacts are changed to satisfy the test. It creates no account,
JWT impersonation, transaction or test data.

**Important:** even ordinary application GET requests persist rate-limit
counters through `consume_api_rate_limit_atomic`. Therefore this read-only
runner does not call authenticated API routes or login, replace the shared
rate limiter with a mock, or claim full managed acceptance. Login/password
rotation/revocation, per-role API authorization, mutating RPCs, uploads/media,
authenticated Supabase HTTP role, UI and deployment remain separate gates.
Those tests need scoped account/data/counter-write approval and recovery review.

Actual read-only run: [11 October 2026, 23:13 WIB](production-managed-integration.read-only.2026-10-11T16-13-51-803Z.json).
All nine checks passed with 232 GET/HEAD requests and no blocked mutation attempt.
The receipt binds runner source SHA256
`f463e7949a4f1b3037f0b54d1d2879179a08743cfcc14e77e59643b512114640`
and honestly records a dirty local checkout: this is not evidence of a pushed
release, authenticated acceptance or readiness for public launch. Local backend
quality also passed: 479 tests passed, one explicit disposable-PostgreSQL test
skipped, TypeScript/build passed and OpenAPI parity covered 159 operations.

Dependency review (11 October 2026): backend `npm audit --json` reported zero
findings. Frontend audit reported seven high findings in the existing
`shadcn → fast-glob/micromatch → braces` toolchain, including
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
Repository usage of `shadcn` is its static `tailwind.css` import, not its Node
CLI/glob API; no exposed application path to the vulnerable parser was found
in this scoped review. This is not a clean frontend audit or a complete
exploitability assessment. Dependency changes are deferred to a separate
review by 18 October 2026, before public launch; do not run `npm audit fix
--force` or downgrade the CLI automatically to satisfy the audit.

The old production deployment workflow still requires an approved historical
manifest, which remains draft/blocked. This writer does **not** mark it approved
or open that deployment gate. Use the separate guarded account preparation
below; release/deployment gate integration remains a later review. Do not run
the old apply/bootstrap pipeline as a shortcut.

### First-login/password-change preparation (Mac; isolated only, no deployment)

Use **Terminal Mac Lokal**, in the backend directory. No Supabase dashboard,
SSH terminal, additional staging project or paid service is needed for these
commands. They do not read the official password file, access Keychain, run
network requests, open a listening port or start background workers.

```bash
cd /Users/memberid/Documents/cms-sinegasi-picture/backend
ENV_FILE_LOADING=disabled npm run db:production:auth:plan
ENV_FILE_LOADING=disabled npm run db:production:auth:rehearse
```

Expect `PRODUCTION_AUTH_OFFLINE_PLAN`, then
`ISOLATED_AUTH_ACCEPTANCE_PASSED` with 16 checks, `productionChanged:false`,
`productionPasswordChanged:false`, `networkAccessed:false` and
`deploymentPerformed:false`. Stop on `STOP`; do not pass an approval/checksum,
production URL or credential file to these commands. Only `plan`/`rehearse`
are implemented; extra arguments, `apply` and enabled `.env` loading are denied.

Local verification on 12 October 2026: all 16 flow checks and 11 new guard
tests passed. Full backend quality passed: 504 tests passed, one existing
disposable-PostgreSQL test explicitly skipped, zero failures; typecheck/build
passed and OpenAPI parity covered 159 operations. No provider SQL test or
production password change is claimed by this local result.

The rehearsal runs the actual Fastify composition root with public-deployment
guards, production auth routes/service/SDK repositories, authoritative-session
middleware, scrypt, JWT and shared-rate-store adapters. A fresh process uses
only a random synthetic Guru and a reserved `.invalid` REST origin; every
REST request is handled by an allowlisted in-memory fixture, never forwarded.
It tests temporary login, `/me`, forced-password-change denial on the access
matrix, invalid password rejection, a simulated optimistic-version conflict,
one successful rotation, immediate old-token denial in the same process,
old-password denial, new-password login, authorized matrix read and fail-closed
identity/rate-store outages. No application auth behavior is changed.

Important limitations:

- REST counters/password updates are **emulated**. Passing proves the real
  application path against that contract, not current production SQL atomicity,
  audit-trigger redaction, RLS, cross-worker cache propagation, or provider availability.
- It does not test the browser UI, Caddy/domain/TLS path, media or full acceptance.
- Current logout acknowledges success but does **not** revoke the JWT server-side.
  The rehearsal characterizes this; only password rotation changes `auth_version`.
  Do not label logout/session-wide revocation as passed.
- Invalid-password permutations, version conflict and outage injection belong
  **only in the fixture**; do not inject faults, brute-force or reset the official account.
- These results are not a production execution approval or a successful CI run
  on a promoted release. No commit, push, merge, deployment or DNS change is implied.

Before a real managed test, prepare/test a separate approval-gated executor,
review the exact promoted main SHA/CI, obtain a **new post-bootstrap backup**
with restore and encrypted-copy evidence, and inspect a baseline that permits
the existing official account. The earlier empty-project bootstrap inspector
must not be rerun as an acceptance test or made to pass by deleting rows.
Use a new scoped checksum/window for this operation: one `admin`/`visioner`
teacher password rotation, relevant audit and rate-counter writes, no business
data, schema or permissions changes. The old bootstrap checksum authorizes none
of this. Before any real request, announce Keychain items and obtain readiness;
keep temporary/new passwords and JWTs out of chat, shell arguments, `.env`, logs
and Git. Persist the new password privately before the write and preserve the
original temporary-password file. Unknown mutation acknowledgement means stop
and inspect, not an automatic retry or resetting the password/database.

### Approval-gated first-Guru auth executor (implemented; not executed on production)

The separate `productionAuthExecutor.ts` now implements offline `plan`/
`rehearse`, a **read-only** post-bootstrap `inspect`, and a separately approved
`apply`. The earlier `productionAuthAcceptance.ts` remains offline-only.
Do not run a managed mode merely because the implementation/tests passed.

In **Terminal Mac Lokal**, the only commands needed at this implementation stage:

```bash
cd /Users/memberid/Documents/cms-sinegasi-picture/backend
ENV_FILE_LOADING=disabled npm run db:production:auth:executor:plan
ENV_FILE_LOADING=disabled npm run db:production:auth:executor:rehearse
```

Expect `PRODUCTION_AUTH_EXECUTOR_OFFLINE_PLAN`, then
`ISOLATED_AUTH_EXECUTOR_PASSED`: 11 managed-path checks, eight guard categories,
exactly one **synthetic** rotation, no Keychain/credential-file/network access,
no production password change and no deployment. A dirty-tree receipt is
diagnostic only; it cannot authorize a future managed run. The fixture emulates
REST/database state; it does not prove PostgreSQL atomicity, production audit
behavior, provider availability, browser flow or cross-worker revocation.
Twenty-three additional tests cover approval/window/evidence gates, scoped
transport, exclusive private custody, redacted audit contracts and ambiguous
outcomes. Backend quality: 530 passed, one explicitly skipped disposable-PG
test, zero failures; OpenAPI parity: 159 operations.

Custody tests resolve the OS temporary directory with `realpath(tmpdir())`
before creating an isolated 0700 directory, instead of assuming a Mac-only
`/private/tmp` path. The actual custody writer's canonical-path, ownership,
0700/0600 mode and exclusive-create checks remain unchanged.

The first Linux/Node 22 PR run exposed an empty-stdin subprocess race in the
shared private-command helper (shell quoting and offline Git metadata tests).
Commands without input now use an ignored stdin descriptor, rather than writing
an empty value to a pipe that may already be closed. Three regression tests
cover fast exits with empty strings/buffers, byte-preserving nonempty input and
sanitized rejection of a broken nonempty-input pipe. Timeout/output limits,
minimal environments and private diagnostic handling remain enforced; no
Keychain, database or production command was used to verify this correction.

Future managed sequence (requires separate permission, not run during preparation):

1. Review this patch, then authorize promotion through exact `main` push CI.
   Use a feature branch based on current `main`, then a PR into `main`; do not
   push `develop` for this Mac-only runner promotion, because the DEV backend
   workflow deploys to the VPS on matching `develop` pushes. As checked on
   12 October 2026, Pages project `sinegasi-picture-develop-cms` builds all
   preview branches, so both the feature push and main merge create DEV
   previews. Obtain explicit permission for these effects before push/merge.
   Do not dispatch the separate manual production-deployment workflow.
   Both backend/frontend jobs must pass on the promoted SHA. Re-run the exact
   executor rehearsal on that clean release; save its redacted JSON receipt
   privately as `production-auth.executor-rehearsal.<timestamp>.json` (0600).
2. Create a **new post-bootstrap** backup, rehearse its restore and verify the
   encrypted VPS copy. The pre-account backup is not enough. Prepare a fresh
   `recovery.<backup-id>.json` in the private Mac directory with existing proof
   formats and honest Mac-only-key/shared-VPS limitations.
3. Announce the **admin URL** Keychain item, get readiness, then run the new
   inspector (not the old empty-project bootstrap inspector):

   ```bash
   ENV_FILE_LOADING=disabled npm run db:production:auth:executor -- inspect --keychain-ready
   ```

   It opens a read-only PostgreSQL session, checks the completed migration,
   schema/security/configuration, exact `admin`/`visioner` teacher at version 1,
   first-login state, one original bootstrap audit and empty rate counters.
   It saves a **non-secret** private baseline receipt and prints its path.
   After any existing attempt it reports observation only; never replays.
4. Prepare/review a **new** `approval.auth.<timestamp>.json` using
   `AuthExecutorApproval` in `productionAuthExecutorCore.ts`. Bind exact source/
   package/release, main quality-run ID, baseline/evidence SHA256s, pinned
   bootstrap receipt, migration checkpoint, archive/metadata SHA256s, window
   (maximum one hour) and backup (maximum two hours old). Explicitly acknowledge
   one rotation, rate-counter/audit writes, private password custody, Mac-only
   recovery risk, same-VPS copy, no automatic retry and **no deployment**.
   Old migration/bootstrap approval checksums are refused. No approval document
   is automatically issued by the runner.
5. Get explicit checksum authorization and announce these Keychain items **before**
   execution: `sinegasi-prod-backup-age-identity`,
   `sinegasi-prod-postgres-admin-url`, `sinegasi-prod-supabase-service-role-key`.
   The API key belongs to the production backend, never the browser/DEV `.env`.
   Its dashboard location is [production API Keys](https://supabase.com/dashboard/project/pvbdiftvzoeelibxlxzb/settings/api-keys);
   backend-only handling follows [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys).
   Only after these new approvals/readiness acknowledgements, the future command is:

   ```bash
   ENV_FILE_LOADING=disabled npm run db:production:auth:executor -- apply \
     --approval '/Users/memberid/Library/Application Support/Sinegasi/Reconciliation/approval.auth.<timestamp>.json' \
     --confirm-approval <NEW_APPROVAL_SHA256> --keychain-ready --password-custody-ready
   ```

   Placeholders are not runnable authorization; no managed mode was executed
   during implementation. Before any auth/rate-counter request, the executor
   generates and fsyncs a strong new password to the account-wide one-shot
   `first-teacher.admin.auth-attempt.json` (0600 in the 0700 private directory).
   It never overwrites/deletes that file or the original temporary-password file.
   Keep the new file private: do not paste its password into chat/shell/Git.

The actual application runs only through Fastify injection on the Mac: no
listening port or workers, random ephemeral signing secret, no Supabase Auth
account, no `/auth/v1`, Storage, R2 or notification calls. A guarded transport
allows only scoped reads and five reviewed RPCs, with fixed account/origin,
hashed local rate principals, 150 total requests, bounded per-RPC calls and
one `change_password_atomic` call. Redirects, unknown schemas/methods/relations,
hash substitution, expired deadlines or unexpected responses halt the run.
Concurrent namespace reads are serialized; mutations are never retried.

The maintenance advisory lock coordinates with our migration/bootstrap runners;
it does **not** prevent an unrelated application or Dashboard user from writing.
Confirm no other production writer during the approved window. Schema/config/
account are rechecked before rotation and after the flow; mismatches stop.
The HTTP sequence is not one global transaction: earlier counter writes and
the password rotation cannot be rolled back together.

SQL currently creates **two** rotation audits: a redacted legacy-trigger row
and a canonical RPC row. The postcondition expects three total audits including
the untouched bootstrap row, verifies password version 2/new hash match/old
password denial and rejects unredacted secrets. It does not change audit SQL.
Logout still acknowledges without server-side revocation; browser/domain and
cross-worker behavior remain separate acceptance work.

Any failed/unknown write means **stop and read-only inspect**. The new password
file remains available for operator reconciliation. Do not rerun `apply`, remove
the attempt file, reset the official account, replay migrations or weaken guards
to force success. The runner blocks repeat attempts even with a new approval.
No production login, Keychain access, credential read, push or deployment was
performed while building/testing this executor.

### Guarded first-Guru preparation (Mac; no deployment)

The schema migration is already complete; **do not repeat SQL migration or
copy DEV accounts/data**. The next operation is preparing ONE official first
Guru (`teacher`) in `public.users`, not creating a Supabase Auth account.
No production account is created by installing/testing this runner.

In **Terminal Mac Lokal** (not an SSH shell, Supabase SQL Editor or Cloudflare):

```bash
cd /Users/memberid/Documents/cms-sinegasi-picture/backend
ENV_FILE_LOADING=disabled npm run db:production:bootstrap:plan
```

Require `PRODUCTION_BOOTSTRAP_OFFLINE_PLAN`, with `databaseAccessed:false`,
`productionChanged:false`, `accountCreated:false`. This command uses no
Keychain/network and does not grant approval. Its release SHA is the current
HEAD; on a dirty checkout its source digest describes uncommitted code, not a
promoted release.

Proceed in this order, stopping on any failed stage:

1. Review the patch and its isolated rehearsal receipt, then promote the exact
   code to `main` through CI. Quality must be a successful **push/main** run on
   that SHA, with both `backend-quality` and `frontend-quality` jobs passing.
   [GitHub Actions](https://github.com/dhanis-alghifari/cms-sinegasi-picture/actions)
   is the browser page for this step. No new push/merge is authorized merely by
   running `plan`. A push to `develop` can deploy DEV backend; any branch push
   can create a Cloudflare DEV preview. Review those effects before pushing.
2. Run a **NEW managed read-only integration on that exact clean main SHA**,
   after announcing the two API-key Keychain prompts. Its receipt must match
   the integration runner, schema fingerprint and canonical reference checksum,
   be less than 24 hours old, and precede the new backup. Preserve the historical
   dirty-tree receipt unchanged; it cannot authorize an account. Store the new
   original receipt (same filename and bytes) privately in
   `/Users/memberid/Library/Application Support/Sinegasi/Reconciliation`
   (directory 0700, file 0600), outside Git: move only this new, untracked
   generated receipt out of `ops/`, without replacing any historical receipt.
   Leaving it untracked makes the checkout dirty; committing it changes the
   release SHA it attests. The bootstrap runner reads it from the private path.
3. Create a **new post-migration backup** in Terminal Mac Lokal:

   ```bash
   ENV_FILE_LOADING=disabled npm run db:production:backup -- create
   ```

   Announce beforehand: this requests PostgreSQL admin and age-key Keychain
   access. Copy the exact new `id` from successful output into the documented
   restore/copy commands—never paste `ID_BACKUP_BARU` literally. Require
   `PUBLIC_APPLICATION_RESTORE_VERIFIED` and `ENCRYPTED_VPS_COPY_VERIFIED`.
   The runner requires backup age <=2 hours and exact live inventory parity;
   the earlier 17-table pre-migration backup cannot authorize a 73-table
   first-account operation. Ciphertext on the VPS is not independent key
   recovery; Mac-only custody and same-application-host risks need fresh,
   explicit acknowledgement in the account approval.
4. After readiness to see **one admin-URL** Keychain prompt, inspect only:

   ```bash
   ENV_FILE_LOADING=disabled npm run db:production:bootstrap -- inspect --keychain-ready
   ```

   Require `BOOTSTRAP_COMPLETED_MIGRATION_OBSERVED`, `productionApproved:false`
   and no account creation. This verifies the private `complete` checkpoint,
   exact schema/functions/RLS/grants and 213 canonical configuration rows.
   It is not authorization to apply. A populated/drifted project stops;
   do not empty/reset it to make the check pass.
5. Review a **new first-account approval document**, outside Git in the private
   `Sinegasi/Reconciliation` directory. The operator/assistant prepares it from
   actual CI, inspect, rehearsal, integration and recovery outputs, not
   placeholder or synthetic fixture JSON. It binds `operation:
   bootstrap_first_teacher`, the official `username`/`nama`, exclusive private
   credential-file path, current main SHA, runner digest, package/checkpoint/
   migration-completion checksums, managed-extension digest, three evidence
   checksums, backup ID/ciphertext digests, reviewer and a <=1-hour window.
   Confirm its exact SHA256 separately before applying. Previous migration
   checksums authorize neither an account nor deployment. No apply command is
   issued here before that new review/confirmation.
6. Approved apply rechecks current main/CI, local ciphertext/restore/copy
   artifacts, current remote checksum and Mac decryption-key availability.
   It then reads the admin URL (these prompts must be announced first).
   The transaction shares the migration advisory lock, locks all reviewed
   public tables and managed data counters, verifies the `complete` checkpoint
   plus backup/catalog parity, and refuses existing Auth/Storage data or users.
   Exactly one first-login-required active teacher and one redacted audit row
   are committed; no SQL package, permissions, workers or deployment change.
7. Preserve the only credential copy outside Git (directory 0700, file 0600,
   exclusive/no symlink/no overwrite). It is never printed. Lost COMMIT or
   ROLLBACK acknowledgement means **STOP and inspect**, not automatic retry,
   deletion of credentials, manual INSERT, or resetting the database. Success
   still has `readyForPublicLaunch:false`. Login/password rotation/revocation
   and real API mutations require separate scoped write approval; deployment
   still remains blocked by its old manifest gate.

The old `bootstrapTeacher.ts --apply` now permits **isolated loopback only**
(`--local` still rejects remote URLs); it cannot bypass this production review.
Unit tests exercise approval/checksum/clock/evidence/CLI refusal. The command
below runs real PostgreSQL in the already approved labelled disposable VPS
container, network-none/limited resources/no published port, using synthetic
test authorization only; it does not read production credentials or backups:

```bash
ENV_FILE_LOADING=disabled npm run db:production:bootstrap:rehearse
```

Require `BOOTSTRAP_GUARD_ISOLATED_PASSED` **and** verified container/bundle
cleanup with DEV/Caddy unchanged. It also runs the writer's existing migration/
resume regression checks before account-guard tests. Synthetic evidence is
test input, not managed acceptance or operator approval. A local administrator
can manufacture JSON or alter code; checksum gates are operator review
controls, not independent cryptographic authorization. Tests reduce risk;
they do not guarantee zero bugs or full Supabase-provider restore.

Actual isolated run: [12 October 2026, 00:20 WIB](production-bootstrap.rehearsal.2026-10-11T17-20-22-256Z.json),
PostgreSQL 17.11, all 10 account guards passed after the writer regression suite.
Container/bundle cleanup verified; DEV/Caddy unchanged. Earlier failures were
in disposable fixture rebuilding (foreign-key/append-only audit retention and
native-extension ownership); no production database was accessed, and no audit
or extension protection was relaxed. Final backend quality: 493 passed,
one explicitly skipped local PostgreSQL test, typecheck/build passed, OpenAPI
parity 159 operations passed. At that local-test checkpoint the patch was still
uncommitted/unpushed; these results are not a successful push/main CI run or
authorization to create a production user. Code promotion is tracked by
[PR #5](https://github.com/dhanis-alghifari/cms-sinegasi-picture/pull/5); require
its merge and successful quality CI on the exact resulting main SHA before
preparing any first-account approval.

Threat boundaries: reviewed Git source/artifacts and private operator evidence
→ TLS-protected admin connection → privileged DDL/config/journal. Controls bind
target/release/checksums, bound resources/locks/windows, deny incomplete recovery
proof and sanitize failures. A local administrator can manufacture JSON or
alter reviewed code; these are operator review controls, not cryptographic
multi-party authorization or protection against a compromised administrator.

References: [PostgreSQL enum transaction rule](https://www.postgresql.org/docs/17/sql-altertype.html),
[session advisory locks](https://www.postgresql.org/docs/17/explicit-locking.html#ADVISORY-LOCKS),
[Supabase migration deployment](https://supabase.com/docs/guides/deployment/database-migrations),
[GitHub CLI environment/configuration](https://cli.github.com/manual/gh_help_environment),
[explicit API host/method](https://cli.github.com/manual/gh_api).
