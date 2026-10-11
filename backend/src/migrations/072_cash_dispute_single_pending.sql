-- 072_cash_dispute_single_pending.sql
-- Allows only one pending dispute per student at a time. A student may still
-- use the existing two-attempt monthly quota sequentially after review.

BEGIN;

SELECT set_config('app.system_operation', 'true', true);
SELECT set_config('app.change_reason', 'SYSTEM:MIGRATION_072_CASH_DISPUTE_SINGLE_PENDING', true);

DO $$
BEGIN
  IF to_regclass('public.cash_disputes') IS NULL
     OR to_regprocedure('public.get_cash_dispute_quota(uuid)') IS NULL THEN
    RAISE EXCEPTION 'CASH_DISPUTE_SINGLE_PENDING_SCHEMA_MISSING';
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_cash_disputes_student_pending
  ON public.cash_disputes (student_id, created_at DESC, id DESC)
  WHERE status = 'pending';

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
SET search_path = public, pg_temp
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

  -- The advisory lock makes the pending check and insert atomic per student.
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

  -- A student resolves one dispute at a time across both transactions and
  -- debts. Rejected disputes can still be retried after the teacher reviews.
  SELECT * INTO v_existing
  FROM public.cash_disputes
  WHERE student_id = p_student_id
    AND status = 'pending'
  ORDER BY created_at DESC, id DESC
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_PENDING';
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

REVOKE EXECUTE ON FUNCTION public.create_cash_dispute_atomic(UUID,UUID,UUID,TEXT,TEXT,UUID,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_cash_dispute_atomic(UUID,UUID,UUID,TEXT,TEXT,UUID,TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
