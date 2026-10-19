import { createClientErrorReporter, installClientErrorListeners } from './clientErrors';

// Never send preview/development telemetry or credentials to another origin.
// Error boundaries also render outside Vite; monitoring must remain inert there.
const apiUrl = (import.meta.env?.VITE_API_URL ?? import.meta.env?.VITE_API_BASE_URL ?? '')
  .trim().replace(/\/api\/?$/, '').replace(/\/+$/, '');
const enabled = import.meta.env?.PROD === true && apiUrl === 'https://api.sinegasi.pictures';

export const reportClientError = createClientErrorReporter({
  enabled,
  readToken: () => localStorage.getItem('sinegasi_token'),
  release: import.meta.env?.VITE_APP_RELEASE,
});

export function installGlobalClientErrorMonitoring(): () => void {
  if (!enabled) return () => undefined;
  return installClientErrorListeners(window, reportClientError);
}
