export type ClientErrorEvent = (
  | { kind: 'render'; code: 'RENDER_ERROR' }
  | { kind: 'runtime'; code: 'RUNTIME_ERROR' }
  | { kind: 'unhandled_rejection'; code: 'UNHANDLED_REJECTION' }
  | { kind: 'api'; code: 'API_ERROR' | 'NETWORK_ERROR' }
) & {
  requestId?: string;
  statusCode?: number;
};

interface ClientErrorReporterOptions {
  enabled: boolean;
  readToken: () => string | null;
  release?: string;
  fetch?: typeof globalThis.fetch;
  now?: () => number;
}

const COLLECTOR_URL = 'https://api.sinegasi.pictures/api/monitoring/client-errors';
const WINDOW_MS = 60_000;
const MAX_EVENTS_PER_WINDOW = 10;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;
const RELEASE_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

function isSupportedEvent(event: ClientErrorEvent): boolean {
  switch (event.kind) {
    case 'render': return event.code === 'RENDER_ERROR';
    case 'runtime': return event.code === 'RUNTIME_ERROR';
    case 'unhandled_rejection': return event.code === 'UNHANDLED_REJECTION';
    case 'api': return event.code === 'API_ERROR' || event.code === 'NETWORK_ERROR';
    default: return false;
  }
}

export function responseRequestId(response: Pick<Response, 'headers'>, bodyId?: unknown): string | undefined {
  if (typeof bodyId === 'string' && REQUEST_ID_PATTERN.test(bodyId)) return bodyId;
  const headerId = response.headers.get('X-Request-Id');
  return headerId !== null && REQUEST_ID_PATTERN.test(headerId) ? headerId : undefined;
}

/** A bounded, best-effort channel for fixed error categories, never raw exceptions or URLs. */
export function createClientErrorReporter(options: ClientErrorReporterOptions): (event: ClientErrorEvent) => void {
  const send = options.fetch ?? globalThis.fetch;
  const now = options.now ?? Date.now;
  const release = typeof options.release === 'string' && RELEASE_PATTERN.test(options.release)
    ? options.release
    : undefined;
  let windowStartedAt = 0;
  const sent = new Set<string>();

  async function transmit(body: string, token: string): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3_000);
    try {
      await send(COLLECTOR_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body,
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        referrerPolicy: 'no-referrer',
        signal: controller.signal,
      });
    } catch {
      // Monitoring must never retry, become an unhandled rejection, or break the application.
    } finally {
      clearTimeout(timeout);
    }
  }

  return function reportClientError(event: ClientErrorEvent): void {
    try {
      if (!options.enabled || !isSupportedEvent(event)) return;
      const token = options.readToken();
      if (!token) return;
      const timestamp = now();
      if (timestamp < windowStartedAt || timestamp - windowStartedAt >= WINDOW_MS) {
        windowStartedAt = timestamp;
        sent.clear();
      }
      const payload = {
        kind: event.kind,
        code: event.code,
        ...(release ? { release } : {}),
        ...(typeof event.requestId === 'string' && REQUEST_ID_PATTERN.test(event.requestId)
          ? { requestId: event.requestId }
          : {}),
        ...(typeof event.statusCode === 'number' && Number.isInteger(event.statusCode)
          && event.statusCode >= 400 && event.statusCode <= 599
          ? { statusCode: event.statusCode }
          : {}),
      };
      const body = JSON.stringify(payload);
      if (sent.size >= MAX_EVENTS_PER_WINDOW || sent.has(body)) return;
      sent.add(body);
      void transmit(body, token).catch(() => undefined);
    } catch {
      // Storage restrictions or malformed local values cannot prevent error recovery.
    }
  };
}

export function installClientErrorListeners(
  target: EventTarget,
  report: (event: ClientErrorEvent) => void,
): () => void {
  // Do not read event.message, event.error, event.reason, or the current location.
  function onError(): void {
    report({ kind: 'runtime', code: 'RUNTIME_ERROR' });
  }
  function onUnhandledRejection(): void {
    report({ kind: 'unhandled_rejection', code: 'UNHANDLED_REJECTION' });
  }
  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onUnhandledRejection);
  return function removeClientErrorListeners(): void {
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onUnhandledRejection);
  };
}
