import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, normalize } from 'node:path';
import { authRequire, AuthExecutorError } from './productionAuthExecutorCore.js';

/** Exclusive, durable, never overwritten or deleted, including ambiguous/failed requests.
 * A partial file also blocks replay; only an operator may reconcile it later.
 */
export async function persistAuthCustody(file: string, value: Record<string, unknown>): Promise<void> {
  authRequire(isAbsolute(file) && normalize(file) === file && file.endsWith('.json') && !file.includes('\0'), 'AUTH_CUSTODY_PATH_INVALID');
  const directory = dirname(file), stat = await lstat(directory);
  authRequire(stat.isDirectory() && !stat.isSymbolicLink() && stat.uid === process.getuid?.()
    && (stat.mode & 0o777) === 0o700 && await realpath(directory) === directory, 'AUTH_CUSTODY_PRIVATE_DIRECTORY_REQUIRED');
  const directoryHandle = await open(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(file, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    const info = await handle.stat();
    authRequire(info.isFile() && info.nlink === 1 && info.uid === process.getuid?.() && (info.mode & 0o777) === 0o600,
      'AUTH_CUSTODY_PRIVATE_FILE_REQUIRED');
    await handle.writeFile(JSON.stringify(value, null, 2) + '\n', 'utf8'); await handle.sync(); await directoryHandle.sync();
  } catch { throw new AuthExecutorError('AUTH_CUSTODY_WRITE_FAILED_OR_EXISTING_ATTEMPT_INSPECT_REQUIRED'); }
  finally { await handle?.close(); await directoryHandle.close(); }
}
