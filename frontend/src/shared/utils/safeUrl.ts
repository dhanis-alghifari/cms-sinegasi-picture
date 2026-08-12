/** Allow only explicit web URLs for links originating from user/API data. */
export function getSafeExternalUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined;

  try {
    const baseOrigin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
    const url = new URL(value, baseOrigin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

/** Keep notification deep-links inside the application origin. */
export function getSafeInternalPath(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const path = value.trim();
  if (!path.startsWith('/') || path.startsWith('//') || /[\r\n]/.test(path)) return undefined;
  return path;
}
