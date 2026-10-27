import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { getToken } from '@/shared/api/client';
import { imageService } from '@/shared/api/image.service';
import { isCurrentPrivateImageLease, leasePrivateImage, type PrivateImageLeaseState } from '@/shared/api/privateImageLease';
import { isPrivateImageEndpoint, mediaSession } from '@/shared/api/privateMedia';

/** A component-local, abortable blob lease; no persistence or shared media cache. */
export function usePrivateImage(endpoint: string | null, enabled = true) {
  const session = useSyncExternalStore(mediaSession.subscribe, mediaSession.snapshot, mediaSession.snapshot);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ endpoint: string; session: number; attempt: number; lease: PrivateImageLeaseState; url: string | null; failed: boolean } | null>(null);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    if (!enabled || !endpoint || !isPrivateImageEndpoint(endpoint) || !getToken()) return;
    const lease = { active: true };
    const dispose = leasePrivateImage(
      (signal) => imageService.getAuthenticatedImage(endpoint, signal),
      (image) => setResult({ ...image, endpoint, session, attempt, lease }),
      () => session === mediaSession.snapshot(),
    );
    return () => { lease.active = false; dispose(); };
  }, [endpoint, enabled, session, attempt]);
  const current = enabled && getToken() && result?.endpoint === endpoint && result.session === session && isCurrentPrivateImageLease(result.lease, result.attempt, attempt) ? result : null;
  const missingSession = Boolean(enabled && endpoint && isPrivateImageEndpoint(endpoint) && !getToken());
  return { src: current?.url ?? null, failed: missingSession || (current?.failed ?? false), retry };
}
