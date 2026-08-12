-- 018_cash_accounting_report_hardening.sql
-- Guard ledger kas, audit perubahan kas/utang, dan detail laporan untuk export.

ALTER TABLE public.debt_records
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_debt_records_unpaid_created_student
  ON public.debt_records (created_at DESC, student_id)
  WHERE status = 'unpaid';

CREATE INDEX IF NOT EXISTS idx_cash_transactions_student_created_at
  ON public.cash_transactions (student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_debt_records_student_status_created_at
  ON public.debt_records (student_id, status, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.cash_transactions'::regclass
      AND conname = 'cash_transactions_saldo_sebelum_nonnegative'
  ) THEN
    ALTER TABLE public.cash_transactions
      ADD CONSTRAINT cash_transactions_saldo_sebelum_nonnegative
      CHECK (saldo_sebelum >= 0) NOT VALID;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_cash_transaction_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expected NUMERIC;
  v_current_balance NUMERIC;
  v_actor UUID;
BEGIN
  BEGIN
    v_actor := NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_actor := NULL;
  END;

  IF TG_OP = 'INSERT' AND NEW.created_by IS NULL AND v_actor IS NOT NULL THEN
    NEW.created_by := v_actor;
  END IF;

  IF NEW.nominal IS NULL OR NEW.nominal <= 0 THEN
    RAISE EXCEPTION 'Nominal transaksi kas harus lebih besar dari nol.';
  END IF;

  IF COALESCE(NULLIF(TRIM(NEW.keterangan), ''), '') = '' THEN
    RAISE EXCEPTION 'Keterangan transaksi kas wajib diisi.';
  END IF;

  IF NEW.saldo_sebelum IS NULL OR NEW.saldo_sebelum < 0 THEN
    RAISE EXCEPTION 'Saldo sebelum transaksi tidak valid.';
  END IF;

  v_expected := CASE
    WHEN COALESCE(NEW.is_billing, FALSE) THEN NEW.saldo_sebelum
    WHEN NEW.type::TEXT = 'pengeluaran' THEN NEW.saldo_sebelum - NEW.nominal
    ELSE NEW.saldo_sebelum + NEW.nominal
  END;

  IF NEW.saldo_sesudah IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'Saldo transaksi tidak konsisten. Saldo sesudah harus %.', v_expected;
  END IF;

  IF NEW.saldo_sesudah < 0 THEN
    RAISE EXCEPTION 'Saldo kas tidak boleh negatif.';
  END IF;

  -- Semua jalur INSERT, termasuk direct service-role writes, harus dimulai
  -- dari saldo ledger terakhir. RPC kas juga memakai lock yang sama.
  IF TG_OP = 'INSERT' THEN
    PERFORM pg_advisory_xact_lock(4815162342::BIGINT);
    SELECT COALESCE(SUM(
      CASE
        WHEN COALESCE(is_billing, FALSE) THEN 0
        WHEN type::TEXT = 'pengeluaran' THEN -nominal
        ELSE nominal
      END
    ), 0)
    INTO v_current_balance
    FROM public.cash_transactions;

    IF NEW.saldo_sebelum IS DISTINCT FROM v_current_balance THEN
      RAISE EXCEPTION 'Saldo sebelum transaksi tidak sama dengan saldo ledger terakhir (%).', v_current_balance;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_cash_transaction_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Transaksi kas bersifat append-only. Gunakan transaksi koreksi, bukan UPDATE atau DELETE.';
END;
$$;

DROP TRIGGER IF EXISTS trg_cash_transaction_ledger_guard ON public.cash_transactions;
CREATE TRIGGER trg_cash_transaction_ledger_guard
  BEFORE INSERT OR UPDATE ON public.cash_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_cash_transaction_ledger();

DROP TRIGGER IF EXISTS trg_cash_transaction_immutable ON public.cash_transactions;
CREATE TRIGGER trg_cash_transaction_immutable
  BEFORE UPDATE OR DELETE ON public.cash_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_cash_transaction_mutation();

CREATE OR REPLACE FUNCTION public.enrich_debt_record_state()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID;
BEGIN
  BEGIN
    v_actor := NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_actor := NULL;
  END;

  IF TG_OP = 'INSERT' AND NEW.created_by IS NULL AND v_actor IS NOT NULL THEN
    NEW.created_by := v_actor;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.updated_at := COALESCE(NEW.updated_at, NOW());
    IF NEW.status = 'paid' THEN
      NEW.paid_at := COALESCE(NEW.paid_at, NOW());
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'paid'
       AND (to_jsonb(NEW) - 'updated_at' - 'updated_by')
         IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at' - 'updated_by') THEN
      RAISE EXCEPTION 'Utang yang sudah lunas tidak dapat diubah kembali.';
    END IF;
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'paid' THEN
      NEW.paid_at := COALESCE(NEW.paid_at, NOW());
    END IF;
    NEW.updated_by := COALESCE(v_actor, NEW.updated_by);
    NEW.updated_at := NOW();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enrich_debt_record_state ON public.debt_records;
CREATE TRIGGER trg_enrich_debt_record_state
  BEFORE INSERT OR UPDATE ON public.debt_records
  FOR EACH ROW
  EXECUTE FUNCTION public.enrich_debt_record_state();

CREATE OR REPLACE FUNCTION public.audit_cash_row_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID;
  v_reason TEXT;
  v_system_operation BOOLEAN;
BEGIN
  BEGIN
    v_actor := NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_actor := NULL;
  END;

  v_reason := NULLIF(current_setting('app.change_reason', TRUE), '');
  v_system_operation := COALESCE(NULLIF(current_setting('app.system_operation', TRUE), '') = 'true', FALSE);

  IF v_reason IS NULL OR (v_actor IS NULL AND NOT v_system_operation) THEN
    RAISE EXCEPTION 'Aksi Ditolak: ID aktor dan alasan perubahan wajib tersedia.';
  END IF;

  INSERT INTO public.activity_logs (
    user_id,
    action,
    table_name,
    record_id,
    old_values,
    new_values,
    change_reason
  ) VALUES (
    v_actor,
    TG_OP,
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    LEFT(v_reason, 500)
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_cash_transactions ON public.cash_transactions;
CREATE TRIGGER trg_audit_cash_transactions
  AFTER INSERT ON public.cash_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_cash_row_change();

DROP TRIGGER IF EXISTS trg_audit_debt_records ON public.debt_records;
CREATE TRIGGER trg_audit_debt_records
  AFTER INSERT OR UPDATE OR DELETE ON public.debt_records
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_cash_row_change();

CREATE INDEX IF NOT EXISTS idx_cash_transactions_real_created_at
  ON public.cash_transactions (created_at DESC, id DESC)
  WHERE COALESCE(is_billing, FALSE) = FALSE;

CREATE INDEX IF NOT EXISTS idx_cash_transactions_created_at_id
  ON public.cash_transactions (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_cash_transactions_tanggal_id
  ON public.cash_transactions (tanggal DESC, id DESC);

CREATE OR REPLACE FUNCTION public.get_cash_summary(p_student_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  WITH tx AS (
    SELECT
      COALESCE(SUM(CASE WHEN COALESCE(is_billing, FALSE) THEN 0 WHEN type::TEXT = 'pengeluaran' THEN -nominal ELSE nominal END), 0)::NUMERIC AS balance,
      COALESCE(SUM(CASE WHEN NOT COALESCE(is_billing, FALSE) AND type::TEXT <> 'pengeluaran' THEN nominal ELSE 0 END), 0)::NUMERIC AS income,
      COALESCE(SUM(CASE WHEN NOT COALESCE(is_billing, FALSE) AND type::TEXT = 'pengeluaran' THEN nominal ELSE 0 END), 0)::NUMERIC AS expense
    FROM public.cash_transactions
    WHERE p_student_id IS NULL OR student_id = p_student_id
  ),
  debts AS (
    SELECT COALESCE(SUM(amount), 0)::NUMERIC AS outstanding
    FROM public.debt_records
    WHERE status = 'unpaid'
      AND (p_student_id IS NULL OR student_id = p_student_id)
  )
  SELECT jsonb_build_object(
    'saldoUtama', tx.balance,
    'totalPemasukan', tx.income,
    'totalPengeluaran', tx.expense,
    'totalTunggakanSiswa', debts.outstanding
  )
  FROM tx, debts;
$$;

GRANT EXECUTE ON FUNCTION public.get_cash_summary(UUID) TO service_role;

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
        'key', 'expense',
        'label', keterangan,
        'total', total,
        'count', item_count
      ) ORDER BY total DESC)
      FROM (
        SELECT keterangan, SUM(nominal)::NUMERIC AS total, COUNT(*)::INTEGER AS item_count
        FROM period_transactions
        WHERE NOT is_billing AND transaction_type = 'pengeluaran'
        GROUP BY keterangan
      ) grouped_expense
    ), '[]'::JSONB),
    'daily', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'date', daily_date,
        'income', income,
        'expense', expense
      ) ORDER BY daily_date)
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
        'id', id,
        'date', transaction_date,
        'amount', nominal,
        'note', keterangan
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
