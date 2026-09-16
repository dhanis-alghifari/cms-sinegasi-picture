
export const env = {
  apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:5001',
  appName: import.meta.env.VITE_APP_NAME ?? 'Sinegasi CMS',
  r2PublicDomain: (import.meta.env.VITE_R2_PUBLIC_DOMAIN ?? 'https://pub-bacbd163ce50498d82672aab73389f38.r2.dev').replace(/\/$/, ''),
} as const;
