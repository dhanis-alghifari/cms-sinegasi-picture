import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { build } from 'vite';

const frontendDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('two Pages builds keep old page, modal, and preload assets on their original deployment', async () => {
  const previousPages = process.env.CF_PAGES;
  const previousUrl = process.env.CF_PAGES_URL;
  const deploymentUrls = [
    'https://aaaaaaaa.sinegasi-picture-develop-cms.pages.dev',
    'https://bbbbbbbb.sinegasi-picture-develop-cms.pages.dev',
  ];

  try {
    process.env.CF_PAGES = '1';
    const deployments = [];
    for (const url of deploymentUrls) {
      process.env.CF_PAGES_URL = url;
      const result = await build({
        root: frontendDirectory,
        configFile: resolve(frontendDirectory, 'vite.config.ts'),
        envFile: false,
        logLevel: 'silent',
        build: { write: false },
      });
      assert.ok('output' in result, 'Expected one client build, not watch mode');
      const html = result.output.find((asset) => asset.fileName === 'index.html');
      assert.ok(html?.type === 'asset');
      const markup = String(html.source);
      const entryUrl = markup.match(/<script[^>]+src="([^"]+)"/)?.[1];
      assert.ok(entryUrl?.startsWith(`${url}/assets/`), 'Entry script must use the immutable origin');
      assert.ok(markup.includes(`href="${url}/assets/`), 'Styles and modulepreloads must also be pinned');
      deployments.push({ url, entryUrl, output: result.output });
    }

    const [oldDeployment, newDeployment] = deployments;
    assert.notEqual(oldDeployment.entryUrl, newDeployment.entryUrl);
    const oldFiles = new Set(oldDeployment.output.map((asset) => asset.fileName));
    const newFiles = new Set(newDeployment.output.map((asset) => asset.fileName));
    const entry = oldDeployment.output.find((asset) => `${oldDeployment.url}/${asset.fileName}` === oldDeployment.entryUrl);
    assert.ok(entry?.type === 'chunk');
    assert.ok(entry.code.includes(`${oldDeployment.url}/`), 'Vite preload helper must use the same deployment');

    for (const name of ['CashPage', 'StudentsPage', 'FastCashInModal', 'StudentDisputeModal']) {
      const chunk = oldDeployment.output.find((asset) => asset.type === 'chunk' && asset.name === name);
      assert.ok(chunk, `${name} must remain a separate lazy chunk`);
      assert.equal(newFiles.has(chunk.fileName), false, 'New alias cannot serve this old chunk');
      assert.equal(oldFiles.has(chunk.fileName), true, 'Original deployment still contains the chunk');
    }

    let verifiedImports = 0;
    for (const asset of oldDeployment.output) {
      if (asset.type !== 'chunk') continue;
      const moduleUrl = `${oldDeployment.url}/${asset.fileName}`;
      for (const match of asset.code.matchAll(/["'](\.\.?\/[^"']+\.js)["']/g)) {
        const importedUrl = new URL(match[1], moduleUrl);
        assert.equal(importedUrl.origin, oldDeployment.url);
        assert.ok(oldFiles.has(importedUrl.pathname.slice(1)), `Missing old dependency: ${match[1]}`);
        verifiedImports += 1;
      }
    }
    assert.ok(verifiedImports > 100, 'Verify the built dependency graph, not only entry URLs');
  } finally {
    if (previousPages === undefined) delete process.env.CF_PAGES;
    else process.env.CF_PAGES = previousPages;
    if (previousUrl === undefined) delete process.env.CF_PAGES_URL;
    else process.env.CF_PAGES_URL = previousUrl;
  }
});
