-- 046_cash_dispute_monthly_quota.sql
-- Monthly cash-dispute quota, retry history, lazy evidence, and atomic review.
-- This migration is additive, idempotent, and executed by applyCashMigration.

ALTER TABLE public.cash_disputes
  ADD COLUMN IF NOT EXISTS quota_period_start DATE,
  ADD COLUMN IF NOT EXISTS attempt_number SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS previous_dispute_id UUID REFERENCES public.cash_disputes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS review_note TEXT,
  ADD COLUMN IF NOT EXISTS resolution_transaction_id UUID REFERENCES public.cash_transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.debt_records
  ADD COLUMN IF NOT EXISTS settled_transaction_id UUID REFERENCES public.cash_transactions(id) ON DELETE SET NULL;

UPDATE public.cash_disputes
SET quota_period_start = date_trunc('month', created_at AT TIME ZONE 'Asia/Jakarta')::DATE
WHERE quota_period_start IS NULL;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY CASE
        WHEN transaction_id IS NOT NULL THEN 'transaction:' || transaction_id::TEXT
        ELSE 'debt:' || debt_record_id::TEXT
      END
      ORDER BY created_at ASC, id ASC
    ) AS attempt_number,
    lag(id) OVER (
      PARTITION BY CASE
        WHEN transaction_id IS NOT NULL THEN 'transaction:' || transaction_id::TEXT
        ELSE 'debt:' || debt_record_id::TEXT
      END
      ORDER BY created_at ASC, id ASC
    ) AS previous_dispute_id
  FROM public.cash_disputes
)
UPDATE public.cash_disputes target
SET attempt_number = ranked.attempt_number::SMALLINT,
    previous_dispute_id = ranked.previous_dispute_id
FROM ranked
WHERE target.id = ranked.id
  AND (
    target.attempt_number IS DISTINCT FROM ranked.attempt_number::SMALLINT
    OR target.previous_dispute_id IS DISTINCT FROM ranked.previous_dispute_id
  );

UPDATE public.cash_disputes
SET idempotency_key = 'legacy:' || id::TEXT
WHERE idempotency_key IS NULL;

UPDATE public.cash_disputes
SET review_note = 'Diselesaikan sebelum catatan pemeriksaan diwajibkan.'
WHERE status IN ('approved', 'rejected')
  AND length(trim(COALESCE(review_note, ''))) < 5;

ALTER TABLE public.cash_disputes
  ALTER COLUMN quota_period_start SET DEFAULT date_trunc('month', NOW() AT TIME ZONE 'Asia/Jakarta')::DATE,
  ALTER COLUMN quota_period_start SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.cash_disputes
    WHERE transaction_id IS NOT NULL AND status IN ('pending', 'approved')
    GROUP BY transaction_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'MIGRATION_PREFLIGHT_FAILED: duplicate active transaction disputes detected';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.cash_disputes
    WHERE debt_record_id IS NOT NULL AND status IN ('pending', 'approved')
    GROUP BY debt_record_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'MIGRATION_PREFLIGHT_FAILED: duplicate active debt disputes detected';
  END IF;
END;
$$;

ALTER TABLE public.cash_disputes
  DROP CONSTRAINT IF EXISTS cash_disputes_attempt_number_check,
  DROP CONSTRAINT IF EXISTS cash_disputes_idempotency_key_check,
  DROP CONSTRAINT IF EXISTS cash_disputes_review_note_check;

ALTER TABLE public.cash_disputes
  ADD CONSTRAINT cash_disputes_attempt_number_check CHECK (attempt_number > 0),
  ADD CONSTRAINT cash_disputes_idempotency_key_check CHECK (
    idempotency_key IS NULL OR length(trim(idempotency_key)) BETWEEN 8 AND 128
  ),
  ADD CONSTRAINT cash_disputes_review_note_check CHECK (
    status = 'pending' OR length(trim(COALESCE(review_note, ''))) >= 5
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_disputes_student_idempotency
  ON public.cash_disputes(student_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_disputes_active_transaction
  ON public.cash_disputes(transaction_id)
  WHERE transaction_id IS NOT NULL AND status IN ('pending', 'approved');

CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_disputes_active_debt
  ON public.cash_disputes(debt_record_id)
  WHERE debt_record_id IS NOT NULL AND status IN ('pending', 'approved');

CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_disputes_transaction_attempt
  ON public.cash_disputes(transaction_id, attempt_number)
  WHERE transaction_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_disputes_debt_attempt
  ON public.cash_disputes(debt_record_id, attempt_number)
  WHERE debt_record_id IS NOT NULL;

DROP INDEX IF EXISTS public.uq_cash_disputes_transaction;
DROP INDEX IF EXISTS public.uq_cash_disputes_debt_record;

CREATE INDEX IF NOT EXISTS idx_cash_disputes_student_quota_period
  ON public.cash_disputes(student_id, quota_period_start);

CREATE INDEX IF NOT EXISTS idx_cash_disputes_student_history
  ON public.cash_disputes(student_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_cash_disputes_review_queue
  ON public.cash_disputes(status, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_cash_disputes_transaction_history
  ON public.cash_disputes(transaction_id, created_at DESC, id DESC)
  WHERE transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cash_disputes_debt_history
  ON public.cash_disputes(debt_record_id, created_at DESC, id DESC)
  WHERE debt_record_id IS NOT NULL;

INSERT INTO public.access_permissions (permission_key, label)
VALUES
  ('cash.read.own', 'Cash Read Own'),
  ('cash.dispute.create', 'Cash Dispute Create'),
  ('cash.dispute.read.own', 'Cash Dispute Read Own'),
  ('cash.dispute.review', 'Cash Dispute Review')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO public.access_role_permissions (role_key, permission_key)
VALUES
  ('teacher', 'cash.read.own'),
  ('teacher', 'cash.dispute.create'),
  ('teacher', 'cash.dispute.read.own'),
  ('teacher', 'cash.dispute.review'),
  ('treasurer', 'cash.read.own'),
  ('treasurer', 'cash.dispute.create'),
  ('treasurer', 'cash.dispute.review'),
  ('member', 'cash.read.own'),
  ('member', 'cash.dispute.create'),
  ('member', 'cash.dispute.read.own')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_cash_dispute_quota(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period DATE := date_trunc('month', NOW() AT TIME ZONE 'Asia/Jakarta')::DATE;
  v_used INTEGER;
  v_limit CONSTANT INTEGER := 2;
  v_resets_at TIMESTAMPTZ;
BEGIN
  IF p_student_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'STUDENT_SCOPE_UNAVAILABLE';
  END IF;

  SELECT count(*)::INTEGER
  INTO v_used
  FROM public.cash_disputes
  WHERE student_id = p_student_id
    AND quota_period_start = v_period;

  v_resets_at := ((v_period + INTERVAL '1 month')::TIMESTAMP AT TIME ZONE 'Asia/Jakarta');

  RETURN jsonb_build_object(
    'period', to_char(v_period, 'YYYY-MM'),
    'period_start', v_period,
    'limit', v_limit,
    'used', LEAST(v_used, v_limit),
    'remaining', GREATEST(v_limit - v_used, 0),
    'resets_at', v_resets_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_cash_dispute_atomic(
  p_student_id UUID,
  p_transaction_id UUID,
  p_debt_record_id UUID,
  p_reason TEXT,
  p_evidence_value TEXT,
  p_actor_id UUID,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period DATE := date_trunc('month', NOW() AT TIME ZONE 'Asia/Jakarta')::DATE;
  v_existing public.cash_disputes;
  v_created public.cash_disputes;
  v_previous_id UUID;
  v_attempt SMALLINT;
  v_used INTEGER;
  v_target_student_id UUID;
  v_transaction_type TEXT;
  v_debt_status TEXT;
BEGIN
  IF p_student_id IS NULL OR p_actor_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_IDENTITY_INVALID';
  END IF;
  IF (p_transaction_id IS NULL) = (p_debt_record_id IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_TARGET_INVALID';
  END IF;
  IF length(trim(COALESCE(p_reason, ''))) NOT BETWEEN 10 AND 2000 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_REASON_INVALID';
  END IF;
  IF length(trim(COALESCE(p_evidence_value, ''))) NOT BETWEEN 1 AND 900000
    OR trim(p_evidence_value) !~* '^(data:image/|https?://)' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_EVIDENCE_INVALID';
  END IF;
  IF length(trim(COALESCE(p_idempotency_key, ''))) NOT BETWEEN 8 AND 128 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'IDEMPOTENCY_KEY_INVALID';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_actor_id AND is_active = TRUE) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_ACTOR_INVALID';
  END IF;

  IF p_transaction_id IS NOT NULL THEN
    SELECT student_id, type::TEXT
    INTO v_target_student_id, v_transaction_type
    FROM public.cash_transactions
    WHERE id = p_transaction_id;
    IF NOT FOUND OR v_transaction_type NOT IN ('iuran_wajib', 'pemasukan') THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_TARGET_NOT_FOUND';
    END IF;
  ELSE
    SELECT student_id, status::TEXT
    INTO v_target_student_id, v_debt_status
    FROM public.debt_records
    WHERE id = p_debt_record_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_TARGET_NOT_FOUND';
    END IF;
    IF v_debt_status <> 'unpaid' THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_TARGET_SETTLED';
    END IF;
  END IF;

  IF v_target_student_id IS DISTINCT FROM p_student_id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_TARGET_FORBIDDEN';
  END IF;

  SELECT * INTO v_existing
  FROM public.cash_disputes
  WHERE student_id = p_student_id
    AND idempotency_key = trim(p_idempotency_key)
  LIMIT 1;
  IF FOUND THEN
    IF v_existing.transaction_id IS DISTINCT FROM p_transaction_id
      OR v_existing.debt_record_id IS DISTINCT FROM p_debt_record_id THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'IDEMPOTENCY_KEY_REUSED';
    END IF;
    RETURN jsonb_build_object(
      'dispute', (to_jsonb(v_existing) - 'bukti_sanggahan_url') || jsonb_build_object('has_evidence', TRUE),
      'quota', public.get_cash_dispute_quota(p_student_id),
      'idempotent_replay', TRUE
    );
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('cash-dispute:' || p_student_id::TEXT || ':' || v_period::TEXT, 0)
  );

  SELECT * INTO v_existing
  FROM public.cash_disputes
  WHERE student_id = p_student_id
    AND idempotency_key = trim(p_idempotency_key)
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'dispute', (to_jsonb(v_existing) - 'bukti_sanggahan_url') || jsonb_build_object('has_evidence', TRUE),
      'quota', public.get_cash_dispute_quota(p_student_id),
      'idempotent_replay', TRUE
    );
  END IF;

  SELECT * INTO v_existing
  FROM public.cash_disputes
  WHERE (
    (p_transaction_id IS NOT NULL AND transaction_id = p_transaction_id)
    OR (p_debt_record_id IS NOT NULL AND debt_record_id = p_debt_record_id)
  )
    AND status IN ('pending', 'approved')
  ORDER BY created_at DESC, id DESC
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = CASE WHEN v_existing.status = 'pending' THEN 'DISPUTE_PENDING' ELSE 'DISPUTE_ALREADY_APPROVED' END;
  END IF;

  SELECT count(*)::INTEGER
  INTO v_used
  FROM public.cash_disputes
  WHERE student_id = p_student_id
    AND quota_period_start = v_period;
  IF v_used >= 2 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'DISPUTE_MONTHLY_QUOTA_EXHAUSTED',
      DETAIL = public.get_cash_dispute_quota(p_student_id)::TEXT;
  END IF;

  SELECT id, (attempt_number + 1)::SMALLINT
  INTO v_previous_id, v_attempt
  FROM public.cash_disputes
  WHERE (
    (p_transaction_id IS NOT NULL AND transaction_id = p_transaction_id)
    OR (p_debt_record_id IS NOT NULL AND debt_record_id = p_debt_record_id)
  )
  ORDER BY attempt_number DESC, created_at DESC, id DESC
  LIMIT 1;
  v_attempt := COALESCE(v_attempt, 1);

  PERFORM set_config('app.current_user_id', p_actor_id::TEXT, TRUE);
  PERFORM set_config('app.change_reason', 'Pengajuan sanggahan kas', TRUE);

  INSERT INTO public.cash_disputes (
    transaction_id, debt_record_id, student_id, reason, alasan_sanggahan,
    bukti_sanggahan_url, status, quota_period_start, attempt_number,
    previous_dispute_id, idempotency_key, created_by, updated_by, updated_at
  ) VALUES (
    p_transaction_id, p_debt_record_id, p_student_id, trim(p_reason), trim(p_reason),
    trim(p_evidence_value), 'pending', v_period, v_attempt,
    v_previous_id, trim(p_idempotency_key), p_actor_id, p_actor_id, NOW()
  )
  RETURNING * INTO v_created;

  RETURN jsonb_build_object(
    'dispute', (to_jsonb(v_created) - 'bukti_sanggahan_url') || jsonb_build_object('has_evidence', TRUE),
    'quota', public.get_cash_dispute_quota(p_student_id),
    'idempotent_replay', FALSE
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.review_cash_dispute_atomic(
  p_dispute_id UUID,
  p_status TEXT,
  p_review_note TEXT,
  p_actor_id UUID,
  p_resolution_date DATE,
  p_resolution_amount NUMERIC,
  p_payment_method_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dispute public.cash_disputes;
  v_debt public.debt_records;
  v_transaction public.cash_transactions;
  v_payment_method_id UUID;
  v_balance NUMERIC(12,2);
  v_transaction_key TEXT;
BEGIN
  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_STATUS_INVALID';
  END IF;
  IF length(trim(COALESCE(p_review_note, ''))) NOT BETWEEN 5 AND 2000 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_REVIEW_NOTE_INVALID';
  END IF;
  IF p_actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_actor_id AND is_active = TRUE AND role::TEXT IN ('teacher', 'treasurer')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_REVIEWER_INVALID';
  END IF;

  SELECT * INTO v_dispute
  FROM public.cash_disputes
  WHERE id = p_dispute_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_NOT_FOUND';
  END IF;

  IF v_dispute.status <> 'pending' THEN
    IF v_dispute.status = p_status THEN
      RETURN jsonb_build_object(
        'dispute', (to_jsonb(v_dispute) - 'bukti_sanggahan_url') || jsonb_build_object('has_evidence', TRUE),
        'idempotent_replay', TRUE
      );
    END IF;
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_ALREADY_RESOLVED';
  END IF;

  PERFORM set_config('app.current_user_id', p_actor_id::TEXT, TRUE);
  PERFORM set_config('app.change_reason', LEFT(trim(p_review_note), 500), TRUE);

  IF p_status = 'approved' AND v_dispute.debt_record_id IS NOT NULL THEN
    IF p_resolution_date IS NULL OR p_resolution_amount IS NULL OR p_payment_method_code IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_RESOLUTION_REQUIRED';
    END IF;
    IF p_resolution_date > (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_RESOLUTION_DATE_INVALID';
    END IF;

    SELECT * INTO v_debt
    FROM public.debt_records
    WHERE id = v_dispute.debt_record_id
    FOR UPDATE;
    IF NOT FOUND OR v_debt.status::TEXT <> 'unpaid' THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_DEBT_ALREADY_SETTLED';
    END IF;
    IF p_resolution_amount <= 0 OR p_resolution_amount IS DISTINCT FROM v_debt.amount THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'DISPUTE_RESOLUTION_AMOUNT_INVALID',
        DETAIL = jsonb_build_object('expected_amount', v_debt.amount)::TEXT;
    END IF;

    v_payment_method_id := public.resolve_cash_payment_method_id(p_payment_method_code);
    v_transaction_key := 'cash-dispute-resolution:' || v_dispute.id::TEXT;
    PERFORM pg_advisory_xact_lock(4815162342::BIGINT);

    SELECT * INTO v_transaction
    FROM public.cash_transactions
    WHERE idempotency_key = v_transaction_key
    LIMIT 1;

    IF NOT FOUND THEN
      SELECT COALESCE(SUM(
        CASE
          WHEN COALESCE(is_billing, FALSE) THEN 0
          WHEN type::TEXT = 'pengeluaran' THEN -nominal
          ELSE nominal
        END
      ), 0)
      INTO v_balance
      FROM public.cash_transactions;

      INSERT INTO public.cash_transactions (
        type, nominal, keterangan, student_id, foto_bukti_url, tanggal,
        saldo_sebelum, saldo_sesudah, idempotency_key, created_by,
        is_billing, payment_method_id
      ) VALUES (
        'iuran_wajib'::public.transaction_type,
        p_resolution_amount,
        'Pembayaran terverifikasi melalui sanggahan kas',
        v_dispute.student_id,
        NULL,
        p_resolution_date,
        v_balance,
        v_balance + p_resolution_amount,
        v_transaction_key,
        p_actor_id,
        FALSE,
        v_payment_method_id
      )
      RETURNING * INTO v_transaction;
    END IF;

    UPDATE public.debt_records
    SET status = 'paid',
        paid_at = COALESCE(paid_at, NOW()),
        settled_transaction_id = v_transaction.id,
        updated_by = p_actor_id,
        updated_at = NOW()
    WHERE id = v_debt.id;
  ELSIF v_dispute.transaction_id IS NOT NULL
    AND (p_resolution_date IS NOT NULL OR p_resolution_amount IS NOT NULL OR p_payment_method_code IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_RESOLUTION_NOT_APPLICABLE';
  END IF;

  UPDATE public.cash_disputes
  SET status = p_status,
      review_note = trim(p_review_note),
      resolved_by = p_actor_id,
      resolved_at = NOW(),
      resolution_transaction_id = v_transaction.id,
      updated_by = p_actor_id,
      updated_at = NOW()
  WHERE id = v_dispute.id
  RETURNING * INTO v_dispute;

  RETURN jsonb_build_object(
    'dispute', (to_jsonb(v_dispute) - 'bukti_sanggahan_url') || jsonb_build_object('has_evidence', TRUE),
    'resolution_transaction_id', v_dispute.resolution_transaction_id,
    'idempotent_replay', FALSE
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_notify_cash_dispute()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_user_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, type, title, body, message, is_read, metadata)
    SELECT
      users.id,
      'cash_dispute_response'::notification_type,
      'Sanggahan kas baru',
      'Ada laporan sanggahan kas baru yang perlu diperiksa.',
      'Ada laporan sanggahan kas baru yang perlu diperiksa.',
      FALSE,
      jsonb_build_object(
        'dispute_id', NEW.id,
        'student_id', NEW.student_id,
        'attempt_number', NEW.attempt_number
      )
    FROM public.users
    WHERE users.is_active = TRUE
      AND users.role::TEXT IN ('teacher', 'treasurer');
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT user_id INTO v_student_user_id
    FROM public.students
    WHERE id = NEW.student_id;

    IF v_student_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, message, is_read, metadata)
      VALUES (
        v_student_user_id,
        'cash_dispute_response'::notification_type,
        CASE WHEN NEW.status = 'approved' THEN 'Sanggahan kas disetujui' ELSE 'Sanggahan kas ditolak' END,
        CASE WHEN NEW.status = 'approved'
          THEN 'Bukti pembayaran Anda telah diverifikasi.'
          ELSE 'Sanggahan kas Anda ditolak. Periksa catatan reviewer sebelum mengajukan ulang.'
        END,
        CASE WHEN NEW.status = 'approved'
          THEN 'Bukti pembayaran Anda telah diverifikasi.'
          ELSE 'Sanggahan kas Anda ditolak. Periksa catatan reviewer sebelum mengajukan ulang.'
        END,
        FALSE,
        jsonb_build_object(
          'dispute_id', NEW.id,
          'status', NEW.status,
          'attempt_number', NEW.attempt_number,
          'review_note', NEW.review_note
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cash_dispute_quota(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_cash_dispute_atomic(UUID, UUID, UUID, TEXT, TEXT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.review_cash_dispute_atomic(UUID, TEXT, TEXT, UUID, DATE, NUMERIC, TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_cash_dispute_quota(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_cash_dispute_atomic(UUID, UUID, UUID, TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.review_cash_dispute_atomic(UUID, TEXT, TEXT, UUID, DATE, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
