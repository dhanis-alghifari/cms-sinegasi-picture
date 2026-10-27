import type { PrivateImageResult } from './privateImageResponse';

export interface PrivateImageLeaseState {
  active: boolean;
}

export function isCurrentPrivateImageLease(lease: PrivateImageLeaseState, resultAttempt: number, currentAttempt: number): boolean {
  return lease.active && resultAttempt === currentAttempt;
}

/** One view owns one lease, including late completion after unmount/logout. */
export function leasePrivateImage(
  load: (signal: AbortSignal) => Promise<PrivateImageResult>,
  publish: (result: { url: string | null; failed: boolean }) => void,
  isCurrent: () => boolean,
): () => void {
  const abort = new AbortController();
  let url: string | null = null;
  void load(abort.signal).then((image) => {
    if (abort.signal.aborted || !isCurrent()) return;
    url = image ? URL.createObjectURL(image.blob) : null;
    publish({ url, failed: !image });
  }).catch(() => {
    if (!abort.signal.aborted && isCurrent()) publish({ url: null, failed: true });
  });
  return () => { abort.abort(); if (url) { URL.revokeObjectURL(url); url = null; } };
}
