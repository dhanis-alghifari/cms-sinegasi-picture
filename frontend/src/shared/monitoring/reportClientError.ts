import { env } from '@/shared/config/env';
import { createClientErrorReporter, installClientErrorListeners } from './clientErrors';

// Never send preview/development telemetry or credentials to another origin.
const enabled = import.meta.env.PROD && env.apiUrl === 'https://api.sinegasi.pictures';

export const reportClientError = createClientErrorReporter({
  enabled,
  readToken: () => localStorage.getItem('sinegasi_token'),
  release: import.meta.env.VITE_APP_RELEASE,
});

export function installGlobalClientErrorMonitoring(): () => void {
  if (!enabled) return () => undefined;
  return installClientErrorListeners(window, reportClientError);
}
