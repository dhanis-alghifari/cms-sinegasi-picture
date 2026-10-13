const fs = require('node:fs');
const path = require('node:path');
const { readGateDocument } = require('../backend/dist/scripts/productionDeploymentGateCli.js');
const { validateDeploymentReleaseArtifact } = require('../backend/dist/scripts/productionDeploymentReview.js');
const read = name => JSON.parse(fs.readFileSync(path.join(process.env.RUNNER_TEMP, name), 'utf8'));
void (async () => {
  validateDeploymentReleaseArtifact(await readGateDocument('production-release.json', false), {
    format: 1, releaseSha: process.env.RELEASE_SHA || '', buildRunId: process.env.BUILD_RUN_ID || '',
    image: process.env.IMAGE_DIGEST || '', packageSha256: process.env.PACKAGE_CHECKSUM || '', evidenceSha256: process.env.EVIDENCE_SHA256 || '',
  }, read('production-build-run.json'), read('production-build-jobs.json'));
})().catch(() => { process.stderr.write('PRODUCTION_ARTIFACT_GATE_REJECTED_NO_DETAILS_LOGGED\n'); process.exitCode = 1; });
