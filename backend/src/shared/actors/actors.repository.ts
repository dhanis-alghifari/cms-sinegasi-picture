import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActorSummary } from './actors.types.js';

type SupabaseLike = SupabaseClient | null;

type CachedActor = {
  actor: ActorSummary | null;
  expiresAt: number;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CACHE_TTL_MS = 30_000;
const CACHE_MAX_ENTRIES = 500;

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function normalizeActor(row: Record<string, unknown>): ActorSummary | null {
  if (!isUuid(row.id)) return null;
  return {
    id: row.id,
    ...(typeof row.nama === 'string' ? { nama: row.nama } : {}),
    ...(typeof row.username === 'string' ? { username: row.username } : {}),
    ...(typeof row.role === 'string' ? { role: row.role } : {}),
    ...(typeof row.is_active === 'boolean' ? { is_active: row.is_active } : {}),
  };
}

/**
 * Request-safe actor directory. It performs one batched users lookup for all
 * cache misses and keeps a short-lived identity cache to avoid adding an N+1
 * query to list endpoints. Errors are intentionally non-fatal: the original
 * UUID fields remain available to callers and audit snapshots are authoritative.
 */
export class ActorDirectory {
  private readonly cache = new Map<string, CachedActor>();

  constructor(private readonly client: SupabaseLike) {}

  async resolve(ids: readonly string[]): Promise<Map<string, ActorSummary | null>> {
    const uniqueIds = [...new Set(ids.filter(isUuid))];
    const result = new Map<string, ActorSummary | null>();
    if (!this.client || uniqueIds.length === 0) return result;

    const now = Date.now();
    const missing: string[] = [];
    for (const id of uniqueIds) {
      const cached = this.cache.get(id);
      if (cached && cached.expiresAt > now) {
        result.set(id, cached.actor);
      } else {
        if (cached) this.cache.delete(id);
        missing.push(id);
      }
    }

    if (missing.length === 0) return result;

    const query = await this.client
      .from('users')
      .select('id,nama,username,role,is_active')
      .in('id', missing);
    if (query.error) return result;

    const fetched = new Map<string, ActorSummary>();
    for (const row of (query.data || []) as Array<Record<string, unknown>>) {
      const actor = normalizeActor(row);
      if (actor) fetched.set(actor.id, actor);
    }

    for (const id of missing) {
      const actor = fetched.get(id) || null;
      this.cache.set(id, { actor, expiresAt: now + CACHE_TTL_MS });
      result.set(id, actor);
    }

    while (this.cache.size > CACHE_MAX_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (typeof oldest !== 'string') break;
      this.cache.delete(oldest);
    }
    return result;
  }
}

export type { SupabaseLike };
