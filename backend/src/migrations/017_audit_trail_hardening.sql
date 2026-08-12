-- 017_audit_trail_hardening.sql
-- Audit trail immutable dengan snapshot aktor, metadata request, dan indeks filter.

-- Kolom tambahan dibuat nullable agar aman untuk data historis.
ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS actor_name_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS actor_username_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS actor_role_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS request_id UUID,
  ADD COLUMN IF NOT EXISTS operation_id UUID,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'api',
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS changed_fields TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::JSONB;

-- Kolom aktor pada tabel domain. Semua bersifat nullable untuk kompatibilitas
-- dengan data lama dan proses otomatis yang tidak memiliki aktor manusia.
DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'users', 'students', 'classes', 'attendance', 'assignments', 'grades',
    'equipment', 'borrowings', 'borrowing_items', 'cash_transactions',
    'cash_settings', 'debt_records', 'cash_disputes', 'contests', 'contest_members',
    'film_works', 'film_crew', 'contest_films', 'cash_billing_runs'
  ]
  LOOP
    IF to_regclass(format('public.%I', v_table)) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL',
        v_table
      );
    END IF;
  END LOOP;

  FOREACH v_table IN ARRAY ARRAY[
    'users', 'students', 'classes', 'attendance', 'assignments', 'grades',
    'equipment', 'borrowings', 'borrowing_items', 'cash_transactions',
    'cash_settings', 'debt_records', 'cash_disputes', 'contests', 'film_works'
  ]
  LOOP
    IF to_regclass(format('public.%I', v_table)) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL',
        v_table
      );
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()',
        v_table
      );
    END IF;
  END LOOP;

  IF to_regclass('public.grades') IS NOT NULL THEN
    ALTER TABLE public.grades
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END;
$$;

-- Isi timestamp yang baru ditambahkan tanpa mengubah nilai bisnis.
DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'users', 'students', 'classes', 'attendance', 'assignments', 'grades',
    'equipment', 'borrowings', 'borrowing_items', 'cash_transactions',
    'debt_records', 'cash_disputes', 'contests', 'film_works'
  ]
  LOOP
    IF to_regclass(format('public.%I', v_table)) IS NOT NULL THEN
      EXECUTE format(
        'UPDATE public.%I SET updated_at = COALESCE(updated_at, created_at, NOW()) WHERE updated_at IS NULL',
        v_table
      );
    END IF;
  END LOOP;

  IF to_regclass('public.grades') IS NOT NULL THEN
    UPDATE public.grades
    SET created_at = COALESCE(created_at, updated_at, NOW())
    WHERE created_at IS NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at_id
  ON public.activity_logs (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_table_created_at_id
  ON public.activity_logs (table_name, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_table_record_created_at_id
  ON public.activity_logs (table_name, record_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created_at_id
  ON public.activity_logs (user_id, created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION public.redact_audit_json(p_value JSONB)
RETURNS JSONB
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_value IS NULL THEN NULL::JSONB
    WHEN jsonb_typeof(p_value) <> 'object' THEN p_value
    ELSE COALESCE((
      SELECT jsonb_object_agg(
        key,
        CASE
          WHEN lower(key) IN (
            'password', 'password_hash', 'token', 'access_token',
            'refresh_token', 'secret', 'api_key', 'apikey'
          ) THEN '"[REDACTED]"'::JSONB
          ELSE value
        END
      )
      FROM jsonb_each(p_value)
    ), '{}'::JSONB)
  END;
$$;

CREATE OR REPLACE FUNCTION public.audit_changed_fields(
  p_old_values JSONB,
  p_new_values JSONB
)
RETURNS TEXT[]
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE
    WHEN jsonb_typeof(COALESCE(p_old_values, '{}'::JSONB)) <> 'object'
      OR jsonb_typeof(COALESCE(p_new_values, '{}'::JSONB)) <> 'object'
    THEN ARRAY[]::TEXT[]
    ELSE COALESCE((
      SELECT array_agg(key ORDER BY key)
      FROM jsonb_object_keys(
        COALESCE(p_old_values, '{}'::JSONB) || COALESCE(p_new_values, '{}'::JSONB)
      ) AS key
      WHERE (COALESCE(p_old_values, '{}'::JSONB)->key)
        IS DISTINCT FROM (COALESCE(p_new_values, '{}'::JSONB)->key)
    ), ARRAY[]::TEXT[])
  END;
$$;

CREATE OR REPLACE FUNCTION public.enrich_activity_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_name TEXT;
  v_actor_username TEXT;
  v_actor_role TEXT;
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    SELECT u.nama, u.username, u.role::TEXT
    INTO v_actor_name, v_actor_username, v_actor_role
    FROM public.users u
    WHERE u.id = NEW.user_id;
  END IF;

  NEW.actor_name_snapshot := COALESCE(NEW.actor_name_snapshot, v_actor_name);
  NEW.actor_username_snapshot := COALESCE(NEW.actor_username_snapshot, v_actor_username);
  NEW.actor_role_snapshot := COALESCE(NEW.actor_role_snapshot, v_actor_role);
  NEW.source := COALESCE(NULLIF(NEW.source, ''), 'api');
  NEW.old_values := public.redact_audit_json(NEW.old_values);
  NEW.new_values := public.redact_audit_json(NEW.new_values);
  NEW.changed_fields := public.audit_changed_fields(NEW.old_values, NEW.new_values);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enrich_activity_log ON public.activity_logs;
CREATE TRIGGER trg_enrich_activity_log
  BEFORE INSERT ON public.activity_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.enrich_activity_log();

-- Helper atomik untuk endpoint baru. Mutasi lama tetap kompatibel karena trigger
-- di atas otomatis memperkaya INSERT langsung ke activity_logs.
CREATE OR REPLACE FUNCTION public.write_audit_log(
  p_user_id UUID,
  p_action TEXT,
  p_table_name TEXT,
  p_record_id UUID,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_change_reason TEXT DEFAULT NULL,
  p_request_id UUID DEFAULT NULL,
  p_operation_id UUID DEFAULT NULL,
  p_source TEXT DEFAULT 'api',
  p_user_agent TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_action IS NULL OR length(trim(p_action)) = 0 THEN
    RAISE EXCEPTION 'Aksi audit wajib diisi.';
  END IF;

  IF p_change_reason IS NULL OR length(trim(p_change_reason)) < 5 THEN
    RAISE EXCEPTION 'Alasan perubahan minimal 5 karakter.';
  END IF;

  INSERT INTO public.activity_logs (
    user_id, action, table_name, record_id, old_values, new_values,
    change_reason, request_id, operation_id, source, user_agent, metadata
  ) VALUES (
    p_user_id, upper(trim(p_action)), trim(p_table_name), p_record_id,
    p_old_values, p_new_values, trim(p_change_reason), p_request_id,
    p_operation_id, COALESCE(NULLIF(trim(p_source), ''), 'api'),
    p_user_agent, COALESCE(p_metadata, '{}'::JSONB)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.write_audit_log(
  UUID, TEXT, TEXT, UUID, JSONB, JSONB, TEXT, UUID, UUID, TEXT, TEXT, JSONB
) TO service_role;

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
