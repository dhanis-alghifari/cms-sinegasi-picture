import { parseArgs } from 'node:util';
import path from 'node:path';
import { Client } from 'pg';
import { buildMigrationConnectionConfig } from './migrationSafety.js';
import {
  bootstrapFirstTeacher, BootstrapTeacherError,
  validateBootstrapTeacherOptions, type BootstrapTeacherOptions,
} from './bootstrapTeacherCore.js';
import { privateBootstrapCredentialStore } from './bootstrapTeacherCredentials.js';

const USAGE = `Bootstrap first Guru (teacher); no Supabase Auth account is created.
Default: offline dry-run, no connection, account or credential file.

node dist/scripts/bootstrapTeacher.js --project-ref <ref> --username <username> --name <official-name>
Remote apply is disabled here. Use productionBootstrapTeacher.ts with reviewed approval.
Isolated loopback apply additionally requires --local and:
  --apply --confirm-project <same-ref> --credential-file <absolute-private-path.json>
  BOOTSTRAP_DATABASE_URL supplied through a private environment, never CLI arguments.
Use --local only for isolated loopback rehearsal; it rejects remote connections.
Do not apply until migrations, backup/restore proof and production approval are verified.
Credential directory must already exist, owned by the caller with no group/other permissions,
outside any Git repository. The credential file is created exclusively with mode 0600.
Never print, commit, upload or paste the file; deliver through an approved private channel.`;

export interface BootstrapTeacherCommand {
  options: BootstrapTeacherOptions;
  credentialFile?: string;
  local: boolean;
  help: boolean;
}

export function parseBootstrapTeacherCommand(args: string[]): BootstrapTeacherCommand {
  try {
    const { values } = parseArgs({ args, strict: true, allowPositionals: false, options: {
      'project-ref': { type: 'string' }, username: { type: 'string' }, name: { type: 'string' },
      'credential-file': { type: 'string' }, 'confirm-project': { type: 'string' },
      apply: { type: 'boolean' }, 'dry-run': { type: 'boolean' }, local: { type: 'boolean' },
      help: { type: 'boolean' },
    } });
    if (values.apply && values['dry-run']) throw new BootstrapTeacherError('BOOTSTRAP_MODE_CONFLICT');
    const options: BootstrapTeacherOptions = {
      projectRef: values['project-ref'] ?? '', username: values.username ?? '',
      nama: values.name ?? '', apply: values.apply === true, confirmProject: values['confirm-project'],
    };
    if (!values.help) validateBootstrapTeacherOptions(options);
    const credentialFile = values['credential-file'];
    if (options.apply && (!credentialFile || !path.isAbsolute(credentialFile)
        || path.normalize(credentialFile) !== credentialFile || path.extname(credentialFile) !== '.json')) {
      throw new BootstrapTeacherError('BOOTSTRAP_CREDENTIAL_PATH_INVALID');
    }
    return { options, credentialFile, local: values.local === true, help: values.help === true };
  } catch (error: unknown) {
    if (error instanceof BootstrapTeacherError) throw error;
    // parseArgs errors echo input values; do not propagate them.
    throw new BootstrapTeacherError('BOOTSTRAP_ARGUMENTS_INVALID');
  }
}

export async function mainBootstrapTeacher(args = process.argv.slice(2)): Promise<void> {
  const command = parseBootstrapTeacherCommand(args);
  if (command.help) { console.log(USAGE); return; }
  if (!command.options.apply) {
    console.log(JSON.stringify({ mode: 'dry-run', role: 'teacher', isFirstLogin: true, databaseChecked: false }));
    return;
  }
  // No environment switch/checksum-less legacy route may bypass the production gate.
  if (!command.local) throw new BootstrapTeacherError('USE_REVIEWED_PRODUCTION_BOOTSTRAP_RUNNER');
  const databaseUrl = process.env.BOOTSTRAP_DATABASE_URL;
  if (!databaseUrl) throw new BootstrapTeacherError('BOOTSTRAP_DATABASE_URL_REQUIRED');
  const client = new Client(buildMigrationConnectionConfig(databaseUrl, command.options.projectRef, command.local));
  try {
    await client.connect();
    const result = await bootstrapFirstTeacher(command.options, {
      database: { async query(sql, values) {
        const query = await client.query<Record<string, unknown>>(sql, values ? [...values] : undefined);
        return { rows: query.rows };
      } },
      credentials: privateBootstrapCredentialStore(command.credentialFile as string),
    });
    console.log(JSON.stringify(result));
  } finally {
    await client.end().catch(() => undefined);
  }
}

if (typeof require !== 'undefined' && require.main === module) {
  void mainBootstrapTeacher().catch((error: unknown) => {
    console.error(error instanceof BootstrapTeacherError ? error.code : 'BOOTSTRAP_FAILED');
    process.exitCode = 1;
  });
}
