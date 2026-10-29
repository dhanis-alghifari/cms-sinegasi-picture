/** Send the Cloudflare Access session only to the protected development API. */
export function apiCredentials(apiUrl: string): RequestCredentials {
  try {
    const url = new URL(apiUrl);
    if (url.protocol === 'https:' && url.hostname === 'api-dev.sinegasi.pictures' && !url.port) {
      return 'include';
    }
  } catch {
    // Relative and malformed URLs retain the browser's default credential policy.
  }
  return 'same-origin';
}
