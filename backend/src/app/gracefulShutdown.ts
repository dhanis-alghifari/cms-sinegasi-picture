import type { FastifyBaseLogger } from 'fastify';

type ShutdownSignal = 'SIGTERM' | 'SIGINT';

interface ShutdownProcess {
  on(signal: ShutdownSignal, listener: () => void): unknown;
  off(signal: ShutdownSignal, listener: () => void): unknown;
  exit(code: number): void;
}

interface ShutdownApplication {
  close(): Promise<void>;
  log: Pick<FastifyBaseLogger, 'error'>;
}

/** Drain requests and run onClose hooks before Docker's 30-second stop deadline. */
export function registerGracefulShutdown(
  app: ShutdownApplication,
  control: ShutdownProcess = process,
  timeoutMs = 25_000,
): () => void {
  let started = false;
  let finished = false;
  let deadline: ReturnType<typeof setTimeout> | undefined;

  function dispose(): void {
    control.off('SIGTERM', shutdown);
    control.off('SIGINT', shutdown);
    clearTimeout(deadline);
  }

  function finish(code: number): void {
    if (finished) return;
    finished = true;
    dispose();
    control.exit(code);
  }

  async function closeApplication(): Promise<void> {
    try {
      await app.close();
      finish(0);
    } catch {
      // Provider exceptions can contain credentials; never log the raw error.
      app.log.error('Application shutdown failed');
      finish(1);
    }
  }

  function shutdown(): void {
    if (started) return;
    started = true;
    deadline = setTimeout(() => {
      app.log.error('Application shutdown exceeded deadline');
      finish(1);
    }, timeoutMs);
    void closeApplication();
  }

  control.on('SIGTERM', shutdown);
  control.on('SIGINT', shutdown);
  return dispose;
}
