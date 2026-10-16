import { DeploymentGateError } from './productionDeploymentError.js';

export interface PrivateMediaEvidence {
  mode: 'authenticated-proxy';
  verification: 'owner-attested';
  accountId: string;
  bucket: string;
  developmentBucket: string;
  r2DevEnabled: false;
  enabledCustomDomains: 0;
  publicWorkerRoutes: false;
  credentialsBucketScoped: true;
  verifiedAt: string;
  verifiedBy: 'dhanis-alghifari';
}
/** Receipt is reviewed operator attestation, not a live Cloudflare API probe. */
export function privateMediaEvidence(value: unknown, now: number): PrivateMediaEvidence {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DeploymentGateError('PRIVATE_MEDIA_EVIDENCE_REQUIRED');
  const m = value as Record<string, unknown>;
  const keys: ReadonlyArray<keyof PrivateMediaEvidence> = ['mode', 'verification', 'accountId', 'bucket', 'developmentBucket',
    'r2DevEnabled', 'enabledCustomDomains', 'publicWorkerRoutes', 'credentialsBucketScoped', 'verifiedAt', 'verifiedBy'];
  const validBucket = (bucket: unknown): bucket is string => typeof bucket === 'string'
    && /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket);
  const verified = typeof m.verifiedAt === 'string' ? Date.parse(m.verifiedAt) : NaN;
  if (Object.keys(m).length !== keys.length || !keys.every(key => Object.hasOwn(m, key))
    || m.mode !== 'authenticated-proxy' || m.verification !== 'owner-attested'
    || typeof m.accountId !== 'string' || !/^[a-f0-9]{32}$/.test(m.accountId)
    || !validBucket(m.bucket) || !validBucket(m.developmentBucket) || m.bucket === m.developmentBucket
    || m.r2DevEnabled !== false || m.enabledCustomDomains !== 0 || m.publicWorkerRoutes !== false
    || m.credentialsBucketScoped !== true || m.verifiedBy !== 'dhanis-alghifari'
    || !Number.isFinite(now) || !Number.isFinite(verified) || new Date(verified).toISOString() !== m.verifiedAt
    || verified > now || now - verified > 30 * 60_000) throw new DeploymentGateError('FRESH_PRIVATE_PRODUCTION_BUCKET_REQUIRED');
  return m as unknown as PrivateMediaEvidence;
}
