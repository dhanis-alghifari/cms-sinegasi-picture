import { constants } from 'node:fs';
import { lstat, open, realpath, unlink } from 'node:fs/promises';
import path from 'node:path';
import { BootstrapTeacherError, type BootstrapCredentialStore } from './bootstrapTeacherCore.js';

async function ensureOutsideRepository(directory: string): Promise<void> {
  let current = directory;
  while (true) {
    try {
      await lstat(path.join(current, '.git'));
      throw new BootstrapTeacherError('BOOTSTRAP_CREDENTIAL_FILE_IN_REPOSITORY');
    } catch (error: unknown) {
      if (error instanceof BootstrapTeacherError) throw error;
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const parent = path.dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

/** Requires an existing private directory; never overwrites a file or follows symlinks. */
export function privateBootstrapCredentialStore(filePath: string): BootstrapCredentialStore {
  return {
    async create(credential) {
      if (!path.isAbsolute(filePath) || path.extname(filePath) !== '.json' || path.normalize(filePath) !== filePath) {
        throw new BootstrapTeacherError('BOOTSTRAP_CREDENTIAL_PATH_INVALID');
      }
      const directory = path.dirname(filePath);
      const uid = process.getuid?.();
      const directoryStat = await lstat(directory);
      if (uid === undefined || !directoryStat.isDirectory() || directoryStat.isSymbolicLink()
          || directoryStat.uid !== uid || (directoryStat.mode & 0o077) !== 0
          || await realpath(directory) !== directory) {
        throw new BootstrapTeacherError('BOOTSTRAP_CREDENTIAL_DIRECTORY_NOT_PRIVATE');
      }
      await ensureOutsideRepository(directory);
      const directoryHandle = await open(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      let fileHandle: Awaited<ReturnType<typeof open>> | undefined;
      let ownedFile: { dev: number; ino: number } | undefined;
      const removeOwnedFile = async (): Promise<void> => {
        if (!ownedFile) return;
        const current = await lstat(filePath);
        if (current.isSymbolicLink() || current.dev !== ownedFile.dev || current.ino !== ownedFile.ino) {
          throw new BootstrapTeacherError('BOOTSTRAP_CREDENTIAL_FILE_CHANGED');
        }
        await unlink(filePath);
        await directoryHandle.sync();
      };
      try {
        fileHandle = await open(filePath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
        const fileStat = await fileHandle.stat();
        ownedFile = { dev: fileStat.dev, ino: fileStat.ino };
        if (!fileStat.isFile() || fileStat.uid !== uid || (fileStat.mode & 0o777) !== 0o600) {
          throw new BootstrapTeacherError('BOOTSTRAP_CREDENTIAL_FILE_NOT_PRIVATE');
        }
        await fileHandle.writeFile(`${JSON.stringify(credential, null, 2)}\n`, 'utf8');
        await fileHandle.sync();
        await directoryHandle.sync();
        await fileHandle.close();
        fileHandle = undefined;
      } catch {
        await fileHandle?.close().catch(() => undefined);
        try { await removeOwnedFile(); }
        catch {
          await directoryHandle.close();
          throw new BootstrapTeacherError('BOOTSTRAP_CREDENTIAL_CLEANUP_FAILED');
        }
        await directoryHandle.close();
        throw new BootstrapTeacherError('BOOTSTRAP_CREDENTIAL_FILE_WRITE_FAILED');
      }
      await directoryHandle.close();
      return {
        async remove() {
          const current = await lstat(filePath);
          if (current.isSymbolicLink() || current.dev !== ownedFile?.dev || current.ino !== ownedFile.ino) {
            throw new BootstrapTeacherError('BOOTSTRAP_CREDENTIAL_FILE_CHANGED');
          }
          await unlink(filePath);
        },
      };
    },
  };
}
