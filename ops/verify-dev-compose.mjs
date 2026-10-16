import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

export function createValidationInput(source) {
  const privateEnvReference = '      - ./backend/.env.development';
  if (source.split(privateEnvReference).length !== 2) throw new Error('DEV_ENV_REFERENCE_CHANGED');
  // CI cannot possess this private file. Only its reference changes, in memory.
  return source.replace(privateEnvReference, '      - /dev/null');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const source = readFileSync(resolve(root, 'docker-compose.dev.yml'), 'utf8');
  const result = spawnSync('docker', [
    'compose', '--env-file', '/dev/null', '--project-directory', root,
    '--project-name', 'sinegasi-dev-validation', '-f', '-', 'config', '--no-env-resolution', '--quiet',
  ], {
    cwd: root, input: createValidationInput(source), encoding: 'utf8', timeout: 15_000,
    env: { PATH: process.env.PATH, HOME: process.env.HOME, DEV_TRUST_PROXY_ADDRESSES: '192.0.2.10' },
  });
  if (result.error || result.status !== 0) {
    console.error(result.error?.code === 'ENOENT' ? 'DOCKER_CLI_REQUIRED' : 'DEV_COMPOSE_VALIDATION_FAILED');
    process.exit(1);
  }
  console.log('DEV Compose validation passed with synthetic metadata; private env files were not read.');
}
