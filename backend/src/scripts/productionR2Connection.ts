import {
  R2_CONNECTION_BUCKET, R2_CONNECTION_SERVICES, parseR2ConnectionCommand, r2ConnectionFailure,
  r2ConnectionPlan, readR2KeychainCredential, sendR2HeadBucket, verifyR2Connection,
  type R2ConnectionState,
} from './productionR2ConnectionCore.js';

async function main(): Promise<void> {
  const state: R2ConnectionState = { keychainReadsAttempted: 0, headBucketAttempts: 0 };
  try {
    const mode = parseR2ConnectionCommand(process.argv.slice(2), process.env);
    if (mode === 'plan') {
      console.log(JSON.stringify(r2ConnectionPlan()));
      return;
    }
    const result = await verifyR2Connection(async (service) => {
      console.log(JSON.stringify({ stage: 'R2_KEYCHAIN_ALLOW_REQUIRED', service, account: R2_CONNECTION_BUCKET,
        readOnly: true, allowedServices: R2_CONNECTION_SERVICES, productionChanged: false }));
      return readR2KeychainCredential(service);
    }, sendR2HeadBucket, state);
    console.log(JSON.stringify(result));
  } catch (error: unknown) {
    console.error(JSON.stringify(r2ConnectionFailure(error, state)));
    process.exitCode = 1;
  }
}

void main();
