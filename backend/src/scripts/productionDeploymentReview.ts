import { DeploymentGateError } from './productionDeploymentError.js';

export const DEPLOYMENT_OWNER = 'dhanis-alghifari';
export const DEPLOYMENT_REPOSITORY = `${DEPLOYMENT_OWNER}/cms-sinegasi-picture`;
export type DeploymentReviewMode = 'independent-review' | 'solo-owner';
export interface DeploymentReviewPolicy {
  mode: DeploymentReviewMode;
  owner: typeof DEPLOYMENT_OWNER;
  soloRiskAccepted: boolean;
}
const requireReview: (condition: unknown, stage: string) => asserts condition = (condition, stage) => {
  if (!condition) throw new DeploymentGateError(stage);
};
function object(value: unknown): Record<string, unknown> {
  requireReview(value !== null && typeof value === 'object' && !Array.isArray(value), 'INVALID_DEPLOYMENT_REVIEW_DOCUMENT');
  return value as Record<string, unknown>;
}
export function deploymentReviewPolicy(value: unknown): DeploymentReviewPolicy {
  const policy = object(value);
  requireReview(Object.keys(policy).length === 3 && policy.owner === DEPLOYMENT_OWNER
    && (policy.mode === 'independent-review' && policy.soloRiskAccepted === false
      || policy.mode === 'solo-owner' && policy.soloRiskAccepted === true), 'EXPLICIT_DEPLOYMENT_REVIEW_POLICY_REQUIRED');
  return policy as unknown as DeploymentReviewPolicy;
}
export interface DeploymentDispatch {
  repository: string;
  actor: string;
  event: string;
  ref: string;
  workflowSha: string;
  releaseSha: string;
  runId: string;
  runAttempt: string;
}
/** Solo mode is an explicit risk acceptance, NEVER independent approval. */
export function requireDeploymentDispatch(context: DeploymentDispatch, policyValue: unknown): void {
  const policy = deploymentReviewPolicy(policyValue);
  requireReview(context.repository === DEPLOYMENT_REPOSITORY && context.event === 'workflow_dispatch'
    && context.ref === 'refs/heads/main' && /^[a-f0-9]{40}$/.test(context.releaseSha)
    && context.workflowSha === context.releaseSha && /^[1-9][0-9]*$/.test(context.runId)
    && context.runAttempt === '1' && context.actor === policy.owner,
  'APPROVED_MAIN_MANUAL_DISPATCH_REQUIRED');
}
export interface DeploymentReleaseArtifact {
  format: 1;
  releaseSha: string;
  buildRunId: string;
  image: string;
  packageSha256: string;
  evidenceSha256: string;
}
export function validateDeploymentReleaseArtifact(raw: string, expected: DeploymentReleaseArtifact, runValue: unknown, jobsValue: unknown): void {
  requireReview(raw.length <= 4096, 'DEPLOYMENT_ARTIFACT_TOO_LARGE');
  const artifact = object(JSON.parse(raw) as unknown), run = object(runValue), jobs = object(jobsValue);
  requireReview(JSON.stringify(artifact) === raw && Object.keys(artifact).length === 6 && expected.format === 1
    && /^[a-f0-9]{40}$/.test(expected.releaseSha) && /^[1-9][0-9]*$/.test(expected.buildRunId)
    && /^ghcr\.io\/dhanis-alghifari\/cms-sinegasi-picture\/api@sha256:[a-f0-9]{64}$/.test(expected.image)
    && /^[a-f0-9]{64}$/.test(expected.packageSha256) && /^[a-f0-9]{64}$/.test(expected.evidenceSha256)
    && Object.entries(expected).every(([key, value]) => artifact[key] === value), 'APPROVED_DEPLOYMENT_ARTIFACT_BINDING_REQUIRED');
  requireReview(String(run.id) === expected.buildRunId && run.head_sha === expected.releaseSha && run.head_branch === 'main'
    && run.path === '.github/workflows/deploy-prod.yml' && run.event === 'workflow_dispatch'
    && run.status === 'completed' && run.conclusion === 'success' && run.run_attempt === 1
    && object(run.repository).full_name === DEPLOYMENT_REPOSITORY && Array.isArray(jobs.jobs), 'SUCCESSFUL_PRODUCTION_BUILD_RUN_REQUIRED');
  const builds = jobs.jobs.map(object).filter(job => job.name === 'build-release');
  requireReview(builds.length === 1 && builds[0].status === 'completed' && builds[0].conclusion === 'success', 'SUCCESSFUL_PRODUCTION_BUILD_JOB_REQUIRED');
}
