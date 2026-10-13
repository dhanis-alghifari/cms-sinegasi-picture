
const rawApiUrl = (import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001').trim();
const normalizedApiUrl = rawApiUrl.replace(/\/api\/?$/, '').replace(/\/+$/, '');

export const env = {
  apiUrl: normalizedApiUrl,
  appName: import.meta.env.VITE_APP_NAME ?? 'Sinegasi CMS',
} as const;
