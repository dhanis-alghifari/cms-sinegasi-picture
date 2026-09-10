import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDirectory, '..');
process.env.TSX_TSCONFIG_PATH = path.join(frontendRoot, 'tsconfig.app.json');

const { decodeClassOptions } = await import(
  pathToFileURL(path.join(frontendRoot, 'src/features/classes/api/classes.responses.ts')).href,
);

const apiBaseUrl = process.env.API_URL ?? 'http://localhost:5001';
const response = await fetch(`${apiBaseUrl}/api/options/kelas`);
if (!response.ok) {
  throw new Error(`Class options route returned HTTP ${response.status}.`);
}

const classOptions = decodeClassOptions(await response.json());
for (const option of classOptions) {
  const keys = Object.keys(option).sort();
  const expectedKeys = ['id', 'nama_kelas', 'tingkat'];
  if (keys.join('|') !== expectedKeys.join('|')) {
    throw new Error(`Class selector projection changed unexpectedly: received ${keys.join(', ')}.`);
  }
}

console.log(`Class options contract passed: ${classOptions.length} option(s) decoded by the frontend schema.`);
