import type { Plugin } from 'vite';
import { PRODUCTION_HEADERS } from './productionHeaders.ts';

const PRODUCTION_API = 'https://api.sinegasi.pictures';

function httpsUrl(value: string | undefined): URL {
  if (!value || value.trim() !== value) throw new Error('PRODUCTION_EXPLICIT_HTTPS_CONFIGURATION_REQUIRED');
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('PRODUCTION_EXPLICIT_HTTPS_CONFIGURATION_REQUIRED'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash
    || !/^[a-z0-9][a-z0-9.-]*\.[a-z][a-z0-9-]*$/.test(url.hostname)
    || /\.(localhost|local|internal)$/.test(url.hostname)) {
    throw new Error('PRODUCTION_EXPLICIT_HTTPS_CONFIGURATION_REQUIRED');
  }
  return url;
}

/** Explicit launch mode only: Vite's ordinary production mode is also used by DEV Pages. */
export function validateProductionBuild(environment: Readonly<Record<string, string | undefined>>): void {
  const api = environment.VITE_API_URL;
  const url = httpsUrl(api);
  if (url.origin !== PRODUCTION_API || !['/', '/api', '/api/'].includes(url.pathname)
    || environment.VITE_API_BASE_URL !== undefined && environment.VITE_API_BASE_URL !== api) {
    throw new Error('PRODUCTION_API_TARGET_MISMATCH');
  }
  if (environment.VITE_MEDIA_ACCESS_MODE !== 'authenticated-proxy'
      || environment.VITE_R2_PUBLIC_DOMAIN?.trim()
      || Object.entries(environment).some(([key, value]) => /(?:R2.*(?:ACCESS_KEY|SECRET)|SUPABASE.*(?:SERVICE_ROLE|SECRET))/i.test(key) && Boolean(value))) {
    throw new Error('PRODUCTION_PRIVATE_MEDIA_CONFIGURATION_REQUIRED');
  }
}

export function productionBuildGate(): Plugin {
  let launchBuild = false;
  return {
    name: 'sinegasi-production-build-gate',
    configResolved(config) {
      launchBuild = config.command === 'build' && config.mode === 'production-launch';
      if (launchBuild) {
        validateProductionBuild(config.env);
      }
    },
    generateBundle() {
      if (launchBuild) this.emitFile({ type: 'asset', fileName: '_headers', source: PRODUCTION_HEADERS });
    },
  };
}
