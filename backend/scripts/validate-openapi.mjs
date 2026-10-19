import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot = fileURLToPath(new URL('../src/modules/', import.meta.url));
const openApiPath = fileURLToPath(new URL('../docs/openapi.yaml', import.meta.url));
// Include simple typed route calls such as post<{ Body: DiagnosticReport }>(...).
const routePattern = /fastify\.(get|post|put|patch|delete)(?:<[^<>]*>)?\(\s*['"]([^'"]+)['"]/g;
const methodNames = new Set(['get', 'post', 'put', 'patch', 'delete']);

function normalizePath(path) {
  return path
    .replace(/:([A-Za-z0-9_]+)/g, '{$1}')
    .replace(/\/\*([A-Za-z0-9_]*)/g, '{$1wildcard}');
}

function collectOpenApiOperations(source) {
  const operations = new Set();
  let currentPath = null;
  for (const line of source.split('\n')) {
    const pathMatch = line.match(/^  (\/[^:]+):\s*$/);
    if (pathMatch) {
      currentPath = pathMatch[1];
      continue;
    }
    const methodMatch = line.match(/^    (get|post|put|patch|delete):\s*$/);
    if (currentPath && methodMatch && methodNames.has(methodMatch[1])) {
      operations.add(`${methodMatch[1].toUpperCase()} ${currentPath}`);
    }
  }
  return operations;
}

async function collectRouteFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectRouteFiles(path));
    if (entry.isFile() && entry.name.endsWith('.routes.ts')) files.push(path);
  }
  return files;
}

const routeFiles = await collectRouteFiles(sourceRoot);
const sourceOperations = new Set();
for (const file of routeFiles) {
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(routePattern)) {
    sourceOperations.add(`${match[1].toUpperCase()} ${normalizePath(match[2])}`);
  }
}
const openApi = await readFile(openApiPath, 'utf8');
const documentedOperations = collectOpenApiOperations(openApi);

const missingFromDocs = [...sourceOperations].filter((operation) => !documentedOperations.has(operation)).sort();
const staleDocs = [...documentedOperations].filter((operation) => !sourceOperations.has(operation)).sort();

if (missingFromDocs.length > 0 || staleDocs.length > 0) {
  console.error('OpenAPI parity failed.');
  if (missingFromDocs.length > 0) console.error(`Missing from docs:\n- ${missingFromDocs.join('\n- ')}`);
  if (staleDocs.length > 0) console.error(`Stale docs entries:\n- ${staleDocs.join('\n- ')}`);
  process.exit(1);
}

console.log(`OpenAPI parity passed: ${sourceOperations.size} operations and paths documented.`);
