#!/usr/bin/env node

/**
 * CI/CD & Deployment Guardrails Verification Script
 *
 * Enforces critical configuration invariants to prevent accidental regressions
 * that break development or production environments.
 */

import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const errors = [];

function assert(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

function readFile(relativePath) {
  const fullPath = path.join(rootDir, relativePath);
  if (!fs.existsSync(fullPath)) {
    errors.push(`[FILE_MISSING] Required file does not exist: ${relativePath}`);
    return '';
  }
  return fs.readFileSync(fullPath, 'utf8');
}

console.log('🛡️  Running Deployment & Infrastructure Guardrail Checks...\n');

// ============================================================================
// 1. WORKFLOW CHECKS: deploy-dev.yml & deploy-prod.yml
// ============================================================================
const devWorkflow = readFile('.github/workflows/deploy-dev.yml');
const prodWorkflow = readFile('.github/workflows/deploy-prod.yml');
const prodCiPreflight = readFile('ops/production-ci-preflight.cjs');
assert(prodWorkflow.includes('production-ci-preflight.cjs') && prodCiPreflight.includes('--confirm-evidence') && prodCiPreflight.includes('--release-sha')
  && !prodWorkflow.includes('db:production --') && !prodWorkflow.includes('PRODUCTION_MIGRATION_MANIFEST'),
  '[GUARDRAIL VIOLATION] Production publishing requires exact reviewed schema evidence; never replay/promote legacy SQL.');
const photoPolicy = readFile('backend/src/scripts/studentPhotoProductionPolicy.ts');
const photoRunner = readFile('backend/src/scripts/studentPhotoProductionMigration.ts');
const photoCli = readFile('backend/src/scripts/studentPhotoProductionCli.ts');
const backupRolePolicy = readFile('backend/src/scripts/productionBackupRolePolicy.ts');
assert(backupRolePolicy.includes("APPROVED_BACKUP_ROLE_POLICY = 'sinegasi-backup-readonly-v1'")
  && backupRolePolicy.includes('pg_catalog.pg_auth_members') && backupRolePolicy.includes('pg_db_role_setting')
  && backupRolePolicy.includes('grantor_name') && backupRolePolicy.includes('APPROVED_BACKUP_ROLE_OR_MEMBERSHIP_DRIFT')
  && !/\b(?:CREATE|ALTER|GRANT|REVOKE|UPDATE|DELETE|INSERT)\s+(?:ROLE|TABLE|SCHEMA|ALL|INTO|FROM)/.test(backupRolePolicy),
  '[GUARDRAIL VIOLATION] Backup-role delta requires its explicit read-only exact-privilege policy.');
assert(photoPolicy.includes("STUDENT_PHOTO_SQL_SHA256 = '432bfd1fa8894f7aa554eeabfcab98923563ae30737b26232b5e631d35096613'")
  && photoPolicy.includes('requireStudentPhotoFunction') && photoPolicy.includes('PHOTO_MIGRATION_ALREADY_PRESENT_INSPECT_DO_NOT_RETRY')
  && photoRunner.includes('requireDeploymentObservation') && photoRunner.includes('PHOTO_MIGRATION_FRESH_REAL_REHEARSAL_REQUIRED')
  && photoRunner.includes('PHOTO_MIGRATION_COMMIT_UNCERTAIN_INSPECT_DO_NOT_RETRY')
  && photoCli.includes('requireProductionEnvironment') && photoCli.includes('requireDeploymentQuality')
  && photoCli.includes('current.migrationReady') && !photoCli.includes('applyMigrations'),
  '[GUARDRAIL VIOLATION] Student-photo SQL requires its separate fixed-SQL, protected, fresh-recovery approval runner.');
const devDeployScript = readFile('ops/deploy-dev.sh');
const prodDeployScript = readFile('ops/deploy-prod.sh');
const prodReleaseScript = readFile('ops/production-release.sh');
assert(prodCiPreflight.includes('requireProductionEnvironment') && prodCiPreflight.includes('requireDeploymentQuality')
  && prodReleaseScript.includes('verify_candidate_schema') && prodReleaseScript.includes('schema_evidence_sha256')
  && prodReleaseScript.includes('release_package_sha256') && prodReleaseScript.includes('schema-gate.json'),
  '[GUARDRAIL VIOLATION] Both CI jobs need actual production protections and runtime read-only schema verification.');
assert(prodWorkflow.includes("if: inputs.phase == 'build'") && prodWorkflow.includes("if: inputs.phase == 'deploy'")
  && !prodWorkflow.includes('needs: build-release') && prodWorkflow.includes('deployment_approval_sha256')
  && prodWorkflow.includes('production-artifact-preflight.cjs') && prodCiPreflight.includes('requireDeploymentDispatch')
  && prodWorkflow.includes('PRODUCTION_REVIEW_MODE'),
  '[GUARDRAIL VIOLATION] Production needs separate explicit build/deploy dispatches, exact artifact/checksum and opt-in review policy.');
assert(prodReleaseScript.includes('approval_format') && prodReleaseScript.includes('authenticated-proxy')
  && prodReleaseScript.includes('r2_account_id') && prodReleaseScript.includes('r2_bucket')
  && !prodReleaseScript.includes('media_public_domain'),
  '[GUARDRAIL VIOLATION] Production approval must bind private media account/bucket, not a public domain.');
const applicationSource = readFile('backend/src/app/createApplication.ts');
const proxyTrustSource = readFile('backend/src/config/proxyTrust.ts');
const runtimePreflight = readFile('ops/production-runtime-preflight.cjs');
assert(applicationSource.includes('trustProxy: createProxyTrust(runtimeConfig)')
  && proxyTrustSource.includes('peers.has(normalizeAddress(address))') && proxyTrustSource.includes('hop >= hops')
  && runtimePreflight.includes('PRODUCTION_TRUST_PROXY_ADDRESSES') && runtimePreflight.includes('trustedProxyAddresses')
  && prodReleaseScript.includes('trust_proxy_addresses') && prodReleaseScript.includes('PREVIOUS_PROXY_ADDRESSES'),
  '[GUARDRAIL VIOLATION] Proxy trust needs exact peer addresses and bounded hops, bound to approval/preflight/rollback.');

// Rule 1.1: Never use --remove-orphans in deploy workflows (kills Caddy/other compose services)
assert(
  !devWorkflow.includes('--remove-orphans'),
  '[GUARDRAIL VIOLATION] .github/workflows/deploy-dev.yml contains "--remove-orphans". This kills caddy-proxy! Remove it.'
);
assert(
  !prodWorkflow.includes('--remove-orphans'),
  '[GUARDRAIL VIOLATION] .github/workflows/deploy-prod.yml contains "--remove-orphans". This kills caddy-proxy! Remove it.'
);

// Rule 1.2: Both deployments must protect the existing Caddy container.
assert(
  !devWorkflow.includes('docker-compose.caddy.yml up -d'),
  '[GUARDRAIL VIOLATION] .github/workflows/deploy-dev.yml must not recreate Caddy; it must use the guarded deploy script.'
);
assert(
  prodWorkflow.includes('./ops/deploy-prod.sh'),
  '[GUARDRAIL VIOLATION] Production must deploy through the isolated reviewed release entry point.'
);
assert(
  devWorkflow.includes('./ops/deploy-dev.sh'),
  '[GUARDRAIL VIOLATION] .github/workflows/deploy-dev.yml must use the guarded DEV entry point.'
);
assert(
  devWorkflow.includes('group: sinegasi-vps-deployment') && prodWorkflow.includes('group: sinegasi-vps-deployment'),
  '[GUARDRAIL VIOLATION] Development and production workflows must serialize shared VPS deployment operations.'
);
assert(
  devDeployScript.includes('APPLY_MIGRATIONS="${DEV_APPLY_MIGRATIONS:-false}"')
    && devDeployScript.includes('if [[ "$APPLY_MIGRATIONS" == "true" ]]')
    && devWorkflow.includes('DEV_APPLY_MIGRATIONS=false ./ops/deploy-dev.sh'),
  '[GUARDRAIL VIOLATION] Automatic DEV deployments must skip SQL; migrations require separate explicit opt-in.'
);
assert(devDeployScript.includes('resolve_proxy_peer') && devDeployScript.includes('.IPAddress')
  && devDeployScript.includes('DEV_PROXY_CHANGED_DURING_BUILD') && devDeployScript.includes('DEV_PROXY_CHANGED_DURING_DEPLOY')
  && devWorkflow.includes('test "$(git rev-parse HEAD)" = "$expected_sha"'),
  '[GUARDRAIL VIOLATION] DEV must pin the tested SHA and observed exact Caddy peer; changed topology fails closed.');
assert(
  devWorkflow.includes("VPS_HOST_PUBLIC_KEY") && prodWorkflow.includes("VPS_HOST_PUBLIC_KEY"),
  '[GUARDRAIL VIOLATION] Deploy workflows must pin the VPS SSH host key through the VPS_HOST_PUBLIC_KEY secret.'
);
assert(
  !devWorkflow.includes('StrictHostKeyChecking=no') && !prodWorkflow.includes('StrictHostKeyChecking=no'),
  '[GUARDRAIL VIOLATION] Deploy workflows must not disable SSH host-key verification.'
);
assert(
  devDeployScript.includes('CADDY_CONTAINER') && devDeployScript.includes('is_caddy_running'),
  '[GUARDRAIL VIOLATION] ops/deploy-dev.sh must verify the existing Caddy container before and after deployment.'
);
assert(
  prodReleaseScript.includes('caddy-proxy') && prodReleaseScript.includes('sinegasi-api-dev') && prodReleaseScript.includes('preserved_containers_unchanged'),
  '[GUARDRAIL VIOLATION] Production must preserve and verify existing dev/Caddy containers.'
);
assert(
  !prodDeployScript.includes('applyMigrations') && !prodReleaseScript.includes('applyMigrations') && !prodReleaseScript.includes('up -d caddy'),
  '[GUARDRAIL VIOLATION] Production rollout must not execute SQL or restart Caddy.'
);
assert(
  prodWorkflow.includes('workflow_dispatch:') && !/^\s+push:/m.test(prodWorkflow) && prodWorkflow.includes('environment: production') && prodWorkflow.includes('PRODUCTION_DEPLOYMENT_READY'),
  '[GUARDRAIL VIOLATION] Production must require manual dispatch and a protected readiness gate.'
);
assert(
  prodDeployScript.includes('PRODUCTION_ROOT=/opt/sinegasi-prod') && !prodWorkflow.includes('git pull') && !prodDeployScript.includes('git pull') && !prodReleaseScript.includes(' compose build'),
  '[GUARDRAIL VIOLATION] Production must use an isolated immutable release, never the shared dev checkout/build.'
);
assert(
  prodReleaseScript.includes('@sha256:') && prodReleaseScript.includes('restore_previous_release') && prodReleaseScript.includes('read_approval') && !prodReleaseScript.includes(':latest'),
  '[GUARDRAIL VIOLATION] Production requires immutable images, release approval, and exact-digest rollback.'
);

// Rule 1.3: Must use --force-recreate so containers actually update
assert(
  devDeployScript.includes('--force-recreate'),
  '[GUARDRAIL VIOLATION] ops/deploy-dev.sh must use "--force-recreate" to ensure container code updates are applied.'
);
assert(
  prodReleaseScript.includes('--force-recreate'),
  '[GUARDRAIL VIOLATION] ops/deploy-prod.sh must use "--force-recreate" to ensure container code updates are applied.'
);
assert(
  devDeployScript.includes('sinegasi-vps-deploy.lock') && prodReleaseScript.includes('sinegasi-vps-deploy.lock'),
  '[GUARDRAIL VIOLATION] Development and production deploy scripts must share one VPS deploy lock.'
);
assert(
  devDeployScript.includes('COMPOSE_IGNORE_ORPHANS') && prodReleaseScript.includes('COMPOSE_IGNORE_ORPHANS'),
  '[GUARDRAIL VIOLATION] Deploy scripts must suppress harmless orphan warnings without using orphan removal.'
);

// ============================================================================
// 2. DOCKER COMPOSE CONFIGURATION CHECKS
// ============================================================================
const devCompose = readFile('docker-compose.dev.yml');
const prodCompose = readFile('docker-compose.prod.yml');
const caddyCompose = readFile('docker-compose.caddy.yml');
assert(devCompose.includes('TRUST_PROXY_ADDRESSES=${DEV_TRUST_PROXY_ADDRESSES:?'),
  '[GUARDRAIL VIOLATION] DEV proxy trust requires the observed exact Caddy peer.');
assert(devCompose.includes('BACKGROUND_JOBS_ENABLED=false'),
  '[GUARDRAIL VIOLATION] DEV application-only rollouts must not start database-writing workers.');

// Rule 2.1: Loopback port isolation (never expose raw API ports to 0.0.0.0)
assert(
  devCompose.includes('"127.0.0.1:3001:5001"'),
  '[GUARDRAIL VIOLATION] docker-compose.dev.yml must bind to "127.0.0.1:3001:5001" to prevent public port exposure.'
);
assert(
  prodCompose.includes('"127.0.0.1:3002:5001"'),
  '[GUARDRAIL VIOLATION] docker-compose.prod.yml must bind to "127.0.0.1:3002:5001" to prevent public port exposure.'
);

// Rule 2.2: Only DEV joins Caddy; production has a dedicated bridge.
assert(
  devCompose.includes('caddy_net') && devCompose.includes('external: true'),
  '[GUARDRAIL VIOLATION] docker-compose.dev.yml must join external network "caddy_net".'
);
assert(
  prodCompose.includes('name: sinegasi_prod_api_net') && prodCompose.includes('driver: bridge')
    && !prodCompose.includes('caddy_net') && !/^\s+external:\s*true/m.test(prodCompose)
    && !/^\s+network_mode:/m.test(prodCompose) && !/^\s+internal:\s*true/m.test(prodCompose),
  '[GUARDRAIL VIOLATION] Production needs an isolated, outbound-capable bridge, never DEV/Caddy/host networking.'
);
assert(
  !/^\s+build:/m.test(prodCompose) && prodCompose.includes('image: ${API_IMAGE:?') && prodCompose.includes('PRODUCTION_ENV_FILE:?') && prodCompose.includes('BACKGROUND_JOBS_ENABLED=false') && prodCompose.includes('PRODUCTION_TRUST_PROXY:?') && prodCompose.includes('PRODUCTION_TRUST_PROXY_ADDRESSES:?'),
  '[GUARDRAIL VIOLATION] Production Compose must use approved digest/private config with workers disabled and explicit proxy topology.'
);
assert(
  (prodCompose.split('\n').some(line => line.trim() === '- NTFY_ENABLED=false')
    || ['NTFY_ENABLED=true', 'NTFY_PUBLIC_GENERIC_ENABLED=true', 'NTFY_SERVER_URL=https://ntfy.sh',
    'NTFY_TOPIC=sinegasi-notif', 'NTFY_CASH_REVIEW_TOPIC=sinegasi-notif',
    'NTFY_FRONTEND_URL=https://sinegasi.pictures', 'NTFY_ACCESS_TOKEN=']
    .every(value => prodCompose.split('\n').some(line => line.trim() === `- ${value}`)))
    && runtimePreflight.includes('config.ntfyPublicGenericEnabled === true')
    && runtimePreflight.includes("config.ntfyTopic === 'sinegasi-notif'")
    && runtimePreflight.includes("config.ntfyAccessToken === ''"),
  '[GUARDRAIL VIOLATION] Production push must use the approved public generic topic without tokens or DEV targets.'
);
assert(
  !/^\s+caddy:/m.test(prodCompose) && !prodCompose.includes('api.sinegasi.com'),
  '[GUARDRAIL VIOLATION] Production must not expose an unreviewed public Caddy hostname.'
);
assert(
  caddyCompose.includes('container_name: caddy-proxy') && caddyCompose.includes('ports:') && caddyCompose.includes('"443:443"'),
  '[GUARDRAIL VIOLATION] docker-compose.caddy.yml must define caddy-proxy binding to port 443.'
);

// Rule 2.3: Must have caddy labels
assert(
  devCompose.includes('caddy: sinegasi-dev.duckdns.org'),
  '[GUARDRAIL VIOLATION] docker-compose.dev.yml missing label "caddy: sinegasi-dev.duckdns.org".'
);
assert(
  devCompose.includes('caddy.reverse_proxy: "{{upstreams 5001}}"'),
  '[GUARDRAIL VIOLATION] docker-compose.dev.yml missing label "caddy.reverse_proxy: {{upstreams 5001}}".'
);
assert(
  devCompose.includes('NTFY_ENABLED=true'),
  '[GUARDRAIL VIOLATION] docker-compose.dev.yml must keep NTFY_ENABLED=true for development notifications.'
);

// ============================================================================
// 3. AUTH & SECURITY POLICIES CHECKS
// ============================================================================
const passwordService = readFile('backend/src/services/passwordService.ts');
const envConfig = readFile('backend/src/config/env.ts');

// Rule 3.1: Password assertion and temporary password policy
assert(
  passwordService.includes('assertPasswordPolicy') && passwordService.includes('/\\d/.test'),
  '[GUARDRAIL VIOLATION] backend/src/services/passwordService.ts must enforce digit and letter validation in assertPasswordPolicy.'
);
assert(
  passwordService.includes('createTemporaryPassword') && passwordService.includes('candidate'),
  '[GUARDRAIL VIOLATION] backend/src/services/passwordService.ts must sanitize and ensure temporary passwords satisfy assertPasswordPolicy.'
);

// Environment files are not read by this source-only guardrail. Runtime password
// configuration is validated by env.ts/password-service tests and image preflight.

// Rule 3.3: CORS must disallow wildcard '*'
assert(
  envConfig.includes("origin === '*'"),
  '[GUARDRAIL VIOLATION] backend/src/config/env.ts must reject CORS wildcard "*".'
);

// ============================================================================
// RESULT SUMMARY
// ============================================================================
if (errors.length > 0) {
  console.error('❌ GUARDRAIL CHECKS FAILED:');
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  console.error('\n⚠️  Commit/Push rejected. Please fix the violations above before proceeding.\n');
  process.exit(1);
} else {
  console.log('✅ All deployment and infrastructure guardrails passed cleanly!\n');
  process.exit(0);
}
