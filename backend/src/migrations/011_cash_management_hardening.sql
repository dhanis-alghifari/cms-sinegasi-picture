-- 011_cash_management_hardening.sql
-- Atomic cash ledger, persisted billing settings, weekly debt generation,
-- and one-dispute-per-transaction protection.

ALTER TABLE cash_transactions
  ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id) ON DELETE SET NULL;
ALTER TABLE cash_transactions
  ADD COLUMN IF NOT EXISTS foto_bukti_url TEXT;
ALTER TABLE cash_transactions
  ADD COLUMN IF NOT EXISTS is_billing BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_cash_transactions_created_at ON cash_transactions(created_at DESC);

CREATE TABLE IF NOT EXISTS cash_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE),
  nominal_iuran_wajib NUMERIC(12,2) NOT NULL DEFAULT 5000 CHECK (nominal_iuran_wajib >= 500),
  holiday_start_date DATE,
  holiday_end_date DATE,
  skip_week BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cash_settings_holiday_range CHECK (
    holiday_start_date IS NULL OR holiday_end_date IS NULL OR holiday_start_date <= holiday_end_date
  )
);

INSERT INTO cash_settings (id, nominal_iuran_wajib)
VALUES (TRUE, 5000)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS cash_billing_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_week DATE NOT NULL UNIQUE,
  nominal_iuran_wajib NUMERIC(12,2) NOT NULL CHECK (nominal_iuran_wajib >= 500),
  students_billed INTEGER NOT NULL DEFAULT 0,
  total_nominal NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('generated', 'skipped_holiday', 'skipped_manual', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_disputes_transaction
  ON cash_disputes(transaction_id)
  WHERE transaction_id IS NOT NULL;

CREATE OR REPLACE FUNCTION record_cash_in_atomic(
  p_student_id TEXT,
  p_nominal NUMERIC,
  p_keterangan TEXT,
  p_type TEXT,
  p_foto_bukti_url TEXT,
  p_created_by TEXT,
  p_idempotency_key TEXT,
  p_change_reason TEXT,
  p_weekly_due NUMERIC
)
RETURNS SETOF cash_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing cash_transactions;
  v_transaction cash_transactions;
  v_debt debt_records;
  v_student_id UUID;
  v_created_by UUID;
  v_saldo_sebelum NUMERIC(12,2);
  v_saldo_sesudah NUMERIC(12,2);
  v_payment_remaining NUMERIC(12,2);
  v_current_period TEXT;
  v_has_current_debt BOOLEAN := FALSE;
  v_debt_key TEXT;
BEGIN
  IF p_nominal IS NULL OR p_nominal <= 0 THEN
    RAISE EXCEPTION 'Nominal kas masuk harus lebih besar dari nol.';
  END IF;
  IF COALESCE(TRIM(p_keterangan), '') = '' THEN
    RAISE EXCEPTION 'Keterangan kas masuk wajib diisi.';
  END IF;
  IF p_type NOT IN ('iuran_wajib', 'pemasukan') THEN
    RAISE EXCEPTION 'Tipe kas masuk tidak valid.';
  END IF;
  IF p_type = 'iuran_wajib' AND p_student_id IS NULL THEN
    RAISE EXCEPTION 'Siswa wajib dipilih untuk pembayaran iuran.';
  END IF;
  IF p_type = 'iuran_wajib' AND p_student_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'ID siswa untuk pembayaran iuran tidak valid.';
  END IF;
  IF p_idempotency_key IS NULL OR TRIM(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'Idempotency key wajib diisi.';
  END IF;

  SELECT * INTO v_existing
  FROM cash_transactions
  WHERE idempotency_key = p_idempotency_key
  LIMIT 1;
  IF FOUND THEN
    RETURN NEXT v_existing;
    RETURN;
  END IF;

  -- Serialize ledger writes. saldo_sebelum/sesudah must never be calculated concurrently.
  PERFORM pg_advisory_xact_lock(4815162342);

  SELECT * INTO v_existing
  FROM cash_transactions
  WHERE idempotency_key = p_idempotency_key
  LIMIT 1;
  IF FOUND THEN
    RETURN NEXT v_existing;
    RETURN;
  END IF;

  SELECT COALESCE(SUM(CASE WHEN is_billing THEN 0 WHEN type = 'pengeluaran' THEN -nominal ELSE nominal END), 0)
  INTO v_saldo_sebelum
  FROM cash_transactions;
  v_saldo_sesudah := v_saldo_sebelum + p_nominal;
  v_student_id := CASE WHEN p_type = 'iuran_wajib' THEN p_student_id::UUID ELSE NULL END;
  v_created_by := CASE WHEN p_created_by ~* '^[0-9a-f-]{36}$' THEN p_created_by::UUID ELSE NULL END;
  v_current_period := to_char(CURRENT_DATE, 'IYYY-IW');

  PERFORM set_config('app.current_user_id', COALESCE(v_created_by::TEXT, ''), TRUE);
  PERFORM set_config(
    'app.change_reason',
    LEFT(COALESCE(NULLIF(TRIM(p_change_reason), ''), 'Pencatatan transaksi kas masuk'), 500),
    TRUE
  );

  INSERT INTO cash_transactions (
    type, nominal, keterangan, student_id, foto_bukti_url,
    saldo_sebelum, saldo_sesudah, idempotency_key, created_by, is_billing
  ) VALUES (
    p_type::transaction_type, p_nominal, TRIM(p_keterangan), v_student_id, p_foto_bukti_url,
    v_saldo_sebelum, v_saldo_sesudah, p_idempotency_key, v_created_by, FALSE
  )
  RETURNING * INTO v_transaction;

  -- A payment settles the oldest open debts first. If no debt exists yet and
  -- the payment is below the active weekly obligation, create the shortfall.
  IF p_type = 'iuran_wajib' AND v_student_id IS NOT NULL THEN
    v_payment_remaining := p_nominal;
    SELECT EXISTS (
      SELECT 1 FROM debt_records
      WHERE student_id = v_student_id AND periode = v_current_period
    ) INTO v_has_current_debt;
    FOR v_debt IN
      SELECT * FROM debt_records
      WHERE student_id = v_student_id AND status = 'unpaid'
      ORDER BY created_at ASC, id ASC
      FOR UPDATE
    LOOP
      IF v_payment_remaining >= v_debt.amount THEN
        UPDATE debt_records SET status = 'paid' WHERE id = v_debt.id;
        v_payment_remaining := v_payment_remaining - v_debt.amount;
      ELSE
        UPDATE debt_records SET amount = v_debt.amount - v_payment_remaining WHERE id = v_debt.id;
        v_payment_remaining := 0;
        EXIT;
      END IF;
      EXIT WHEN v_payment_remaining <= 0;
    END LOOP;

    IF NOT v_has_current_debt AND COALESCE(p_weekly_due, 0) > v_payment_remaining THEN
      v_debt_key := 'manual-weekly-' || v_current_period || '-' || v_student_id::TEXT;
      INSERT INTO debt_records (student_id, amount, status, keterangan, periode, idempotency_key, created_by)
      VALUES (
        v_student_id,
        p_weekly_due - v_payment_remaining,
        'unpaid',
        'Selisih pembayaran iuran mingguan',
        v_current_period,
        v_debt_key,
        v_created_by
      )
      ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;
  END IF;

  RETURN NEXT v_transaction;
END;
$$;

CREATE OR REPLACE FUNCTION record_cash_out_atomic(
  p_nominal NUMERIC,
  p_keterangan TEXT,
  p_foto_bukti_url TEXT,
  p_created_by TEXT,
  p_idempotency_key TEXT,
  p_change_reason TEXT
)
RETURNS SETOF cash_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing cash_transactions;
  v_transaction cash_transactions;
  v_created_by UUID;
  v_saldo_sebelum NUMERIC(12,2);
  v_saldo_sesudah NUMERIC(12,2);
BEGIN
  IF p_nominal IS NULL OR p_nominal <= 0 THEN
    RAISE EXCEPTION 'Nominal kas keluar harus lebih besar dari nol.';
  END IF;
  IF COALESCE(TRIM(p_keterangan), '') = '' THEN
    RAISE EXCEPTION 'Rincian pengeluaran wajib diisi.';
  END IF;
  IF p_idempotency_key IS NULL OR TRIM(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'Idempotency key wajib diisi.';
  END IF;

  SELECT * INTO v_existing
  FROM cash_transactions
  WHERE idempotency_key = p_idempotency_key
  LIMIT 1;
  IF FOUND THEN
    RETURN NEXT v_existing;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(4815162342);
  SELECT * INTO v_existing
  FROM cash_transactions
  WHERE idempotency_key = p_idempotency_key
  LIMIT 1;
  IF FOUND THEN
    RETURN NEXT v_existing;
    RETURN;
  END IF;
  SELECT COALESCE(SUM(CASE WHEN is_billing THEN 0 WHEN type = 'pengeluaran' THEN -nominal ELSE nominal END), 0)
  INTO v_saldo_sebelum
  FROM cash_transactions;
  IF p_nominal > v_saldo_sebelum THEN
    RAISE EXCEPTION 'Saldo kas tidak mencukupi untuk pengeluaran ini.';
  END IF;
  v_saldo_sesudah := v_saldo_sebelum - p_nominal;
  v_created_by := CASE WHEN p_created_by ~* '^[0-9a-f-]{36}$' THEN p_created_by::UUID ELSE NULL END;

  PERFORM set_config('app.current_user_id', COALESCE(v_created_by::TEXT, ''), TRUE);
  PERFORM set_config(
    'app.change_reason',
    LEFT(COALESCE(NULLIF(TRIM(p_change_reason), ''), 'Pencatatan transaksi kas keluar'), 500),
    TRUE
  );

  INSERT INTO cash_transactions (
    type, nominal, keterangan, foto_bukti_url,
    saldo_sebelum, saldo_sesudah, idempotency_key, created_by, is_billing
  ) VALUES (
    'pengeluaran', p_nominal, TRIM(p_keterangan), p_foto_bukti_url,
    v_saldo_sebelum, v_saldo_sesudah, p_idempotency_key, v_created_by, FALSE
  )
  RETURNING * INTO v_transaction;

  RETURN NEXT v_transaction;
END;
$$;

CREATE OR REPLACE FUNCTION generate_weekly_cash_billing(p_run_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (students_billed INTEGER, total_nominal NUMERIC, status TEXT, billing_week DATE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings cash_settings;
  v_week DATE := date_trunc('week', p_run_date)::DATE;
  v_run_id UUID;
  v_student RECORD;
  v_count INTEGER := 0;
  v_total NUMERIC := 0;
  v_status TEXT := 'generated';
BEGIN
  PERFORM pg_advisory_xact_lock(4815162342);
  PERFORM set_config('app.system_operation', 'true', TRUE);
  PERFORM set_config('app.current_user_id', '', TRUE);
  PERFORM set_config('app.change_reason', 'SYSTEM:WEEKLY_BILLING', TRUE);
  SELECT * INTO v_settings FROM cash_settings WHERE id = TRUE FOR UPDATE;

  IF v_settings.holiday_start_date IS NOT NULL
     AND v_week >= v_settings.holiday_start_date
     AND (v_settings.holiday_end_date IS NULL OR v_week <= v_settings.holiday_end_date) THEN
    v_status := 'skipped_holiday';
  END IF;
  IF v_settings.skip_week THEN
    IF v_status = 'generated' THEN
      v_status := 'skipped_manual';
    END IF;
    UPDATE cash_settings SET skip_week = FALSE, updated_at = NOW() WHERE id = TRUE;
  END IF;

  INSERT INTO cash_billing_runs (billing_week, nominal_iuran_wajib, status)
  VALUES (v_week, v_settings.nominal_iuran_wajib, v_status)
  ON CONFLICT (billing_week) DO NOTHING
  RETURNING id INTO v_run_id;

  IF v_run_id IS NULL THEN
    RETURN QUERY SELECT 0, 0::NUMERIC, 'already_processed'::TEXT, v_week;
    RETURN;
  END IF;

  IF v_status <> 'generated' THEN
    RETURN QUERY SELECT 0, 0::NUMERIC, v_status, v_week;
    RETURN;
  END IF;

  FOR v_student IN SELECT id FROM students WHERE is_active = TRUE LOOP
    INSERT INTO debt_records (student_id, amount, status, keterangan, periode, idempotency_key)
    VALUES (
      v_student.id,
      v_settings.nominal_iuran_wajib,
      'unpaid',
      'Tagihan iuran mingguan',
      to_char(v_week, 'IYYY-IW'),
      'weekly-billing-' || to_char(v_week, 'IYYY-IW') || '-' || v_student.id::TEXT
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
    IF FOUND THEN
      v_count := v_count + 1;
      v_total := v_total + v_settings.nominal_iuran_wajib;
    END IF;

    -- Show the generated bill in cash history without inflating real cash.
    -- A bill is a receivable; cash balance changes only when the student pays.
    INSERT INTO cash_transactions (
      type, nominal, keterangan, student_id, saldo_sebelum, saldo_sesudah,
      idempotency_key, is_billing
    )
    SELECT
      'iuran_wajib',
      v_settings.nominal_iuran_wajib,
      'Tagihan iuran mingguan',
      v_student.id,
      COALESCE(SUM(CASE WHEN is_billing THEN 0 WHEN type = 'pengeluaran' THEN -nominal ELSE nominal END), 0),
      COALESCE(SUM(CASE WHEN is_billing THEN 0 WHEN type = 'pengeluaran' THEN -nominal ELSE nominal END), 0),
      'weekly-billing-tx-' || to_char(v_week, 'IYYY-IW') || '-' || v_student.id::TEXT,
      TRUE
    FROM cash_transactions
    ON CONFLICT (idempotency_key) DO NOTHING;
  END LOOP;

  UPDATE cash_billing_runs
  SET students_billed = v_count, total_nominal = v_total
  WHERE id = v_run_id;

  INSERT INTO activity_logs (action, table_name, new_values, change_reason)
  VALUES (
    'SYSTEM_CHECK',
    'debt_records',
    jsonb_build_object('billing_week', v_week, 'students_billed', v_count, 'total_nominal', v_total),
    'SYSTEM:WEEKLY_BILLING'
  );

  RETURN QUERY SELECT v_count, v_total, v_status, v_week;
END;
$$;

-- Ensure PostgREST sees the newly created table/functions immediately when this
-- migration is executed through Supabase SQL Editor or a PostgreSQL runner.
NOTIFY pgrst, 'reload schema';
