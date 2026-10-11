interface PagesBuildEnvironment {
  CF_PAGES?: string;
  CF_PAGES_URL?: string;
}

export function resolveAssetBase(
  command: 'build' | 'serve',
  environment: PagesBuildEnvironment,
): string {
  if (command !== 'build' || environment.CF_PAGES !== '1') return '/';

  // Pin all generated assets to this immutable deployment, not the moving
  // project/branch alias. Tabs opened before a deploy can still load lazy chunks.
  const deploymentUrl = environment.CF_PAGES_URL?.trim();
  if (!deploymentUrl || !/^https:\/\/[a-f0-9]{8}\.[a-z0-9-]+\.pages\.dev\/?$/.test(deploymentUrl)) {
    throw new Error('CF_PAGES_URL must be the hash-based HTTPS deployment URL supplied by Cloudflare Pages.');
  }

  return `${deploymentUrl.replace(/\/$/, '')}/`;
}
