import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const featureRouteFiles = readdirSync(resolve('src/features'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => 'src/features/' + entry.name + '/routes.tsx')
  .filter((relativePath) => existsSync(resolve(relativePath)))
  .sort();

const violations = [];

for (const relativePath of featureRouteFiles) {
  const filePath = resolve(relativePath);
  if (!existsSync(filePath)) {
    violations.push(relativePath + ': route file tidak ditemukan');
    continue;
  }

  const source = readFileSync(filePath, 'utf8');
  if (!/\blazy\s*\(/.test(source)) {
    violations.push(relativePath + ': tidak mendefinisikan React.lazy untuk page');
  }
  if (!/\bSuspense\b/.test(source)) {
    violations.push(relativePath + ': tidak memiliki Suspense boundary');
  }
  if (/import\s+(?:\{[^}]+\}|[A-Za-z_$][\w$]*)\s+from\s+['][^']*\/pages\//.test(source)) {
    violations.push(relativePath + ': page masih diimpor secara eager');
  }
}

if (violations.length > 0) {
  console.error('Lazy-loading checks failed:');
  for (const violation of violations) console.error('- ' + violation);
  process.exitCode = 1;
} else {
  console.log('Lazy-loading checks passed for ' + featureRouteFiles.length + ' feature route files.');
}
