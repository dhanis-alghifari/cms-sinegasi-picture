import { apiClient } from './client';
import { createPrivateImageQueue } from './privateImageQueue';

const queue = createPrivateImageQueue();

export const imageService = {
  getAuthenticatedImage(endpoint: string, signal: AbortSignal) {
    return queue.run(signal, () => apiClient.getImage(endpoint, { signal }));
  },
};
