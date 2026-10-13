// Both manually dispatched phases validate actual GitHub metadata + reviewed
// evidence. This is not a human signature or a live R2 privacy probe.
const fs = require('node:fs');
const path = require('node:path');
const gate = require('../backend/dist/scripts/productionDeploymentGate.js');
const review = require('../backend/dist/scripts/productionDeploymentReview.js');
const cli = require('../backend/dist/scripts/productionDeploymentGateCli.js');
const read = name => JSON.parse(fs.readFileSync(path.join(process.env.RUNNER_TEMP, name), 'utf8'));
void (async () => {
  const raw = process.env.REVIEWED_EVIDENCE;
  if (!raw || Buffer.byteLength(raw) > 262144) throw new Error('MISSING_EVIDENCE');
  const evidencePath = path.join(process.env.RUNNER_TEMP, 'schema-evidence.json');
  fs.writeFileSync(evidencePath, raw, { flag: 'wx', mode: 0o600 });
  const evidence = JSON.parse(raw);
  // Offline verification only; no connection flag, Keychain, dotenv or login.
  await cli.runDeploymentGate(['verify', '--evidence', evidencePath, '--confirm-evidence', process.env.EVIDENCE_SHA256 || '',
    '--snapshot', 'ops/production-schema.snapshot.json', '--release-sha', process.env.RELEASE_SHA || '',
    '--r2-account', evidence.media?.accountId || '', '--r2-bucket', evidence.media?.bucket || '',
    '--review-mode', process.env.REVIEW_MODE || '']);
  review.requireDeploymentDispatch({ repository: process.env.GITHUB_REPOSITORY, actor: process.env.GITHUB_ACTOR,
    event: process.env.GITHUB_EVENT_NAME, ref: process.env.GITHUB_REF, workflowSha: process.env.GITHUB_SHA,
    releaseSha: process.env.RELEASE_SHA, runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT }, evidence.reviewPolicy);
  gate.requireProductionEnvironment(read('production-environment.json'), read('production-branches.json'), evidence.reviewPolicy);
  gate.requireDeploymentQuality(read('quality-run.json'), read('quality-jobs.json'), process.env.RELEASE_SHA, read('current-main.json'));
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Review policy: ${evidence.reviewPolicy.mode}. Solo risk accepted: ${evidence.reviewPolicy.soloRiskAccepted}. R2 privacy receipt: operator-attested, not a live provider probe. No deployment performed by this check.\n`);
})().catch(() => { process.stderr.write('PRODUCTION_CI_GATE_REJECTED_NO_DETAILS_LOGGED\n'); process.exitCode = 1; });
