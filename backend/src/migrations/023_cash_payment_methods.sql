-- 023_cash_payment_methods.sql
-- Master metode pembayaran kas yang dapat diperluas tanpa mengubah enum PostgreSQL.
-- Code bersifat stabil untuk integritas histori; label dan status dapat dikelola admin.

CREATE TABLE IF NOT EXISTS public.cash_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cash_payment_methods_code_format CHECK (code ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  CONSTRAINT cash_payment_methods_label_length CHECK (length(trim(label)) BETWEEN 1 AND 80)
);

ALTER TABLE public.cash_payment_methods
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS code TEXT,
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.cash_payment_methods
SET id = COALESCE(id, gen_random_uuid())
WHERE id IS NULL;

ALTER TABLE public.cash_payment_methods
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN is_active SET DEFAULT TRUE,
  ALTER COLUMN sort_order SET DEFAULT 0,
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS cash_payment_methods_pkey
  ON public.cash_payment_methods (id);

-- CREATE TABLE IF NOT EXISTS tidak memperbaiki tabel parsial. Pastikan seed
-- tetap idempoten dan code metode tetap unik pada database lama.
CREATE UNIQUE INDEX IF NOT EXISTS cash_payment_methods_code_key
  ON public.cash_payment_methods (code);

INSERT INTO public.cash_payment_methods (code, label, sort_order)
VALUES
  ('cash', 'Cash', 10),
  ('qris_dana', 'QRIS DANA', 20),
  ('qris_gopay', 'QRIS GoPay', 30)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.cash_transactions
  ADD COLUMN IF NOT EXISTS payment_method_id UUID;

-- Histori lama sengaja tidak di-UPDATE karena migration 018 mengunci ledger
-- sebagai append-only. Nilai NULL pada histori dibaca sebagai Cash oleh RPC
-- report/API; semua transaksi baru diisi oleh trigger di bawah.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.cash_transactions'::regclass
      AND conname = 'cash_transactions_payment_method_id_fkey'
  ) THEN
    ALTER TABLE public.cash_transactions
      ADD CONSTRAINT cash_transactions_payment_method_id_fkey
      FOREIGN KEY (payment_method_id)
      REFERENCES public.cash_payment_methods(id)
      ON DELETE RESTRICT;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_cash_transactions_payment_method_tanggal
  ON public.cash_transactions (payment_method_id, tanggal DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_cash_payment_methods_active_order
  ON public.cash_payment_methods (is_active, sort_order, label);

CREATE OR REPLACE FUNCTION public.protect_default_cash_payment_method()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.code = 'cash' AND NEW.is_active = FALSE THEN
    RAISE EXCEPTION 'Metode Cash adalah fallback histori dan tidak dapat dinonaktifkan.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_default_cash_payment_method ON public.cash_payment_methods;
CREATE TRIGGER trg_protect_default_cash_payment_method
  BEFORE UPDATE OF is_active ON public.cash_payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_default_cash_payment_method();

-- Legacy RPCs and system billing writes that do not know the new field remain
-- compatible. Real transactions are still assigned to the stable Cash method.
CREATE OR REPLACE FUNCTION public.default_cash_payment_method()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_method_id IS NULL THEN
    SELECT id INTO NEW.payment_method_id
    FROM public.cash_payment_methods
    WHERE code = 'cash'
    LIMIT 1;
  END IF;

  IF NEW.payment_method_id IS NULL THEN
    RAISE EXCEPTION 'Metode pembayaran Cash belum tersedia.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_default_cash_payment_method ON public.cash_transactions;
CREATE TRIGGER trg_default_cash_payment_method
  BEFORE INSERT ON public.cash_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.default_cash_payment_method();

CREATE OR REPLACE FUNCTION public.resolve_cash_payment_method_id(p_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_method_id UUID;
BEGIN
  IF p_code IS NULL OR trim(p_code) = '' THEN
    RAISE EXCEPTION 'Metode pembayaran wajib dipilih.';
  END IF;

  SELECT id INTO v_method_id
  FROM public.cash_payment_methods
  WHERE code = lower(trim(p_code))
    AND is_active = TRUE;

  IF v_method_id IS NULL THEN
    RAISE EXCEPTION 'Metode pembayaran tidak tersedia atau sudah dinonaktifkan.';
  END IF;

  RETURN v_method_id;
END;
$$;

-- New income RPC. The old signature remains available for compatibility and
-- receives the Cash default through the trigger above.
CREATE OR REPLACE FUNCTION public.record_cash_in_on_date_with_method_atomic(
  p_student_id TEXT,
  p_nominal NUMERIC,
  p_keterangan TEXT,
  p_type TEXT,
  p_foto_bukti_url TEXT,
  p_created_by TEXT,
  p_idempotency_key TEXT,
  p_change_reason TEXT,
  p_weekly_due NUMERIC,
  p_tanggal DATE,
  p_payment_method_code TEXT
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
  v_payment_method_id UUID;
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
  IF p_student_id IS NOT NULL AND p_student_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'ID siswa untuk pembayaran iuran tidak valid.';
  END IF;
  IF p_type = 'iuran_wajib' AND NOT EXISTS (
    SELECT 1 FROM public.students WHERE id = p_student_id::UUID AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Siswa aktif tidak ditemukan.';
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

  v_payment_method_id := public.resolve_cash_payment_method_id(p_payment_method_code);

  SELECT * INTO v_existing
  FROM public.cash_transactions
  WHERE idempotency_key = p_idempotency_key
  LIMIT 1;
  IF FOUND THEN
    RETURN NEXT v_existing;
    RETURN;
  END IF;

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
    saldo_sebelum, saldo_sesudah, idempotency_key, created_by, is_billing,
    payment_method_id
  ) VALUES (
    p_type::public.transaction_type, p_nominal, TRIM(p_keterangan), v_student_id,
    p_foto_bukti_url, p_tanggal, v_saldo_sebelum, v_saldo_sesudah,
    p_idempotency_key, v_created_by, FALSE, v_payment_method_id
  )
  RETURNING * INTO v_transaction;

  IF p_type = 'iuran_wajib' AND v_student_id IS NOT NULL THEN
    v_payment_remaining := p_nominal;

    SELECT EXISTS (
      SELECT 1 FROM public.debt_records
      WHERE student_id = v_student_id AND periode = v_current_period
    ) INTO v_has_current_debt;

    FOR v_debt IN
      SELECT * FROM public.debt_records
      WHERE student_id = v_student_id AND status = 'unpaid'
      ORDER BY created_at ASC, id ASC
      FOR UPDATE
    LOOP
      IF v_payment_remaining >= v_debt.amount THEN
        UPDATE public.debt_records SET status = 'paid' WHERE id = v_debt.id;
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
        v_student_id, p_weekly_due - v_payment_remaining, 'unpaid',
        'Selisih pembayaran iuran mingguan', v_current_period, v_debt_key, v_created_by
      )
      ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;
  END IF;

  RETURN NEXT v_transaction;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_cash_in_on_date_with_method_atomic(
  TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, DATE, TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.record_cash_out_with_method_atomic(
  p_nominal NUMERIC,
  p_keterangan TEXT,
  p_foto_bukti_url TEXT,
  p_created_by TEXT,
  p_idempotency_key TEXT,
  p_change_reason TEXT,
  p_payment_method_code TEXT
)
RETURNS SETOF public.cash_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.cash_transactions;
  v_transaction public.cash_transactions;
  v_created_by UUID;
  v_payment_method_id UUID;
  v_saldo_sebelum NUMERIC(12,2);
BEGIN
  IF p_nominal IS NULL OR p_nominal <= 0 OR p_nominal > 9999999999.99 THEN
    RAISE EXCEPTION 'Nominal kas keluar harus berupa angka positif yang valid.';
  END IF;
  IF COALESCE(TRIM(p_keterangan), '') = '' THEN
    RAISE EXCEPTION 'Rincian pengeluaran wajib diisi.';
  END IF;
  IF p_idempotency_key IS NULL OR TRIM(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'Idempotency key wajib diisi.';
  END IF;
  IF COALESCE(length(TRIM(p_change_reason)), 0) < 5 THEN
    RAISE EXCEPTION 'Alasan perubahan minimal 5 karakter.';
  END IF;
  IF p_created_by IS NULL OR p_created_by !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'ID aktor transaksi tidak valid.';
  END IF;

  v_payment_method_id := public.resolve_cash_payment_method_id(p_payment_method_code);
  v_created_by := p_created_by::UUID;

  SELECT * INTO v_existing
  FROM public.cash_transactions
  WHERE idempotency_key = p_idempotency_key
  LIMIT 1;
  IF FOUND THEN
    RETURN NEXT v_existing;
    RETURN;
  END IF;

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

  IF p_nominal > v_saldo_sebelum THEN
    RAISE EXCEPTION 'Saldo kas tidak mencukupi untuk pengeluaran ini.';
  END IF;

  PERFORM set_config('app.current_user_id', v_created_by::TEXT, TRUE);
  PERFORM set_config('app.change_reason', LEFT(TRIM(p_change_reason), 500), TRUE);

  INSERT INTO public.cash_transactions (
    type, nominal, keterangan, foto_bukti_url, tanggal,
    saldo_sebelum, saldo_sesudah, idempotency_key, created_by, is_billing,
    payment_method_id
  ) VALUES (
    'pengeluaran', p_nominal, TRIM(p_keterangan), p_foto_bukti_url, CURRENT_DATE,
    v_saldo_sebelum, v_saldo_sebelum - p_nominal, p_idempotency_key,
    v_created_by, FALSE, v_payment_method_id
  )
  RETURNING * INTO v_transaction;

  RETURN NEXT v_transaction;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_cash_out_with_method_atomic(
  NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.get_cash_report_with_method(
  p_start_date DATE,
  p_end_date DATE,
  p_payment_method_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days INTEGER;
  v_report JSONB;
  v_method_code TEXT := NULLIF(lower(trim(p_payment_method_code)), '');
BEGIN
  IF p_start_date IS NULL OR p_end_date IS NULL OR p_end_date < p_start_date THEN
    RAISE EXCEPTION 'Rentang tanggal laporan tidak valid.';
  END IF;
  v_days := p_end_date - p_start_date + 1;
  IF v_days > 90 THEN
    RAISE EXCEPTION 'Rentang laporan maksimal 90 hari.';
  END IF;
  IF v_method_code IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.cash_payment_methods WHERE code = v_method_code
  ) THEN
    RAISE EXCEPTION 'Metode pembayaran tidak ditemukan.';
  END IF;

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
      COALESCE(cpm.code, CASE WHEN ct.payment_method_id IS NULL THEN 'cash' END) AS payment_method_code,
      COALESCE(cpm.label, CASE WHEN ct.payment_method_id IS NULL THEN 'Cash' END) AS payment_method_label,
      s.nama AS student_name,
      s.nis,
      s.kelas
    FROM public.cash_transactions ct
    LEFT JOIN public.cash_payment_methods cpm ON cpm.id = ct.payment_method_id
    LEFT JOIN public.students s ON s.id = ct.student_id
    WHERE ct.tanggal BETWEEN p_start_date AND p_end_date
      AND (
        v_method_code IS NULL
        OR COALESCE(cpm.code, CASE WHEN ct.payment_method_id IS NULL THEN 'cash' END) = v_method_code
      )
  ),
  period_debts AS (
    SELECT dr.student_id, SUM(dr.amount)::NUMERIC AS total_debt,
      COUNT(*)::INTEGER AS debt_record_count, MIN(dr.created_at)::DATE AS oldest_debt_date
    FROM public.debt_records dr
    WHERE dr.status = 'unpaid'
      AND dr.created_at >= p_start_date::TIMESTAMPTZ
      AND dr.created_at < (p_end_date + 1)::TIMESTAMPTZ
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
      COALESCE((SELECT SUM(CASE WHEN COALESCE(is_billing, FALSE) THEN 0 WHEN type::TEXT = 'pengeluaran' THEN -nominal ELSE nominal END) FROM public.cash_transactions WHERE tanggal < p_start_date), 0)::NUMERIC AS opening_balance,
      COALESCE((SELECT SUM(CASE WHEN COALESCE(is_billing, FALSE) THEN 0 WHEN type::TEXT = 'pengeluaran' THEN -nominal ELSE nominal END) FROM public.cash_transactions WHERE tanggal <= p_end_date), 0)::NUMERIC AS closing_balance
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
    'control', CASE WHEN v_method_code IS NULL THEN jsonb_build_object(
      'opening_balance', control.opening_balance,
      'period_net_cash_flow', summary.total_income - summary.total_expense,
      'expected_closing_balance', control.opening_balance + summary.total_income - summary.total_expense,
      'closing_balance', control.closing_balance,
      'difference', control.closing_balance - (control.opening_balance + summary.total_income - summary.total_expense),
      'is_balanced', ABS(control.closing_balance - (control.opening_balance + summary.total_income - summary.total_expense)) <= 0.005
    ) ELSE NULL END,
    'flow_breakdown', jsonb_build_array(
      jsonb_build_object('key', 'income', 'label', 'Pemasukan', 'total', summary.total_income),
      jsonb_build_object('key', 'expense', 'label', 'Pengeluaran', 'total', summary.total_expense)
    ),
    'payment_method_breakdown', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', payment_method_code,
        'label', COALESCE(payment_method_label, 'Metode tidak diketahui'),
        'total', total,
        'count', item_count
      ) ORDER BY total DESC)
      FROM (
        SELECT payment_method_code, payment_method_label, SUM(nominal)::NUMERIC AS total, COUNT(*)::INTEGER AS item_count
        FROM period_transactions
        WHERE NOT is_billing AND transaction_type <> 'pengeluaran'
        GROUP BY payment_method_code, payment_method_label
      ) methods
    ), '[]'::JSONB),
    'income_breakdown', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('key', transaction_type, 'label', CASE transaction_type WHEN 'iuran_wajib' THEN 'Iuran wajib' WHEN 'pemasukan' THEN 'Pemasukan lain-lain' ELSE transaction_type END, 'total', total, 'count', item_count) ORDER BY total DESC)
      FROM (
        SELECT transaction_type, SUM(nominal)::NUMERIC AS total, COUNT(*)::INTEGER AS item_count
        FROM period_transactions WHERE NOT is_billing AND transaction_type <> 'pengeluaran'
        GROUP BY transaction_type
      ) income_rows
    ), '[]'::JSONB),
    'expense_breakdown', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('key', 'expense', 'label', keterangan, 'total', total, 'count', item_count) ORDER BY total DESC)
      FROM (
        SELECT keterangan, SUM(nominal)::NUMERIC AS total, COUNT(*)::INTEGER AS item_count
        FROM period_transactions WHERE NOT is_billing AND transaction_type = 'pengeluaran'
        GROUP BY keterangan
      ) expense_rows
    ), '[]'::JSONB),
    'daily', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('date', generated_date::DATE, 'income', income, 'expense', expense) ORDER BY generated_date::DATE)
      FROM (
        SELECT generated_date,
          COALESCE(SUM(CASE WHEN NOT pt.is_billing AND pt.transaction_type <> 'pengeluaran' THEN pt.nominal ELSE 0 END), 0)::NUMERIC AS income,
          COALESCE(SUM(CASE WHEN NOT pt.is_billing AND pt.transaction_type = 'pengeluaran' THEN pt.nominal ELSE 0 END), 0)::NUMERIC AS expense
        FROM generate_series(p_start_date, p_end_date, INTERVAL '1 day') generated_date
        LEFT JOIN period_transactions pt ON pt.transaction_date = generated_date::DATE
        GROUP BY generated_date
      ) daily_rows
    ), '[]'::JSONB),
    'income_details', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'date', transaction_date, 'type', transaction_type, 'label', CASE transaction_type WHEN 'iuran_wajib' THEN 'Iuran wajib' WHEN 'pemasukan' THEN 'Pemasukan lain-lain' ELSE transaction_type END, 'amount', nominal, 'note', keterangan, 'student_id', student_id, 'student_name', student_name, 'nis', nis, 'kelas', kelas, 'payment_method_code', payment_method_code, 'payment_method_label', payment_method_label) ORDER BY transaction_date DESC, created_at DESC, id DESC)
      FROM period_transactions WHERE NOT is_billing AND transaction_type <> 'pengeluaran'
    ), '[]'::JSONB),
    'expense_details', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'date', transaction_date, 'amount', nominal, 'note', keterangan, 'payment_method_code', payment_method_code, 'payment_method_label', payment_method_label) ORDER BY transaction_date DESC, created_at DESC, id DESC)
      FROM period_transactions WHERE NOT is_billing AND transaction_type = 'pengeluaran'
    ), '[]'::JSONB),
    'debts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('student_id', pd.student_id, 'student_nama', COALESCE(st.nama, 'Siswa'), 'nis', st.nis, 'kelas', st.kelas, 'total_debt', pd.total_debt, 'debt_record_count', pd.debt_record_count, 'oldest_debt_date', pd.oldest_debt_date) ORDER BY pd.total_debt DESC, st.nama ASC)
      FROM period_debts pd LEFT JOIN public.students st ON st.id = pd.student_id
    ), '[]'::JSONB)
  ) INTO v_report
  FROM summary, control;

  RETURN v_report;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cash_report_with_method(DATE, DATE, TEXT) TO service_role;

-- Semua operasi sensitif harus lewat backend Fastify dengan service_role.
-- REVOKE PUBLIC juga mencakup anon/authenticated karena keduanya mewarisi
-- privilege PUBLIC pada function PostgreSQL bila tidak dibatasi.
REVOKE EXECUTE ON FUNCTION public.default_cash_payment_method() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.protect_default_cash_payment_method() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resolve_cash_payment_method_id(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_cash_in_on_date_with_method_atomic(
  TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, DATE, TEXT
) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_cash_out_with_method_atomic(
  NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_cash_report_with_method(DATE, DATE, TEXT) FROM PUBLIC;

ALTER TABLE public.cash_payment_methods ENABLE ROW LEVEL SECURITY;
NOTIFY pgrst, 'reload schema';
