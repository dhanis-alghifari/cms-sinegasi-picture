import { existsSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const configuredDistDirectory = process.env.FRONTEND_DIST_DIR?.trim();
const distDirectory = configuredDistDirectory
  ? resolve(configuredDistDirectory)
  : join(projectRoot, 'dist');
const manifestPath = join(distDirectory, '.vite', 'manifest.json');
const kilobyte = 1000;

// Targets remain the optimization goal. Hard caps reflect the verified current
// branch baseline, leaving a small regression margin while optimization is pending.
const budgets = {
  initialJs: { target: 200 * kilobyte, hard: 220 * kilobyte },
  initialCss: { target: 30 * kilobyte, hard: 35 * kilobyte },
  routeJs: { target: 80 * kilobyte, hard: 130 * kilobyte },
  coldRouteJs: { target: 250 * kilobyte, hard: 325 * kilobyte },
};

if (!existsSync(manifestPath)) {
  console.error('Bundle budget gagal: manifest belum tersedia. Jalankan npm run build terlebih dahulu.');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const entry = manifest['index.html'];

if (!entry?.file) {
  console.error('Bundle budget gagal: entry index.html tidak ditemukan di manifest.');
  process.exit(1);
}

function getAssetPath(assetPath) {
  const absolutePath = resolve(distDirectory, assetPath);
  const relativePath = relative(distDirectory, absolutePath);

  if (isAbsolute(relativePath) || relativePath.startsWith(`..${sep}`)) {
    throw new Error(`Asset manifest berada di luar dist: ${assetPath}`);
  }

  return absolutePath;
}

function getManifestAssetPath(manifestKey) {
  const asset = manifest[manifestKey];
  if (!asset?.file) {
    throw new Error(`Asset manifest tidak ditemukan: ${manifestKey}`);
  }

  return getAssetPath(asset.file);
}

function gzipBytes(filePath) {
  return gzipSync(readFileSync(filePath)).length;
}

function collectStaticImports(manifestKey, visited = new Set()) {
  if (visited.has(manifestKey)) return visited;

  const asset = manifest[manifestKey];
  if (!asset) throw new Error(`Static import tidak ditemukan: ${manifestKey}`);

  visited.add(manifestKey);
  for (const importKey of asset.imports ?? []) {
    collectStaticImports(importKey, visited);
  }

  return visited;
}

function sumGzipBytes(manifestKeys) {
  return [...manifestKeys].reduce((total, key) => total + gzipBytes(getManifestAssetPath(key)), 0);
}

function formatKilobytes(bytes) {
  return `${(bytes / kilobyte).toFixed(1)} KB`;
}

const violations = [];
const warnings = [];

function reportBudget(label, actualBytes, budget) {
  const actual = formatKilobytes(actualBytes);
  const target = formatKilobytes(budget.target);
  const hard = formatKilobytes(budget.hard);

  if (actualBytes > budget.hard) {
    violations.push(`${label} ${actual} melewati hard cap ${hard}`);
    console.log(`FAIL  ${label}: ${actual} / hard ${hard} (target ${target})`);
  } else if (actualBytes > budget.target) {
    warnings.push(`${label} ${actual} melewati target ${target}`);
    console.log(`WARN  ${label}: ${actual} / target ${target}, hard ${hard}`);
  } else {
    console.log(`PASS  ${label}: ${actual} / target ${target}`);
  }
}

const initialJavaScript = collectStaticImports('index.html');
const initialJsBytes = sumGzipBytes(initialJavaScript);
const initialCssBytes = (entry.css ?? [])
  .reduce((total, cssFile) => total + gzipBytes(getAssetPath(cssFile)), 0);
const dynamicEntryKeys = entry.dynamicImports ?? [];
const dashboardLayoutKey = dynamicEntryKeys.find((key) => key.includes('/app/layouts/DashboardLayout.tsx'));
const dashboardLayoutAssets = dashboardLayoutKey
  ? collectStaticImports(dashboardLayoutKey)
  : new Set();

console.log('Bundle budget report');
console.log(`Initial JS chunks: ${initialJavaScript.size}`);
reportBudget('Initial JS gzip', initialJsBytes, budgets.initialJs);
reportBudget('Initial CSS gzip', initialCssBytes, budgets.initialCss);

if (dashboardLayoutKey) {
  const layoutOnlyAssets = new Set([...dashboardLayoutAssets].filter((key) => !initialJavaScript.has(key)));
  reportBudget('Dashboard layout JS gzip', sumGzipBytes(layoutOnlyAssets), budgets.routeJs);
}

for (const routeKey of dynamicEntryKeys.filter((key) => key.includes('/pages/'))) {
  const routeAssets = collectStaticImports(routeKey);
  const routeOnlyAssets = new Set([...routeAssets].filter((key) => !initialJavaScript.has(key)));
  const routeJsBytes = sumGzipBytes(routeOnlyAssets);
  const routeName = manifest[routeKey]?.name ?? routeKey;
  const isProtectedRoute = !routeKey.includes('/features/auth/');
  const coldRouteAssets = new Set(routeAssets);

  if (isProtectedRoute) {
    for (const assetKey of dashboardLayoutAssets) coldRouteAssets.add(assetKey);
  }

  const coldRouteOnlyAssets = new Set([...coldRouteAssets].filter((key) => !initialJavaScript.has(key)));

  reportBudget(`${routeName} route JS gzip`, routeJsBytes, budgets.routeJs);
  reportBudget(`${routeName} cold JS gzip`, initialJsBytes + sumGzipBytes(coldRouteOnlyAssets), budgets.coldRouteJs);
}

console.log(`Summary: ${violations.length} hard violation(s), ${warnings.length} target warning(s)`);

if (violations.length > 0) {
  process.exit(1);
}
