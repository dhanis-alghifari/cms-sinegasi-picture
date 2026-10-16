import { z } from 'zod';

const privateMediaPath = /^\/api\/private-media\/(?:agenda|contest|return|return-report|charge|publication|insight)\/[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9_-]{1,64}$/;
const portraitPath = /^\/api\/(?:students|equipment)\/[A-Za-z0-9_-]{1,64}\/photo$/;
export const privateMediaPathSchema = z.string().regex(privateMediaPath);
export function isPrivateImageEndpoint(value: string): boolean { return value === '/api/auth/me/photo' || privateMediaPath.test(value) || portraitPath.test(value); }
export function isLocalImagePreview(value: string): boolean { return /^(?:blob:|data:image\/(?:jpeg|png|webp);base64,)/i.test(value); }

// Ephemeral generation, not a credential/query-string or a persisted blob cache.
let generation = 0;
const listeners = new Set<() => void>();
const storageChanged = (event: StorageEvent) => {
  if (event.key === 'sinegasi_token' || event.key === null) mediaSession.invalidate();
};
export const mediaSession = {
  snapshot: () => generation,
  subscribe(listener: () => void) {
    if (listeners.size === 0 && typeof window !== 'undefined') window.addEventListener('storage', storageChanged);
    listeners.add(listener);
    return () => { listeners.delete(listener); if (listeners.size === 0 && typeof window !== 'undefined') window.removeEventListener('storage', storageChanged); };
  },
  invalidate() { generation += 1; for (const listener of listeners) listener(); },
};
