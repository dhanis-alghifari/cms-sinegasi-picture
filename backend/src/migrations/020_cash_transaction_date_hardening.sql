-- 020_cash_transaction_date_hardening.sql
-- Business date for manually entered cash transactions.
-- The ledger keeps created_at for audit/order-of-write and uses tanggal for
-- accounting periods, filters, and report output.

ALTER TABLE public.cash_transactions
  ADD COLUMN IF NOT EXISTS tanggal DATE DEFAULT CURRENT_DATE;

-- Migration 012 already backfilled historical rows. Migration 018 makes the
-- ledger append-only, so do not issue an UPDATE here: if an old/partial
-- database still contains NULL dates, fail explicitly and repair it before
-- installing this migration rather than bypassing the immutability trigger.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.cash_transactions
    WHERE tanggal IS NULL
  ) THEN
    RAISE EXCEPTION 'cash_transactions.tanggal masih NULL. Jalankan migration 012_cash_ledger_hardening.sql terlebih dahulu.';
  END IF;
END;
$$;

ALTER TABLE public.cash_transactions
  ALTER COLUMN tanggal SET DEFAULT CURRENT_DATE,
  ALTER COLUMN tanggal SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cash_transactions_tanggal_id
  ON public.cash_transactions (tanggal DESC, id DESC);

CREATE OR REPLACE FUNCTION public.record_cash_in_on_date_atomic(
  p_student_id TEXT,
  p_nominal NUMERIC,
  p_keterangan TEXT,
  p_type TEXT,
  p_foto_bukti_url TEXT,
  p_created_by TEXT,
  p_idempotency_key TEXT,
  p_change_reason TEXT,
  p_weekly_due NUMERIC,
  p_tanggal DATE
)
RETURNS SETOF public.cash_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.cash_transactions;
  v_transaction public.cash_transactions;
  v_debt public.debt_records;
  v_student_id UUID;
  v_created_by UUID;
  v_saldo_sebelum NUMERIC(12,2);
  v_saldo_sesudah NUMERIC(12,2);
  v_payment_remaining NUMERIC(12,2);
  v_current_period TEXT;
  v_has_current_debt BOOLEAN := FALSE;
  v_debt_key TEXT;
BEGIN
  IF p_tanggal IS NULL THEN
    RAISE EXCEPTION 'Tanggal transaksi wajib diisi.';
  END IF;
  IF p_nominal IS NULL OR p_nominal <= 0 OR p_nominal > 9999999999.99 THEN
    RAISE EXCEPTION 'Nominal kas masuk harus berupa angka positif yang valid.';
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
  IF p_created_by IS NULL OR p_created_by !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'ID aktor transaksi tidak valid.';
  END IF;
  IF p_idempotency_key IS NULL OR TRIM(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'Idempotency key wajib diisi.';
  END IF;
  IF COALESCE(length(TRIM(p_change_reason)), 0) < 5 THEN
    RAISE EXCEPTION 'Alasan perubahan minimal 5 karakter.';
  END IF;

  SELECT * INTO v_existing
  FROM public.cash_transactions
  WHERE idempotency_key = p_idempotency_key
  LIMIT 1;
  IF FOUND THEN
    RETURN NEXT v_existing;
    RETURN;
  END IF;

  -- Serialize all ledger writes so saldo_sebelum/saldo_sesudah remains valid.
  PERFORM pg_advisory_xact_lock(4815162342::BIGINT);

  SELECT * INTO v_existing
  FROM public.cash_transactions
  WHERE idempotency_key = p_idempotency_key
  LIMIT 1;
  IF FOUND THEN
    RETURN NEXT v_existing;
    RETURN;
  END IF;

  SELECT COALESCE(SUM(
    CASE
      WHEN COALESCE(is_billing, FALSE) THEN 0
      WHEN type::TEXT = 'pengeluaran' THEN -nominal
      ELSE nominal
    END
  ), 0)
  INTO v_saldo_sebelum
  FROM public.cash_transactions;

  v_saldo_sesudah := v_saldo_sebelum + p_nominal;
  v_student_id := CASE WHEN p_type = 'iuran_wajib' THEN p_student_id::UUID ELSE NULL END;
  v_created_by := p_created_by::UUID;
  v_current_period := to_char(p_tanggal, 'IYYY-IW');

  PERFORM set_config('app.current_user_id', v_created_by::TEXT, TRUE);
  PERFORM set_config('app.change_reason', LEFT(TRIM(p_change_reason), 500), TRUE);

  INSERT INTO public.cash_transactions (
    type, nominal, keterangan, student_id, foto_bukti_url, tanggal,
    saldo_sebelum, saldo_sesudah, idempotency_key, created_by, is_billing
  ) VALUES (
    p_type::public.transaction_type, p_nominal, TRIM(p_keterangan), v_student_id,
    p_foto_bukti_url, p_tanggal, v_saldo_sebelum, v_saldo_sesudah,
    p_idempotency_key, v_created_by, FALSE
  )
  RETURNING * INTO v_transaction;

  -- Apply the payment to the oldest unpaid debts and create the selected
  -- business week's shortfall when the payment is below the obligation.
  IF p_type = 'iuran_wajib' AND v_student_id IS NOT NULL THEN
    v_payment_remaining := p_nominal;

    SELECT EXISTS (
      SELECT 1
      FROM public.debt_records
      WHERE student_id = v_student_id AND periode = v_current_period
    ) INTO v_has_current_debt;

    FOR v_debt IN
      SELECT *
      FROM public.debt_records
      WHERE student_id = v_student_id AND status = 'unpaid'
      ORDER BY created_at ASC, id ASC
      FOR UPDATE
    LOOP
      IF v_payment_remaining >= v_debt.amount THEN
        UPDATE public.debt_records
        SET status = 'paid'
        WHERE id = v_debt.id;
        v_payment_remaining := v_payment_remaining - v_debt.amount;
      ELSE
        UPDATE public.debt_records
        SET amount = v_debt.amount - v_payment_remaining
        WHERE id = v_debt.id;
        v_payment_remaining := 0;
        EXIT;
      END IF;
      EXIT WHEN v_payment_remaining <= 0;
    END LOOP;

    IF NOT v_has_current_debt AND COALESCE(p_weekly_due, 0) > v_payment_remaining THEN
      v_debt_key := 'manual-weekly-' || v_current_period || '-' || v_student_id::TEXT;
      INSERT INTO public.debt_records (
        student_id, amount, status, keterangan, periode, idempotency_key, created_by
      ) VALUES (
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

GRANT EXECUTE ON FUNCTION public.record_cash_in_on_date_atomic(
  TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, DATE
) TO service_role;

-- Re-publish the report function for databases that already ran 018 before
-- this migration. Reports must use the business date, not insertion time.
CREATE OR REPLACE FUNCTION public.get_cash_report(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_end_exclusive TIMESTAMPTZ;
  v_days INTEGER;
  v_report JSONB;
BEGIN
  IF p_start_date IS NULL OR p_end_date IS NULL THEN
    RAISE EXCEPTION 'Tanggal mulai dan tanggal selesai wajib diisi.';
  END IF;

  v_days := p_end_date - p_start_date + 1;
  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'Tanggal selesai tidak boleh sebelum tanggal mulai.';
  END IF;
  IF v_days > 90 THEN
    RAISE EXCEPTION 'Rentang laporan maksimal 90 hari.';
  END IF;

  v_end_exclusive := (p_end_date + 1)::TIMESTAMPTZ;

  WITH period_transactions AS (
    SELECT
      ct.id,
      ct.student_id,
      ct.type::TEXT AS transaction_type,
      COALESCE(ct.nominal, 0)::NUMERIC AS nominal,
      COALESCE(ct.is_billing, FALSE) AS is_billing,
      ct.created_at,
      COALESCE(ct.tanggal, ct.created_at::DATE) AS transaction_date,
      COALESCE(NULLIF(TRIM(ct.keterangan), ''), 'Tanpa keterangan') AS keterangan,
      s.nama AS student_name,
      s.nis,
      s.kelas
    FROM public.cash_transactions ct
    LEFT JOIN public.students s ON s.id = ct.student_id
    WHERE ct.tanggal >= p_start_date
      AND ct.tanggal <= p_end_date
  ),
  period_debts AS (
    SELECT
      dr.student_id,
      COALESCE(SUM(dr.amount), 0)::NUMERIC AS total_debt,
      COUNT(*)::INTEGER AS debt_record_count,
      MIN(dr.created_at)::DATE AS oldest_debt_date
    FROM public.debt_records dr
    WHERE dr.status = 'unpaid'
      AND dr.created_at >= p_start_date::TIMESTAMPTZ
      AND dr.created_at < v_end_exclusive
    GROUP BY dr.student_id
  ),
  summary AS (
    SELECT
      COALESCE(SUM(CASE WHEN NOT is_billing AND transaction_type <> 'pengeluaran' THEN nominal ELSE 0 END), 0)::NUMERIC AS total_income,
      COALESCE(SUM(CASE WHEN NOT is_billing AND transaction_type = 'pengeluaran' THEN nominal ELSE 0 END), 0)::NUMERIC AS total_expense,
      COUNT(*) FILTER (WHERE NOT is_billing)::INTEGER AS transaction_count
    FROM period_transactions
  ),
  control AS (
    SELECT
      COALESCE((
        SELECT SUM(CASE
          WHEN COALESCE(ct.is_billing, FALSE) THEN 0
          WHEN ct.type::TEXT = 'pengeluaran' THEN -ct.nominal
          ELSE ct.nominal
        END)
        FROM public.cash_transactions ct
        WHERE ct.tanggal < p_start_date
      ), 0)::NUMERIC AS opening_balance,
      COALESCE((
        SELECT SUM(CASE
          WHEN COALESCE(ct.is_billing, FALSE) THEN 0
          WHEN ct.type::TEXT = 'pengeluaran' THEN -ct.nominal
          ELSE ct.nominal
        END)
        FROM public.cash_transactions ct
        WHERE ct.tanggal <= p_end_date
      ), 0)::NUMERIC AS closing_balance
  )
  SELECT jsonb_build_object(
    'period', jsonb_build_object('start_date', p_start_date, 'end_date', p_end_date, 'days', v_days),
    'summary', jsonb_build_object(
      'total_income', summary.total_income,
      'total_expense', summary.total_expense,
      'net_cash_flow', summary.total_income - summary.total_expense,
      'outstanding_debt', COALESCE((SELECT SUM(total_debt) FROM period_debts), 0)::NUMERIC,
      'delinquent_students', COALESCE((SELECT COUNT(*) FROM period_debts), 0)::INTEGER,
      'debt_record_count', COALESCE((SELECT SUM(debt_record_count) FROM period_debts), 0)::INTEGER,
      'transaction_count', summary.transaction_count
    ),
    'control', jsonb_build_object(
      'opening_balance', control.opening_balance,
      'period_net_cash_flow', summary.total_income - summary.total_expense,
      'expected_closing_balance', control.opening_balance + summary.total_income - summary.total_expense,
      'closing_balance', control.closing_balance,
      'difference', control.closing_balance - (control.opening_balance + summary.total_income - summary.total_expense),
      'is_balanced', ABS(control.closing_balance - (control.opening_balance + summary.total_income - summary.total_expense)) <= 0.005
    ),
    'flow_breakdown', jsonb_build_array(
      jsonb_build_object('key', 'income', 'label', 'Pemasukan', 'total', summary.total_income),
      jsonb_build_object('key', 'expense', 'label', 'Pengeluaran', 'total', summary.total_expense)
    ),
    'income_breakdown', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', transaction_type,
        'label', CASE transaction_type
          WHEN 'iuran_wajib' THEN 'Iuran wajib'
          WHEN 'pemasukan' THEN 'Pemasukan lain-lain'
          ELSE transaction_type
        END,
        'total', total,
        'count', item_count
      ) ORDER BY total DESC)
      FROM (
        SELECT transaction_type, SUM(nominal)::NUMERIC AS total, COUNT(*)::INTEGER AS item_count
        FROM period_transactions
        WHERE NOT is_billing AND transaction_type <> 'pengeluaran'
        GROUP BY transaction_type
      ) grouped_income
    ), '[]'::JSONB),
    'expense_breakdown', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', 'expense', 'label', keterangan, 'total', total, 'count', item_count
      ) ORDER BY total DESC)
      FROM (
        SELECT keterangan, SUM(nominal)::NUMERIC AS total, COUNT(*)::INTEGER AS item_count
        FROM period_transactions
        WHERE NOT is_billing AND transaction_type = 'pengeluaran'
        GROUP BY keterangan
      ) grouped_expense
    ), '[]'::JSONB),
    'daily', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('date', daily_date, 'income', income, 'expense', expense) ORDER BY daily_date)
      FROM (
        SELECT
          generated_date::DATE AS daily_date,
          COALESCE(SUM(CASE WHEN NOT pt.is_billing AND pt.transaction_type <> 'pengeluaran' THEN pt.nominal ELSE 0 END), 0)::NUMERIC AS income,
          COALESCE(SUM(CASE WHEN NOT pt.is_billing AND pt.transaction_type = 'pengeluaran' THEN pt.nominal ELSE 0 END), 0)::NUMERIC AS expense
        FROM generate_series(p_start_date, p_end_date, INTERVAL '1 day') generated_date
        LEFT JOIN period_transactions pt ON pt.transaction_date = generated_date::DATE
        GROUP BY generated_date::DATE
      ) daily_totals
    ), '[]'::JSONB),
    'income_details', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'date', transaction_date,
        'type', transaction_type,
        'label', CASE transaction_type WHEN 'iuran_wajib' THEN 'Iuran wajib' WHEN 'pemasukan' THEN 'Pemasukan lain-lain' ELSE transaction_type END,
        'amount', nominal,
        'note', keterangan,
        'student_id', student_id,
        'student_name', student_name,
        'nis', nis,
        'kelas', kelas
      ) ORDER BY transaction_date DESC, created_at DESC, id DESC)
      FROM period_transactions
      WHERE NOT is_billing AND transaction_type <> 'pengeluaran'
    ), '[]'::JSONB),
    'expense_details', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'date', transaction_date, 'amount', nominal, 'note', keterangan
      ) ORDER BY transaction_date DESC, created_at DESC, id DESC)
      FROM period_transactions
      WHERE NOT is_billing AND transaction_type = 'pengeluaran'
    ), '[]'::JSONB),
    'debts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'student_id', period_debts.student_id,
        'student_nama', COALESCE(st.nama, 'Siswa'),
        'nis', st.nis,
        'kelas', st.kelas,
        'total_debt', period_debts.total_debt,
        'debt_record_count', period_debts.debt_record_count,
        'oldest_debt_date', period_debts.oldest_debt_date
      ) ORDER BY period_debts.total_debt DESC, st.nama ASC)
      FROM period_debts
      LEFT JOIN public.students st ON st.id = period_debts.student_id
    ), '[]'::JSONB)
  )
  INTO v_report
  FROM summary, control;

  RETURN v_report;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cash_report(DATE, DATE) TO service_role;

NOTIFY pgrst, 'reload schema';
