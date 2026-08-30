import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migratedServices = [
  'src/features/auth/api/auth.service.ts',
  'src/features/contests/api/contests.service.ts',
  'src/features/dashboard/api/dashboard.service.ts',
];

const uncheckedGenericCall = /apiClient\.(get|post|put|patch|delete)<[^>\n]+>/g;
const violations = [];

for (const relativePath of migratedServices) {
  const filePath = resolve(relativePath);
  const source = readFileSync(filePath, 'utf8');
  if (uncheckedGenericCall.test(source)) {
    violations.push(relativePath);
  }
  uncheckedGenericCall.lastIndex = 0;
}

if (violations.length > 0) {
  console.error('API boundary guard failed: gunakan response decoder untuk:');
  for (const filePath of violations) console.error('- ' + filePath);
  process.exit(1);
}

console.log('API boundary guard passed (' + migratedServices.length + ' migrated services).');
