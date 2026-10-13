import { useEffect, useState, useSyncExternalStore } from 'react';
import { getToken } from '@/shared/api/client';
import { imageService } from '@/shared/api/image.service';
import { leasePrivateImage } from '@/shared/api/privateImageLease';
import { isPrivateImageEndpoint, mediaSession } from '@/shared/api/privateMedia';

/** A component-local, abortable blob lease; no persistence or shared media cache. */
export function usePrivateImage(endpoint: string | null, enabled = true) {
  const session = useSyncExternalStore(mediaSession.subscribe, mediaSession.snapshot, mediaSession.snapshot);
  const [result, setResult] = useState<{ endpoint: string; session: number; url: string | null; failed: boolean } | null>(null);
  useEffect(() => {
    if (!enabled || !endpoint || !isPrivateImageEndpoint(endpoint) || !getToken()) return;
    return leasePrivateImage(
      (signal) => imageService.getAuthenticatedImage(endpoint, signal),
      (image) => setResult({ ...image, endpoint, session }),
      () => session === mediaSession.snapshot(),
    );
  }, [endpoint, enabled, session]);
  const current = enabled && getToken() && result?.endpoint === endpoint && result.session === session ? result : null;
  return { src: current?.url ?? null, failed: current?.failed ?? false };
}
