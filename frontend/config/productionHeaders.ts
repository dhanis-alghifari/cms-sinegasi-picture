/** Public launch policy only; never copy the shared DEV/preview origin list. */
export const PRODUCTION_HEADERS = `/assets/*
  Access-Control-Allow-Origin: *

/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(self), microphone=(), geolocation=(), payment=()
  Content-Security-Policy-Report-Only: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://api.sinegasi.pictures; form-action 'self'
`;
