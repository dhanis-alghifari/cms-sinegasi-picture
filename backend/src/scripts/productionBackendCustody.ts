import {
  backendCustodyFailure, backendCustodyPlan, createBackendCustodyReceiver, parseBackendCustodyCommand,
  provisionBackendCustody, readBackendCustodyCredential, requireBackendCustodyPreflight, type BackendCustodyState,
} from './productionBackendCustodyCore.js';

async function main(): Promise<void> {
  const state: BackendCustodyState = { inspectionAttempts: 0, keychainReadsAttempted: 0, transferAttempts: 0, transferAcknowledged: false };
  try {
    const action = parseBackendCustodyCommand(process.argv.slice(2), process.env);
    if (action === 'plan') { console.log(JSON.stringify(backendCustodyPlan())); return; }
    if (process.platform !== 'darwin') throw new Error('Use the approved Mac');
    const receiver = await createBackendCustodyReceiver();
    if (action === 'inspect') {
      state.inspectionAttempts++;
      requireBackendCustodyPreflight(await receiver('inspect', Buffer.alloc(0)));
      console.log(JSON.stringify({ ...backendCustodyPlan(), status: 'PRODUCTION_BACKEND_CUSTODY_DESTINATION_INSPECTED',
        ...state, observedAt: new Date().toISOString(), networkAccessed: true }));
      return;
    }
    const result = await provisionBackendCustody(async (item) => {
      console.log(JSON.stringify({ stage: 'BACKEND_CUSTODY_KEYCHAIN_ALLOW_REQUIRED', ...item,
        destination: backendCustodyPlan().destination, secretValuesPrinted: false }));
      return readBackendCustodyCredential(item);
    }, receiver, state);
    console.log(JSON.stringify(result));
  } catch (error: unknown) {
    console.error(JSON.stringify(backendCustodyFailure(error, state)));
    process.exitCode = 1;
  }
}

void main();
