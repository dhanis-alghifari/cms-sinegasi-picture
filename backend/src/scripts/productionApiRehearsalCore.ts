import { createHmac } from 'node:crypto';

// Synthetic credential for an isolated network namespace, never a live API key.
export const POSTGREST_FIXTURE_SECRET = 'sinegasi-isolated-postgrest-fixture-only-never-live-2026';
export const POSTGREST_REHEARSAL_IMAGE = 'postgrest/postgrest@sha256:bca3f86f69d8ef7aa1e5ee65e66ce9a20c6c147be637517a7be8399e102901d1';
export const API_EVIDENCE_FILE = 'production-api.rehearsal.json';

export function fixtureJwt(role: 'service_role' | 'anon' | 'authenticated'): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ role, exp: Math.floor(Date.now() / 1000) + 900 })).toString('base64url');
  const signature = createHmac('sha256', POSTGREST_FIXTURE_SECRET).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

export function requireApiRehearsalArguments(args: readonly string[]): void {
  if (args.length !== 1 || args[0] !== 'rehearse-api') throw new Error('EXPLICIT_ISOLATED_API_MODE_REQUIRED');
}

export function requireIsolatedApiTarget(host: string, database: string): void {
  if (host !== '127.0.0.1' || database !== 'sinegasi_schema_fresh') throw new Error('ISOLATED_API_TARGET_REQUIRED');
}

export function parseApiEvidence(output: string, fingerprint: string, referenceChecksum: string): Record<string, unknown> {
  const value: unknown = JSON.parse(output);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('API_EVIDENCE_INVALID');
  const result = value as Record<string, unknown>;
  if (result.status !== 'ISOLATED_APPLICATION_API_REHEARSAL_PASSED'
    || result.schemaPackageSha256 !== fingerprint || result.referenceChecksum !== referenceChecksum
    || result.isolatedApplicationFlowTestsPassed !== true || result.productionChanged !== false
    || result.devDatabaseChanged !== false || result.managedSupabaseIntegrationTested !== false
    || result.productionApproved !== false || result.liveAccountCreated !== false
    || !Array.isArray(result.checks) || result.checks.length < 15
    || result.checks.some(check => typeof check !== 'string')) throw new Error('API_EVIDENCE_NOT_PASSED');
  return result;
}
