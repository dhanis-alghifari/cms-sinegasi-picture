-- Shared atomic API rate-limit windows for public backend instances.
-- Counters contain only policy-scoped hashes; access is limited to service_role.
BEGIN;

CREATE TABLE IF NOT EXISTS public.api_rate_limit_windows (
  rate_key TEXT PRIMARY KEY CHECK (rate_key ~ '^[a-f0-9]{64}$'),
  request_count INTEGER NOT NULL CHECK (request_count BETWEEN 1 AND 100001),
  window_started_at TIMESTAMPTZ NOT NULL,
  window_seconds INTEGER NOT NULL CHECK (window_seconds BETWEEN 1 AND 86400),
  max_requests INTEGER NOT NULL CHECK (max_requests BETWEEN 1 AND 100000),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limit_windows_updated
  ON public.api_rate_limit_windows (updated_at);

ALTER TABLE public.api_rate_limit_windows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.api_rate_limit_windows FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.api_rate_limit_windows TO service_role;

-- SECURITY INVOKER: service_role has the narrowly scoped table grant above.
CREATE OR REPLACE FUNCTION public.consume_api_rate_limit_atomic(
  p_rate_key TEXT,
  p_window_seconds INTEGER,
  p_max_requests INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_started_at TIMESTAMPTZ;
  v_row public.api_rate_limit_windows%ROWTYPE;
BEGIN
  IF p_rate_key IS NULL OR p_rate_key !~ '^[a-f0-9]{64}$'
    OR p_window_seconds IS NULL OR p_window_seconds NOT BETWEEN 1 AND 86400
    OR p_max_requests IS NULL OR p_max_requests NOT BETWEEN 1 AND 100000 THEN
    RAISE EXCEPTION 'API_RATE_LIMIT_INVALID_INPUT';
  END IF;

  v_started_at := to_timestamp(floor(extract(epoch FROM v_now) / p_window_seconds) * p_window_seconds);

  INSERT INTO public.api_rate_limit_windows (
    rate_key, request_count, window_started_at, window_seconds, max_requests, updated_at
  ) VALUES (
    p_rate_key, 1, v_started_at, p_window_seconds, p_max_requests, v_now
  )
  ON CONFLICT (rate_key) DO UPDATE
  SET request_count = CASE
        WHEN api_rate_limit_windows.window_started_at < EXCLUDED.window_started_at THEN 1
        ELSE LEAST(api_rate_limit_windows.request_count + 1, p_max_requests + 1)
      END,
      window_started_at = GREATEST(api_rate_limit_windows.window_started_at, EXCLUDED.window_started_at),
      updated_at = EXCLUDED.updated_at
  WHERE api_rate_limit_windows.window_seconds = EXCLUDED.window_seconds
    AND api_rate_limit_windows.max_requests = EXCLUDED.max_requests
  RETURNING * INTO v_row;

  IF NOT FOUND THEN RAISE EXCEPTION 'API_RATE_LIMIT_POLICY_MISMATCH'; END IF;

  RETURN jsonb_build_object(
    'allowed', v_row.request_count <= p_max_requests,
    'limit', p_max_requests,
    'remaining', GREATEST(0, p_max_requests - v_row.request_count),
    'reset_at', v_row.window_started_at + make_interval(secs => p_window_seconds)
  );
END;
$$;

-- Optional bounded cleanup. This function is created but is not scheduled or run.
CREATE OR REPLACE FUNCTION public.purge_expired_api_rate_limit_windows(p_batch_size INTEGER DEFAULT 1000)
RETURNS INTEGER
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  IF p_batch_size IS NULL OR p_batch_size NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'API_RATE_LIMIT_INVALID_PURGE_LIMIT';
  END IF;
  DELETE FROM public.api_rate_limit_windows
  WHERE rate_key IN (
    SELECT rate_key FROM public.api_rate_limit_windows
    WHERE updated_at < clock_timestamp() - INTERVAL '2 days'
    ORDER BY updated_at
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  );
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_api_rate_limit_atomic(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_expired_api_rate_limit_windows(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_api_rate_limit_atomic(TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_expired_api_rate_limit_windows(INTEGER) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
