import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDirectory, '..');
const fixturePath = path.join(scriptDirectory, 'fixtures', 'class-options-response.json');
process.env.TSX_TSCONFIG_PATH = path.join(frontendRoot, 'tsconfig.app.json');

const { decodeClassOptions } = await import(
  pathToFileURL(path.join(frontendRoot, 'src/features/classes/api/classes.responses.ts')).href,
);

const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const classOptions = decodeClassOptions(fixture);
if (classOptions.length === 0) {
  throw new Error('Class options fixture must contain at least one option.');
}
for (const option of classOptions) {
  const keys = Object.keys(option).sort();
  const expectedKeys = ['id', 'nama_kelas', 'tingkat'];
  if (keys.join('|') !== expectedKeys.join('|')) {
    throw new Error(`Class selector projection changed unexpectedly: received ${keys.join(', ')}.`);
  }
}

console.log(`Class options contract passed: ${classOptions.length} fixture option(s) decoded by the frontend schema.`);
