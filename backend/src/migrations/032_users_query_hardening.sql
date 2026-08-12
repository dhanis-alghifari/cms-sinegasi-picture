-- 032_users_query_hardening.sql
-- Additive indexes for the teacher-only users management endpoints.
-- Apply after 019_student_account_provisioning.sql and 021_auth_session_hardening.sql.

-- The list endpoint can filter by role/status and always orders by newest
-- account first with id as a deterministic tie-breaker.
CREATE INDEX IF NOT EXISTS idx_users_created_at_id
  ON public.users (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_users_role_created_at_id
  ON public.users (role, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_users_active_created_at_id
  ON public.users (is_active, created_at DESC, id DESC);

-- Search is a bounded contains-search over the two user-facing identity
-- fields. Trigram indexes keep this query index-assisted as the account table
-- grows; the API still sanitizes the search term before it reaches PostgREST.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_users_username_trgm
  ON public.users USING gin (username gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_nama_trgm
  ON public.users USING gin (nama gin_trgm_ops);

-- The linked-student invariant is checked by user_id before update/delete.
-- Migration 019 already creates the partial unique index; this non-unique
-- covering index is intentionally omitted to avoid duplicate write overhead.

NOTIFY pgrst, 'reload schema';
