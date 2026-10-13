import { readR2KeychainCredential, R2_CONNECTION_BUCKET } from './productionR2ConnectionCore.js';
import {
  createR2CustodyReceiver, parseR2CustodyCommand, provisionR2Custody, r2CustodyFailure,
  r2CustodyPlan, requireCustodyPreflight, type R2CustodyState,
} from './productionR2CustodyCore.js';

async function main(): Promise<void> {
  const state: R2CustodyState = { inspectionAttempts: 0, keychainReadsAttempted: 0, transferAttempts: 0, transferAcknowledged: false };
  try {
    const action = parseR2CustodyCommand(process.argv.slice(2), process.env);
    if (action === 'plan') { console.log(JSON.stringify(r2CustodyPlan())); return; }
    if (process.platform !== 'darwin') throw new Error('Use the approved Mac');
    const receiver = await createR2CustodyReceiver();
    if (action === 'inspect') {
      state.inspectionAttempts += 1;
      const result = await receiver('inspect', Buffer.alloc(0));
      requireCustodyPreflight(result);
      console.log(JSON.stringify({ ...r2CustodyPlan(), status: 'PRODUCTION_R2_CUSTODY_DESTINATION_INSPECTED', ...state, networkAccessed: true }));
      return;
    }
    const result = await provisionR2Custody(async (service) => {
      console.log(JSON.stringify({ stage: 'R2_CUSTODY_KEYCHAIN_ALLOW_REQUIRED', service,
        account: R2_CONNECTION_BUCKET, destination: r2CustodyPlan().destination, secretValuesPrinted: false }));
      return readR2KeychainCredential(service);
    }, receiver, state);
    console.log(JSON.stringify(result));
  } catch (error: unknown) {
    console.error(JSON.stringify(r2CustodyFailure(error, state)));
    process.exitCode = 1;
  }
}

void main();
