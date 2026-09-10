import { readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const featuresRoot = resolve('src/features');

function findServiceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = resolve(directory, entry.name);
    if (entry.isDirectory()) return findServiceFiles(filePath);
    return entry.isFile() && entry.name.endsWith('.service.ts') ? [filePath] : [];
  });
}

function findTypeScriptFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = resolve(directory, entry.name);
    if (entry.isDirectory()) return findTypeScriptFiles(filePath);
    return entry.isFile() && /[.]tsx?$/.test(entry.name) ? [filePath] : [];
  });
}

const serviceFiles = findServiceFiles(featuresRoot);
const sourceFiles = findTypeScriptFiles(resolve('src'));

const uncheckedApiCall = /apiClient\.(get|post|put|patch|delete)(?!Parsed)\s*(?:<[^>\n]+>)?\s*\(/g;
const deprecatedZodObjectApi = /[.]passthrough\s*\(/g;
const violations = [];
const deprecatedZodViolations = [];

for (const filePath of serviceFiles) {
  const relativePath = relative(process.cwd(), filePath).replaceAll('\\', '/');
  const source = readFileSync(filePath, 'utf8');
  if (uncheckedApiCall.test(source)) {
    violations.push(relativePath);
  }
  uncheckedApiCall.lastIndex = 0;
}

for (const filePath of sourceFiles) {
  const relativePath = relative(process.cwd(), filePath).replaceAll('\\', '/');
  const source = readFileSync(filePath, 'utf8');
  if (deprecatedZodObjectApi.test(source)) {
    deprecatedZodViolations.push(relativePath);
  }
  deprecatedZodObjectApi.lastIndex = 0;
}

if (violations.length > 0 || deprecatedZodViolations.length > 0) {
  console.error('API boundary guard failed: gunakan response decoder untuk:');
  for (const filePath of violations) console.error('- ' + filePath);
  if (deprecatedZodViolations.length > 0) {
    console.error('Deprecated Zod object API found: gunakan z.looseObject(), .loose(), atau z.strictObject():');
    for (const filePath of deprecatedZodViolations) console.error('- ' + filePath);
  }
  process.exit(1);
}

console.log('API boundary guard passed (' + serviceFiles.length + ' services with runtime decoders).');
