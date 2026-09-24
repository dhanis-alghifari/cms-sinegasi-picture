-- 075_cash_dispute_derive_debt_amount.sql
-- Derive approved debt settlements from the locked debt row.

BEGIN;

SELECT set_config('app.system_operation', 'true', true);
SELECT set_config('app.change_reason', 'SYSTEM:MIGRATION_075_CASH_DISPUTE_DERIVE_DEBT_AMOUNT', true);

DO $$
BEGIN
  IF to_regprocedure('public.review_cash_dispute_atomic(uuid,text,text,uuid,date,numeric,text)') IS NULL THEN
    RAISE EXCEPTION 'CASH_DISPUTE_REVIEW_FUNCTION_MISSING';
  END IF;
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
    IF p_resolution_date IS NULL OR p_payment_method_code IS NULL THEN
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

    -- Keep old clients safe while making the database value authoritative.
    IF p_resolution_amount IS NOT NULL
       AND (p_resolution_amount <= 0 OR p_resolution_amount IS DISTINCT FROM v_debt.amount) THEN
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
        v_debt.amount,
        'Pembayaran terverifikasi melalui sanggahan kas',
        v_dispute.student_id,
        NULL,
        p_resolution_date,
        v_balance,
        v_balance + v_debt.amount,
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

GRANT EXECUTE ON FUNCTION public.review_cash_dispute_atomic(UUID, TEXT, TEXT, UUID, DATE, NUMERIC, TEXT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.review_cash_dispute_atomic(UUID, TEXT, TEXT, UUID, DATE, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
