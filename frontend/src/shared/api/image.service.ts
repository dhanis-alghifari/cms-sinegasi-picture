import { apiClient } from './client';

export type AuthenticatedImageResource =
  | { kind: 'blob'; url: string }
  | { kind: 'remote'; url: string }
  | null;

const objectUrlReferences = new Map<string, { count: number; revokeTimer?: ReturnType<typeof setTimeout> }>();

export const imageService = {
  async getAuthenticatedImage(endpoint: string): Promise<AuthenticatedImageResource> {
    const image = await apiClient.getImage(endpoint);
    if (image?.kind === 'blob') {
      const url = URL.createObjectURL(image.blob);
      objectUrlReferences.set(url, { count: 0 });
      return { kind: 'blob', url };
    }
    return image;
  },

  retainObjectUrl(url: string): () => void {
    const reference = objectUrlReferences.get(url);
    if (!reference) return () => undefined;
    if (reference.revokeTimer) clearTimeout(reference.revokeTimer);
    reference.revokeTimer = undefined;
    reference.count += 1;
    return () => {
      const current = objectUrlReferences.get(url);
      if (!current) return;
      current.count = Math.max(0, current.count - 1);
      if (current.count !== 0 || current.revokeTimer) return;
      current.revokeTimer = setTimeout(() => {
        const latest = objectUrlReferences.get(url);
        if (latest?.count === 0) {
          URL.revokeObjectURL(url);
          objectUrlReferences.delete(url);
        }
      }, 0);
    };
  },
};
