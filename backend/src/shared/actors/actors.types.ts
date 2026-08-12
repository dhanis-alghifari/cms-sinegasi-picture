/**
 * Stable, non-sensitive identity projection used when an API record stores a
 * user UUID in an audit column. The UUID columns remain the source of truth;
 * this object is additive metadata for screens and audit readers.
 */
export type ActorSummary = {
  id: string;
  nama?: string;
  username?: string;
  role?: string;
  is_active?: boolean;
};

export const ACTOR_REFERENCE_FIELDS = {
  created_by: 'created_actor',
  updated_by: 'updated_actor',
  approved_by: 'approved_actor',
  processed_return_by: 'processed_return_actor',
  graded_by: 'graded_actor',
  resolved_by: 'resolved_actor',
  recorded_by: 'recorded_actor',
  actor_user_id: 'actor',
} as const;

export type ActorReferenceField = keyof typeof ACTOR_REFERENCE_FIELDS;
export type ActorProjectionField = typeof ACTOR_REFERENCE_FIELDS[ActorReferenceField];
