import { ACTOR_REFERENCE_FIELDS, type ActorReferenceField, type ActorSummary } from './actors.types.js';

const MAX_DEPTH = 12;
const MAX_NODES = 10_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function collectFrom(value: unknown, ids: Set<string>, seen: WeakSet<object>, depth: number, nodes: { count: number }): void {
  if (depth > MAX_DEPTH || nodes.count >= MAX_NODES || value === null || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);
  nodes.count += 1;

  if (Array.isArray(value)) {
    for (const item of value) collectFrom(item, ids, seen, depth + 1, nodes);
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (key in ACTOR_REFERENCE_FIELDS && typeof child === 'string') ids.add(child);
    collectFrom(child, ids, seen, depth + 1, nodes);
  }
}

export function collectActorIds(payload: unknown): string[] {
  const ids = new Set<string>();
  collectFrom(payload, ids, new WeakSet<object>(), 0, { count: 0 });
  return [...ids];
}

function enrich(value: unknown, actors: Map<string, ActorSummary | null>, seen: WeakSet<object>, depth: number, nodes: { count: number }): void {
  if (depth > MAX_DEPTH || nodes.count >= MAX_NODES || value === null || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);
  nodes.count += 1;

  if (Array.isArray(value)) {
    for (const item of value) enrich(item, actors, seen, depth + 1, nodes);
    return;
  }

  const object = value as Record<string, unknown>;
  for (const [key, child] of Object.entries(object)) {
    if (key in ACTOR_REFERENCE_FIELDS && typeof child === 'string') {
      const projectionKey = ACTOR_REFERENCE_FIELDS[key as ActorReferenceField];
      if (!(projectionKey in object)) {
        const actor = actors.get(child);
        object[projectionKey] = actor || { id: child, nama: 'Aktor tidak ditemukan' };
      }
      continue;
    }
    enrich(child, actors, seen, depth + 1, nodes);
  }
}

export function enrichActorReferences(payload: unknown, actors: Map<string, ActorSummary | null>): unknown {
  enrich(payload, actors, new WeakSet<object>(), 0, { count: 0 });
  return payload;
}

export function isActorReferenceField(value: string): value is ActorReferenceField {
  return value in ACTOR_REFERENCE_FIELDS;
}
