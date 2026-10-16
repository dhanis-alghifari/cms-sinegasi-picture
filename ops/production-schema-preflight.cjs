// One-off candidate image: only explicit private, read-only schema inspection.
const { runDeploymentGate } = require('./dist/scripts/productionDeploymentGateCli.js');
void runDeploymentGate([
  'inspect', '--evidence', '/run/sinegasi-gate/evidence.json',
  '--confirm-evidence', process.env.PRODUCTION_SCHEMA_EVIDENCE_SHA256 || '',
  '--snapshot', '/run/sinegasi-gate/snapshot.json', '--release-sha', process.env.PRODUCTION_RELEASE_SHA || '',
  '--r2-account', process.env.PRODUCTION_R2_ACCOUNT_ID || '', '--r2-bucket', process.env.PRODUCTION_R2_BUCKET || '',
  '--review-mode', process.env.PRODUCTION_REVIEW_MODE || '',
  '--connection', '/run/sinegasi-gate/connection.json',
  '--window-start', process.env.PRODUCTION_WINDOW_START || '', '--window-end', process.env.PRODUCTION_WINDOW_END || '',
]).catch(() => {
  process.stderr.write('[deploy-prod] Read-only schema gate rejected; no database details logged.\n');
  process.exitCode = 1;
});
