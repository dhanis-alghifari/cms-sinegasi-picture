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
const devDeployScript = readFile('ops/deploy-dev.sh');
const prodDeployScript = readFile('ops/deploy-prod.sh');

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
  '[GUARDRAIL VIOLATION] .github/workflows/deploy-prod.yml must deploy through ./ops/deploy-prod.sh so migrations and Caddy protection are enforced.'
);
assert(
  devWorkflow.includes('./ops/deploy-dev.sh'),
  '[GUARDRAIL VIOLATION] .github/workflows/deploy-dev.yml must deploy through ./ops/deploy-dev.sh so migrations and Caddy protection are enforced.'
);
assert(
  devWorkflow.includes('group: sinegasi-vps-deployment') && prodWorkflow.includes('group: sinegasi-vps-deployment'),
  '[GUARDRAIL VIOLATION] Development and production workflows must serialize shared VPS checkout/deploy operations.'
);
assert(
  devDeployScript.includes('dist/scripts/applyMigrations.js'),
  '[GUARDRAIL VIOLATION] ops/deploy-dev.sh must run the universal migration runner so new SQL migrations are applied automatically.'
);
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
  prodDeployScript.includes('CADDY_CONTAINER') && prodDeployScript.includes('is_caddy_running'),
  '[GUARDRAIL VIOLATION] ops/deploy-prod.sh must verify the existing Caddy container before and after deployment.'
);
assert(
  prodDeployScript.includes('docker compose -f "$CADDY_COMPOSE_FILE" up -d caddy'),
  '[GUARDRAIL VIOLATION] ops/deploy-prod.sh must ensure the managed Caddy service is running before production deployment.'
);

// Rule 1.3: Must use --force-recreate so containers actually update
assert(
  devDeployScript.includes('--force-recreate'),
  '[GUARDRAIL VIOLATION] ops/deploy-dev.sh must use "--force-recreate" to ensure container code updates are applied.'
);
assert(
  prodDeployScript.includes('--force-recreate'),
  '[GUARDRAIL VIOLATION] ops/deploy-prod.sh must use "--force-recreate" to ensure container code updates are applied.'
);
assert(
  devDeployScript.includes('sinegasi-vps-deploy.lock') && prodDeployScript.includes('sinegasi-vps-deploy.lock'),
  '[GUARDRAIL VIOLATION] Development and production deploy scripts must share one VPS deploy lock.'
);
assert(
  devDeployScript.includes('COMPOSE_IGNORE_ORPHANS') && prodDeployScript.includes('COMPOSE_IGNORE_ORPHANS'),
  '[GUARDRAIL VIOLATION] Deploy scripts must suppress harmless orphan warnings without using orphan removal.'
);

// ============================================================================
// 2. DOCKER COMPOSE CONFIGURATION CHECKS
// ============================================================================
const devCompose = readFile('docker-compose.dev.yml');
const prodCompose = readFile('docker-compose.prod.yml');
const caddyCompose = readFile('docker-compose.caddy.yml');

// Rule 2.1: Loopback port isolation (never expose raw API ports to 0.0.0.0)
assert(
  devCompose.includes('"127.0.0.1:3001:5001"'),
  '[GUARDRAIL VIOLATION] docker-compose.dev.yml must bind to "127.0.0.1:3001:5001" to prevent public port exposure.'
);
assert(
  prodCompose.includes('"127.0.0.1:3002:5001"'),
  '[GUARDRAIL VIOLATION] docker-compose.prod.yml must bind to "127.0.0.1:3002:5001" to prevent public port exposure.'
);

// Rule 2.2: Must join caddy_net external network
assert(
  devCompose.includes('caddy_net') && devCompose.includes('external: true'),
  '[GUARDRAIL VIOLATION] docker-compose.dev.yml must join external network "caddy_net".'
);
assert(
  prodCompose.includes('caddy_net') && prodCompose.includes('external: true'),
  '[GUARDRAIL VIOLATION] docker-compose.prod.yml must join external network "caddy_net".'
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
const envExample = readFile('backend/.env.example');

// Rule 3.1: Password assertion and temporary password policy
assert(
  passwordService.includes('assertPasswordPolicy') && passwordService.includes('/\\d/.test'),
  '[GUARDRAIL VIOLATION] backend/src/services/passwordService.ts must enforce digit and letter validation in assertPasswordPolicy.'
);
assert(
  passwordService.includes('createTemporaryPassword') && passwordService.includes('candidate'),
  '[GUARDRAIL VIOLATION] backend/src/services/passwordService.ts must sanitize and ensure temporary passwords satisfy assertPasswordPolicy.'
);

// Rule 3.2: .env.example must have valid student default password with digits
const studentDefaultMatch = envExample.match(/^STUDENT_DEFAULT_PASSWORD=(.+)$/m);
assert(
  studentDefaultMatch && /\d/.test(studentDefaultMatch[1]) && /[A-Za-z]/.test(studentDefaultMatch[1]),
  '[GUARDRAIL VIOLATION] backend/.env.example must contain STUDENT_DEFAULT_PASSWORD with both letters and digits.'
);

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
