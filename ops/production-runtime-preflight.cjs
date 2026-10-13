// Runs inside a one-off API image. Never imports server/workers or calls the DB.
// Suppress details: invalid configuration can contain secrets.
try {
  const { runtimeConfig: config } = require('./dist/config/env.js');
  const requiredProxy = process.env.PRODUCTION_TRUST_PROXY;
  const proxyMatches = requiredProxy === '0'
    ? config.trustProxy === false
    : Number(requiredProxy) === config.trustProxy;
  if (
    config.environment !== 'production'
    || !config.publicDeployment
    || config.allowDevelopmentAuth
    || config.backgroundJobsEnabled !== false
    || config.ntfyEnabled
    || config.supabaseUrl !== 'https://pvbdiftvzoeelibxlxzb.supabase.co'
    || config.corsOrigins.length !== 1
    || config.corsOrigins[0] !== 'https://sinegasi.pictures'
    || !/^[0-4]$/.test(requiredProxy || '')
    || !proxyMatches
    || config.port !== 5001
    || config.host !== '0.0.0.0'
    || !config.r2AccountId || !config.r2BucketName || !config.r2AccessKeyId || !config.r2SecretAccessKey
    || !/^https:\/\/[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(process.env.PRODUCTION_MEDIA_PUBLIC_DOMAIN || '')
    || config.r2PublicDomain !== process.env.PRODUCTION_MEDIA_PUBLIC_DOMAIN
    || config.r2PublicDomain === 'https://pub-bacbd163ce50498d82672aab73389f38.r2.dev'
  ) {
    throw new Error('Unsafe production configuration');
  }
} catch {
  process.stderr.write('[deploy-prod] Runtime configuration preflight failed; no configuration values logged.\n');
  process.exit(1);
}
