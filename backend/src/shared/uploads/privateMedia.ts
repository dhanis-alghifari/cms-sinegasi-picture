/** References are authenticated API paths, never bearer URLs or storage keys. */
export const PRIVATE_MEDIA_KINDS = ['agenda', 'contest', 'return', 'return-report', 'charge', 'publication', 'insight'] as const;
export type PrivateMediaKind = typeof PRIVATE_MEDIA_KINDS[number];
export interface PrivateMediaObject { objectKey: string; contentType: string; fileSizeBytes: number }

export function privateMediaAccess(kind: PrivateMediaKind, parentId: string, id: string) {
  if (![parentId, id].every((value) => /^[A-Za-z0-9_-]{1,64}$/.test(value))) throw new Error('INVALID_MEDIA_REFERENCE');
  return { access_url: `/api/private-media/${kind}/${parentId}/${id}`, expires_in_seconds: 0 };
}
