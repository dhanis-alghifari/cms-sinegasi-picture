-- Shared resilience stores for multi-worker deployments. Run after 026.
-- If the API is deployed before this migration, bounded in-memory fallbacks
-- remain active and should be treated as a temporary rollout state.

BEGIN;

CREATE TABLE IF NOT EXISTS public.api_idempotency_responses (
  cache_key TEXT PRIMARY KEY,
  status_code INTEGER NOT NULL CHECK (status_code BETWEEN 100 AND 599),
  payload TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_idempotency_responses_expiry
  ON public.api_idempotency_responses (expires_at);

ALTER TABLE public.api_idempotency_responses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.api_idempotency_responses FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.api_idempotency_responses TO service_role;

CREATE TABLE IF NOT EXISTS public.api_login_rate_limits (
  rate_key TEXT PRIMARY KEY,
  failure_count INTEGER NOT NULL CHECK (failure_count >= 0),
  window_started_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_login_rate_limits_updated_at
  ON public.api_login_rate_limits (updated_at);

ALTER TABLE public.api_login_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.api_login_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.api_login_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.record_login_failure(
  p_rate_key TEXT,
  p_window_seconds INTEGER DEFAULT 300
)
RETURNS VOID
LANGUAGE SQL
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.api_login_rate_limits (rate_key, failure_count, window_started_at, updated_at)
  VALUES (p_rate_key, 1, NOW(), NOW())
  ON CONFLICT (rate_key) DO UPDATE
  SET failure_count = CASE
        WHEN EXTRACT(EPOCH FROM (NOW() - api_login_rate_limits.window_started_at)) >= p_window_seconds THEN 1
        ELSE api_login_rate_limits.failure_count + 1
      END,
      window_started_at = CASE
        WHEN EXTRACT(EPOCH FROM (NOW() - api_login_rate_limits.window_started_at)) >= p_window_seconds THEN NOW()
        ELSE api_login_rate_limits.window_started_at
      END,
      updated_at = NOW();
$$;

CREATE OR REPLACE FUNCTION public.is_login_rate_limited(
  p_rate_key TEXT,
  p_window_seconds INTEGER DEFAULT 300,
  p_max_attempts INTEGER DEFAULT 10
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT failure_count >= p_max_attempts
      AND EXTRACT(EPOCH FROM (NOW() - window_started_at)) < p_window_seconds
    FROM public.api_login_rate_limits
    WHERE rate_key = p_rate_key
  ), FALSE);
$$;

CREATE OR REPLACE FUNCTION public.clear_login_rate_limit(p_rate_key TEXT)
RETURNS VOID
LANGUAGE SQL
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.api_login_rate_limits WHERE rate_key = p_rate_key;
$$;

REVOKE ALL ON FUNCTION public.record_login_failure(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_login_rate_limited(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clear_login_rate_limit(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_login_failure(TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_login_rate_limited(TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.clear_login_rate_limit(TEXT) TO service_role;

COMMIT;
