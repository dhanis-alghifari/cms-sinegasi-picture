# Repository review and public onboarding

## Scope — 14 October 2026

Reviewed `main` at `88c2bcf7f2d804f9b48c3f4943d33562c2af31b8` and
`develop` at `2f572173f19e1d729749d243d844837ab70ec5b7`.
This is a structure/configuration review, not a new production execution or a
claim that every product flow is secure. No runtime environment file, Keychain,
database, VPS, or live development endpoint was accessed for this review.

## Findings and treatment

| Finding | Treatment |
| --- | --- |
| No root/backend onboarding README | Added installation, loopback demo, configuration names, structure and safety limits |
| Frontend instructions referred to an absent `model` folder | Corrected ownership to existing `schemas` and `types` directories |
| Supabase CLI version cache still tracked | Removed `supabase/.temp/cli-latest`; existing ignore rules keep newly generated cache local |
| Workflow runner floated with `ubuntu-latest`; quality jobs had no timeout | Selected `ubuntu-24.04`, bounded both jobs to 20 minutes |
| Structure/private-file regressions were not checked centrally | Added filename-only hygiene, README hostname and relative-link checks with unit tests |
| Ops README mixes historical commands/checkpoints | Added a current navigation/safety section; preserved history and warned against replay |
| `develop` is behind `main` | 20 commits behind, no unique commits at reviewed SHAs; no automatic sync/deployment |

## Architecture assessment

Both branches use the same broad organization: Fastify composition in `app`,
domain logic in `modules`, and React `app -> features -> shared` organization.
Tests are mostly co-located with the owning backend module; frontend architecture
and build checks have dedicated `scripts` and `tests` folders. No generated
frontend build directory exists in either reviewed tracked tip.

Most handwritten TypeScript files are under 500 lines. The shared generated-style
sidebar primitive is an existing documented exception. The social-media service
is about 520 lines and is a candidate for a later test-backed domain extraction,
not a reason to split by line count alone. Existing feature/response-boundary
checks are scoped: they do not prove every module obeys every architectural rule.

Migration history, runner paths and checked-in non-secret evidence remain in place.
Moving these would change operational bindings and is not cosmetic housekeeping.
The hygiene check is not a secret-content scanner and does not read `.env*`;
template filenames are allowed without asserting their contents are safe.

## GitHub protections

Remote settings were read back after applying the approved configuration:

- `main`: PR required, 0 approving reviewers for the solo owner; both
  `backend-quality` and `frontend-quality` required from GitHub Actions app 15368,
  up-to-date branch and resolved conversations required; admins enforced,
  force-push/deletion disabled.
- `production`: required owner reviewer, self-review allowed for the solo workflow,
  admin bypass disabled, exactly one allowed branch `main` and no tag rules.
- Repository `PRODUCTION_DEPLOYMENT_READY=false`; no dispatch performed.
- Secret scanning and push protection enabled; validity checks remain disabled.
- Fork workflow approval applies to all external contributors. Workflow token
  defaults remain read-only with PR-review approval disabled.

These are time-specific remote observations, not guarantees that settings cannot
be changed later. Solo owner approval is explicitly not independent review.
They do not remove the current production gate's evidence or key-recovery requirements.

## Secret-scanning follow-up

After enabling scanning, GitHub reported alert 1 (`supabase_secret_key`, validity
unknown) at a historical test fixture in
`backend/src/scripts/productionAuthVerificationExecutor.test.ts:207`, commit
`a22d991877dd51d6c6289878c4b6eee6124ed14a`.
The test injects a mocked upstream and uses a synthetic-labeled literal; it does
not obtain a Keychain credential or contact Supabase. The current fixture was
changed to a clearly synthetic key without a provider credential prefix.
No provider validity request or credential comparison was performed, and the
historical alert remains open at the owner's explicit request. Changing a fixture
does not remove the old commit or resolve its alert automatically.

Earlier local historical scans are separate evidence, not proof that a new
provider detector cannot report additional findings. Never dismiss an actual key
merely because it occurs in a test file; revoke/rotate genuinely exposed keys via
the authorized private process.

## Remaining boundaries

- README host filtering avoids advertising live development endpoints, but
  does not scrub source, git history, Actions history, caches or existing clones.
  Hiding an address is not authentication.
- `develop` lacks later private-media/proxy/production-gate changes from `main`.
  A separate reviewed integration rollout is needed; folder cleanup does not
  update its running deployment or storage access policy.
- Public source contains local demo fixtures; they must stay disabled on every
  internet-facing instance. Use isolated infrastructure to test full database/upload flows.
- Browser session storage and logout's lack of server-side token revocation remain
  known design limits. No authentication redesign is included here.
- No credentials, database changes, DNS/bucket changes, production deployment,
  history rewrite, branch deletion or push to `develop` is authorized by this patch.

Use the [root README](../../README.md) for reproducible local checks and the
[current production gate](../../ops/production-gate/README.md) for rollout requirements.

## Local validation of this patch

- Repository hygiene unit tests: 6 passed; tracked path and all README link/host checks passed.
- Existing deployment/infrastructure guardrails passed.
- Backend `quality:check`: typecheck, unit/rehearsal tests, OpenAPI parity
  (160 operations), and build passed.
- Frontend `quality:check`: lint, architecture/UI/response checks, private-media
  tests, typecheck/build, deployment-asset tests, and bundle budget passed.
  Bundle check still reports 22 target warnings, with zero hard violations.
- Changed/new source and documentation were scanned with redacted Gitleaks output;
  no findings in this patch. This does not dismiss the historical GitHub alert.

Both quality commands ran with a minimal environment and `ENV_FILE_LOADING=disabled`.
No real database integration, browser login/upload, live deployment, or Docker
cutover was tested. An optional disposable-PostgreSQL test remains skipped unless
that test database is explicitly provided; this is not managed-integration evidence.
