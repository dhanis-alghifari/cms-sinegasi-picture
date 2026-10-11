export function backgroundJobsEnabled(value: string | undefined, production: boolean): boolean {
  if (value === undefined) return !production;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error('BACKGROUND_JOBS_ENABLED harus true atau false.');
}

/** Idempotent process lifecycle; not a distributed ownership lock. */
export function createBackgroundJobs(enabled: boolean, start: () => () => void) {
  let stop: (() => void) | undefined;
  return {
    start: () => { if (enabled && !stop) stop = start(); },
    stop: () => { stop?.(); stop = undefined; },
  };
}
