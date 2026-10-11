import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { resolveAssetBase } from '../config/assetBase';
import { AppErrorFallback } from '../src/app/components/AppErrorFallback';
import { isModuleLoadError } from '../src/app/components/isModuleLoadError';
import { RootErrorBoundary } from '../src/app/components/RootErrorBoundary';
import { RouteErrorBoundary } from '../src/app/router/RouteErrorBoundary';

const deploymentUrl = 'https://67687dee.sinegasi-picture-develop-cms.pages.dev';

test('local builds and the dev server keep same-origin assets', () => {
  assert.equal(resolveAssetBase('build', {}), '/');
  assert.equal(resolveAssetBase('build', { CF_PAGES_URL: deploymentUrl }), '/');
  assert.equal(resolveAssetBase('serve', { CF_PAGES: '1', CF_PAGES_URL: deploymentUrl }), '/');
});

test('Pages builds pin assets to the immutable deployment URL', () => {
  for (const url of [deploymentUrl, `${deploymentUrl}/`, ` ${deploymentUrl} `]) {
    assert.equal(resolveAssetBase('build', { CF_PAGES: '1', CF_PAGES_URL: url }), `${deploymentUrl}/`);
  }
});

test('Pages builds fail clearly instead of silently using a moving alias', () => {
  for (const url of [
    undefined, '',
    'https://sinegasi-picture-develop-cms.pages.dev',
    'https://develop.sinegasi-picture-develop-cms.pages.dev',
    deploymentUrl.replace('https:', 'http:'),
    `${deploymentUrl}.example.com`,
    `${deploymentUrl}/assets`,
    `${deploymentUrl}?token=secret`,
    deploymentUrl.replace('https://', 'https://user:password@'),
  ]) {
    assert.throws(
      () => resolveAssetBase('build', { CF_PAGES: '1', CF_PAGES_URL: url }),
      /CF_PAGES_URL must be the hash-based HTTPS deployment URL/,
    );
  }
});

test('module load errors are recognized across browsers and CSS preloads', () => {
  for (const message of [
    'Failed to fetch dynamically imported module: https://example.com/assets/page-old.js',
    'error loading dynamically imported module: https://example.com/assets/page-old.js',
    'Importing a module script failed.',
    'Unable to preload CSS for https://example.com/assets/page-old.css',
  ]) {
    assert.equal(isModuleLoadError(new TypeError(message)), true);
    assert.equal(isModuleLoadError({ message }), true);
  }
});

test('API failures and programming errors are not misreported as chunk failures', () => {
  for (const error of [undefined, null, 'error', {}, { message: 42 }, new Error('Failed to fetch'), new Error('FORBIDDEN')]) {
    assert.equal(isModuleLoadError(error), false);
  }
});

test('recovery renders without reloading and does not expose internal error details', () => {
  // No window exists in this test. Rendering must never initiate a reload.
  const markup = renderToStaticMarkup(createElement(AppErrorFallback, { error: new TypeError('Importing a module script failed.') }));
  assert.match(markup, /Bagian aplikasi gagal dimuat/);
  assert.match(markup, /Muat ulang halaman/);
  assert.match(markup, /Data yang belum disimpan dapat hilang/);
  assert.match(markup, /role="alert"/);
  assert.doesNotMatch(markup, /Importing a module script failed/);

  const generic = renderToStaticMarkup(createElement(AppErrorFallback, { error: new Error('private implementation detail') }));
  assert.match(generic, /Aplikasi mengalami gangguan/);
  assert.doesNotMatch(generic, /private implementation detail|versi aplikasi terbaru/);
});

test('root boundary retains the original error for module-specific recovery', () => {
  const boundary = new RootErrorBoundary({ children: createElement('p', null, 'Application') });
  assert.match(renderToStaticMarkup(boundary.render()), /Application/);
  boundary.state = RootErrorBoundary.getDerivedStateFromError(new TypeError('Importing a module script failed.'));
  assert.match(renderToStaticMarkup(boundary.render()), /Bagian aplikasi gagal dimuat/);
  boundary.state = RootErrorBoundary.getDerivedStateFromError(null);
  assert.match(renderToStaticMarkup(boundary.render()), /Aplikasi mengalami gangguan/);
});

test('route-level chunk failures render recovery instead of the default error screen', () => {
  const router = createMemoryRouter([
    {
      id: 'application',
      errorElement: createElement(RouteErrorBoundary),
      children: [{ path: '/cash', element: createElement('p', null, 'Cash page') }],
    },
  ], {
    initialEntries: ['/cash'],
    hydrationData: {
      loaderData: {},
      errors: { application: new TypeError('Failed to fetch dynamically imported module: /assets/modal-old.js') },
    },
  });
  try {
    const markup = renderToStaticMarkup(createElement(RouterProvider, { router }));
    assert.match(markup, /Bagian aplikasi gagal dimuat/);
    assert.doesNotMatch(markup, /Unexpected Application Error|modal-old.js/);
  } finally {
    router.dispose();
  }
});
