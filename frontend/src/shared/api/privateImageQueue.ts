/** Bounded per-tab concurrency, with cancellation while waiting (no retries). */
export function createPrivateImageQueue(concurrency = 4, maxQueued = 256) {
  let active = 0;
  const queue: Array<{ grant: () => void; signal: AbortSignal }> = [];
  const cancelled = () => new DOMException('Cancelled', 'AbortError');
  function acquire(signal: AbortSignal): Promise<void> {
    if (signal.aborted) return Promise.reject(cancelled());
    if (active < concurrency) { active += 1; return Promise.resolve(); }
    if (queue.length >= maxQueued) return Promise.reject(new Error('Antrean gambar penuh.'));
    return new Promise((resolve, reject) => {
      const entry = { signal, grant: () => { signal.removeEventListener('abort', abort); active += 1; resolve(); } };
      const abort = () => { const index = queue.indexOf(entry); if (index >= 0) queue.splice(index, 1); reject(cancelled()); };
      signal.addEventListener('abort', abort, { once: true });
      queue.push(entry);
    });
  }
  return {
    async run<T>(signal: AbortSignal, load: () => Promise<T>): Promise<T> {
      await acquire(signal);
      try { if (signal.aborted) throw cancelled(); return await load(); }
      finally { active -= 1; queue.shift()?.grant(); }
    },
  };
}
