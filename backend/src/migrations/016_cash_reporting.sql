-- 016_cash_reporting.sql
-- Server-side cash flow and debt reporting for a maximum 90-day period.
-- The report intentionally uses created_at because that is the canonical
-- timestamp already used by the cash API and legacy-compatible schema.

CREATE INDEX IF NOT EXISTS idx_cash_transactions_created_at_type
  ON public.cash_transactions (created_at DESC, type)
  WHERE COALESCE(is_billing, FALSE) = FALSE;

CREATE INDEX IF NOT EXISTS idx_debt_records_created_at_unpaid
  ON public.debt_records (created_at DESC, student_id)
  WHERE status = 'unpaid';

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
      ct.type::TEXT AS transaction_type,
      COALESCE(ct.nominal, 0)::NUMERIC AS nominal,
      COALESCE(ct.is_billing, FALSE) AS is_billing,
      ct.created_at::DATE AS transaction_date,
      COALESCE(NULLIF(TRIM(ct.keterangan), ''), 'Tanpa keterangan') AS keterangan
    FROM public.cash_transactions ct
    WHERE ct.created_at >= p_start_date::TIMESTAMPTZ
      AND ct.created_at < v_end_exclusive
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
      COALESCE(SUM(CASE WHEN transaction_type = 'pengeluaran' THEN nominal ELSE 0 END), 0)::NUMERIC AS total_expense,
      COUNT(*)::INTEGER AS transaction_count
    FROM period_transactions
  )
  SELECT jsonb_build_object(
    'period', jsonb_build_object(
      'start_date', p_start_date,
      'end_date', p_end_date,
      'days', v_days
    ),
    'summary', jsonb_build_object(
      'total_income', summary.total_income,
      'total_expense', summary.total_expense,
      'net_cash_flow', summary.total_income - summary.total_expense,
      'outstanding_debt', COALESCE((SELECT SUM(total_debt) FROM period_debts), 0)::NUMERIC,
      'delinquent_students', COALESCE((SELECT COUNT(*) FROM period_debts), 0)::INTEGER,
      'debt_record_count', COALESCE((SELECT SUM(debt_record_count) FROM period_debts), 0)::INTEGER,
      'transaction_count', summary.transaction_count
    ),
    'flow_breakdown', jsonb_build_array(
      jsonb_build_object('key', 'income', 'label', 'Pemasukan', 'total', summary.total_income),
      jsonb_build_object('key', 'expense', 'label', 'Pengeluaran', 'total', summary.total_expense)
    ),
    'income_breakdown', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'key', transaction_type,
          'label', CASE transaction_type
            WHEN 'iuran_wajib' THEN 'Iuran wajib'
            WHEN 'pemasukan' THEN 'Pemasukan lain-lain'
            ELSE transaction_type
          END,
          'total', total,
          'count', item_count
        ) ORDER BY total DESC
      )
      FROM (
        SELECT transaction_type, SUM(nominal)::NUMERIC AS total, COUNT(*)::INTEGER AS item_count
        FROM period_transactions
        WHERE NOT is_billing AND transaction_type <> 'pengeluaran'
        GROUP BY transaction_type
      ) grouped_income
    ), '[]'::JSONB),
    'expense_breakdown', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'key', 'expense',
          'label', keterangan,
          'total', total,
          'count', item_count
        ) ORDER BY total DESC
      )
      FROM (
        SELECT keterangan, SUM(nominal)::NUMERIC AS total, COUNT(*)::INTEGER AS item_count
        FROM period_transactions
        WHERE transaction_type = 'pengeluaran'
        GROUP BY keterangan
      ) grouped_expense
    ), '[]'::JSONB),
    'daily', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'date', daily_date,
          'income', income,
          'expense', expense
        ) ORDER BY daily_date
      )
      FROM (
        SELECT
          generated_date::DATE AS daily_date,
          COALESCE(SUM(CASE WHEN NOT pt.is_billing AND pt.transaction_type <> 'pengeluaran' THEN pt.nominal ELSE 0 END), 0)::NUMERIC AS income,
          COALESCE(SUM(CASE WHEN pt.transaction_type = 'pengeluaran' THEN pt.nominal ELSE 0 END), 0)::NUMERIC AS expense
        FROM generate_series(p_start_date, p_end_date, INTERVAL '1 day') generated_date
        LEFT JOIN period_transactions pt ON pt.transaction_date = generated_date::DATE
        GROUP BY generated_date::DATE
      ) daily_totals
    ), '[]'::JSONB),
    'debts', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'student_id', period_debts.student_id,
          'student_nama', COALESCE(st.nama, 'Siswa'),
          'nis', st.nis,
          'kelas', st.kelas,
          'total_debt', period_debts.total_debt,
          'debt_record_count', period_debts.debt_record_count,
          'oldest_debt_date', period_debts.oldest_debt_date
        ) ORDER BY period_debts.total_debt DESC, st.nama ASC
      )
      FROM period_debts
      LEFT JOIN public.students st ON st.id = period_debts.student_id
    ), '[]'::JSONB)
  )
  INTO v_report
  FROM summary;

  RETURN v_report;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cash_report(DATE, DATE) TO service_role;

NOTIFY pgrst, 'reload schema';
