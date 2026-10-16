// Runs inside a one-off API image. Never imports server/workers or calls the DB.
// Suppress details: invalid configuration can contain secrets.
try {
  const { runtimeConfig: config } = require('./dist/config/env.js');
  const requiredProxy = process.env.PRODUCTION_TRUST_PROXY;
  const requiredAddresses = process.env.PRODUCTION_TRUST_PROXY_ADDRESSES;
  const proxyMatches = requiredProxy === '0'
    ? config.trustProxy === false
    : Number(requiredProxy) === config.trustProxy;
  const addressesMatch = Array.isArray(config.trustedProxyAddresses) && (requiredProxy === '0'
    ? requiredAddresses === 'none' && config.trustedProxyAddresses.length === 0
    : requiredAddresses && config.trustedProxyAddresses.length > 0
      && config.trustedProxyAddresses.join(',') === requiredAddresses);
  // This release explicitly permits only generic alerts on the operator-chosen
  // public topic. It grants no topic ownership, privacy, or publisher identity.
  const ntfyMatches = config.ntfyEnabled === false || (
    config.ntfyEnabled === true
    && config.ntfyPublicGenericEnabled === true
    && config.ntfyServerUrl === 'https://ntfy.sh'
    && config.ntfyTopic === 'sinegasi-notif'
    && ['', 'sinegasi-notif'].includes(config.ntfyCashReviewTopic)
    && config.ntfyFrontendUrl === 'https://sinegasi.pictures'
    && config.ntfyAccessToken === ''
  );
  if (
    config.environment !== 'production'
    || !config.publicDeployment
    || config.allowDevelopmentAuth
    || config.backgroundJobsEnabled !== false
    || !ntfyMatches
    || config.supabaseUrl !== 'https://pvbdiftvzoeelibxlxzb.supabase.co'
    || config.corsOrigins.length !== 1
    || config.corsOrigins[0] !== 'https://sinegasi.pictures'
    || !/^[0-4]$/.test(requiredProxy || '')
    || !proxyMatches
    || !addressesMatch
    || config.port !== 5001
    || config.host !== '0.0.0.0'
    || !config.r2AccountId || !config.r2BucketName || !config.r2AccessKeyId || !config.r2SecretAccessKey
    || !/^[a-f0-9]{32}$/.test(process.env.PRODUCTION_R2_ACCOUNT_ID || '')
    || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(process.env.PRODUCTION_R2_BUCKET || '')
    || config.r2AccountId !== process.env.PRODUCTION_R2_ACCOUNT_ID
    || config.r2BucketName !== process.env.PRODUCTION_R2_BUCKET
    || config.r2PublicDomain !== ''
    || ['CLOUDFLARE_R2_PUBLIC_DOMAIN', 'R2_PUBLIC_DOMAIN', 'PRODUCTION_MEDIA_PUBLIC_DOMAIN']
      .some(key => Boolean(process.env[key]?.trim()))
  ) {
    throw new Error('Unsafe production configuration');
  }
} catch {
  process.stderr.write('[deploy-prod] Runtime configuration preflight failed; no configuration values logged.\n');
  process.exit(1);
}
