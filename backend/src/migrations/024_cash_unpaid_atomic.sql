-- 024_cash_unpaid_atomic.sql
-- Pencatatan iuran belum bayar tanpa memalsukan transaksi kas bernilai nol.

-- Label standar diperbaiki di master data; code tetap stabil untuk histori/API.
UPDATE public.cash_payment_methods
SET label = CASE code
  WHEN 'cash' THEN 'Cash'
  WHEN 'qris_dana' THEN 'QRIS DANA'
  WHEN 'qris_gopay' THEN 'QRIS GoPay'
  ELSE label
END,
updated_at = NOW()
WHERE code IN ('cash', 'qris_dana', 'qris_gopay');

CREATE INDEX IF NOT EXISTS idx_debt_records_student_periode_created_at
  ON public.debt_records (student_id, periode, created_at DESC, id DESC);

-- Mengembalikan hasil bisnis yang lengkap karena pencatatan unpaid tidak memiliki
-- cash_transactions untuk dikembalikan.
CREATE OR REPLACE FUNCTION public.record_cash_in_with_status_atomic(
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
RETURNS JSONB
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
  v_payment_remaining NUMERIC(12,2);
  v_current_period TEXT;
  v_debt_key TEXT;
  v_has_current_debt BOOLEAN := FALSE;
  v_payment_status TEXT;
  v_amount_outstanding NUMERIC(12,2) := 0;
  v_already_recorded BOOLEAN := FALSE;
BEGIN
  IF p_tanggal IS NULL THEN
    RAISE EXCEPTION 'Tanggal transaksi wajib diisi.';
  END IF;
  IF p_nominal IS NULL OR p_nominal < 0 OR p_nominal > 9999999999.99 THEN
    RAISE EXCEPTION 'Nominal kas masuk harus nol atau angka positif yang valid.';
  END IF;
  IF COALESCE(TRIM(p_keterangan), '') = '' THEN
    RAISE EXCEPTION 'Keterangan kas masuk wajib diisi.';
  END IF;
  IF p_type NOT IN ('iuran_wajib', 'pemasukan') THEN
    RAISE EXCEPTION 'Tipe pemasukan kas tidak valid.';
  END IF;
  IF p_type = 'iuran_wajib' AND p_student_id IS NULL THEN
    RAISE EXCEPTION 'Siswa wajib dipilih untuk pencatatan iuran.';
  END IF;
  IF p_nominal = 0 AND p_type <> 'iuran_wajib' THEN
    RAISE EXCEPTION 'Pemasukan lain-lain harus memiliki nominal lebih besar dari nol.';
  END IF;
  IF p_student_id IS NOT NULL AND p_student_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'ID siswa untuk pembayaran iuran tidak valid.';
  END IF;
  IF p_type = 'iuran_wajib' AND NOT EXISTS (
    SELECT 1 FROM public.students
    WHERE id = p_student_id::UUID AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Siswa aktif tidak ditemukan.';
  END IF;
  IF p_created_by IS NULL OR p_created_by !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'ID aktor transaksi tidak valid.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_created_by::UUID AND is_active = TRUE) THEN
    RAISE EXCEPTION 'Aktor transaksi tidak aktif atau tidak ditemukan.';
  END IF;
  IF p_idempotency_key IS NULL OR TRIM(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'Idempotency key wajib diisi.';
  END IF;
  IF COALESCE(length(TRIM(p_change_reason)), 0) < 5 THEN
    RAISE EXCEPTION 'Alasan perubahan minimal 5 karakter.';
  END IF;

  v_student_id := CASE WHEN p_type = 'iuran_wajib' THEN p_student_id::UUID ELSE NULL END;
  v_created_by := p_created_by::UUID;
  v_current_period := to_char(p_tanggal, 'IYYY-IW');
  v_debt_key := CASE
    WHEN v_student_id IS NOT NULL THEN 'manual-weekly-' || v_current_period || '-' || v_student_id::TEXT
    ELSE NULL
  END;

  -- Nol berarti tidak ada kanal pembayaran. Jangan menerima code agar data
  -- akuntansi tidak menyatakan seolah-olah uang diterima melalui suatu kanal.
  IF p_nominal = 0 THEN
    IF NULLIF(TRIM(p_payment_method_code), '') IS NOT NULL THEN
      RAISE EXCEPTION 'Metode pembayaran harus kosong jika iuran belum dibayar.';
    END IF;
    -- PostgreSQL CURRENT_DATE mengikuti timezone session (umumnya UTC di
    -- Supabase), sedangkan tanggal transaksi bisnis mengikuti WIB.
    IF p_tanggal > (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE THEN
      RAISE EXCEPTION 'Tunggakan belum dapat dicatat untuk tanggal yang akan datang.';
    END IF;
    IF COALESCE(p_weekly_due, 0) <= 0 THEN
      RAISE EXCEPTION 'Konfigurasi iuran wajib tidak valid.';
    END IF;

    -- Serialisasi kewajiban siswa+minggu agar dua klik bersamaan tidak
    -- menghasilkan dua catatan tunggakan sebelum unique key diproses.
    PERFORM pg_advisory_xact_lock(hashtext(v_debt_key));

    -- Satu kewajiban mingguan per siswa. Retry dengan key berbeda tetap aman.
    SELECT * INTO v_debt
    FROM public.debt_records
    WHERE student_id = v_student_id AND periode = v_current_period
    ORDER BY created_at DESC, id DESC
    LIMIT 1;
    IF FOUND THEN
      v_already_recorded := TRUE;
      v_amount_outstanding := CASE WHEN v_debt.status::TEXT = 'unpaid' THEN v_debt.amount ELSE 0 END;
      RETURN jsonb_build_object(
        'payment_status', CASE WHEN v_amount_outstanding > 0 THEN 'unpaid' ELSE 'paid' END,
        'already_recorded', TRUE,
        'cash_transaction', NULL,
        'debt', to_jsonb(v_debt),
        'amount_due', p_weekly_due,
        'amount_paid', GREATEST(p_weekly_due - v_amount_outstanding, 0),
        'amount_outstanding', v_amount_outstanding,
        'payment_method', NULL
      );
    END IF;

    PERFORM set_config('app.current_user_id', v_created_by::TEXT, TRUE);
    PERFORM set_config('app.change_reason', LEFT(TRIM(p_change_reason), 500), TRUE);

    INSERT INTO public.debt_records (
      student_id, amount, status, keterangan, periode, idempotency_key, created_by
    ) VALUES (
      v_student_id,
      p_weekly_due,
      'unpaid',
      'Iuran mingguan belum dibayar',
      v_current_period,
      v_debt_key,
      v_created_by
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING * INTO v_debt;

    IF v_debt.id IS NULL THEN
      SELECT * INTO v_debt
      FROM public.debt_records
      WHERE idempotency_key = v_debt_key;
      v_already_recorded := TRUE;
    END IF;

    RETURN jsonb_build_object(
      'payment_status', 'unpaid',
      'already_recorded', v_already_recorded,
      'cash_transaction', NULL,
      'debt', to_jsonb(v_debt),
      'amount_due', p_weekly_due,
      'amount_paid', 0,
      'amount_outstanding', v_debt.amount,
      'payment_method', NULL
    );
  END IF;

  v_payment_method_id := public.resolve_cash_payment_method_id(p_payment_method_code);

  SELECT * INTO v_existing
  FROM public.cash_transactions
  WHERE idempotency_key = p_idempotency_key
  LIMIT 1;
  IF FOUND THEN
    IF v_student_id IS NOT NULL THEN
      SELECT * INTO v_debt
      FROM public.debt_records
      WHERE student_id = v_student_id AND periode = v_current_period AND status = 'unpaid'
      ORDER BY created_at DESC, id DESC
      LIMIT 1;
    END IF;
    v_amount_outstanding := COALESCE(v_debt.amount, 0);
    RETURN jsonb_build_object(
      'payment_status', CASE WHEN v_amount_outstanding > 0 THEN 'partial' ELSE 'paid' END,
      'already_recorded', TRUE,
      'cash_transaction', to_jsonb(v_existing),
      'debt', CASE WHEN v_debt.id IS NULL THEN NULL ELSE to_jsonb(v_debt) END,
      'amount_due', CASE WHEN v_student_id IS NULL THEN 0 ELSE COALESCE(p_weekly_due, 0) END,
      'amount_paid', CASE WHEN v_student_id IS NULL THEN p_nominal ELSE GREATEST(COALESCE(p_weekly_due, 0) - v_amount_outstanding, 0) END,
      'amount_outstanding', v_amount_outstanding,
      'payment_method', p_payment_method_code
    );
  END IF;

  -- Serialisasi ledger dan kewajiban dilakukan dalam transaksi yang sama.
  PERFORM pg_advisory_xact_lock(4815162342::BIGINT);

  SELECT * INTO v_existing
  FROM public.cash_transactions
  WHERE idempotency_key = p_idempotency_key
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'payment_status', 'paid',
      'already_recorded', TRUE,
      'cash_transaction', to_jsonb(v_existing),
      'debt', NULL,
      'amount_due', CASE WHEN v_student_id IS NULL THEN 0 ELSE COALESCE(p_weekly_due, 0) END,
      'amount_paid', p_nominal,
      'amount_outstanding', 0,
      'payment_method', p_payment_method_code
    );
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

  PERFORM set_config('app.current_user_id', v_created_by::TEXT, TRUE);
  PERFORM set_config('app.change_reason', LEFT(TRIM(p_change_reason), 500), TRUE);

  INSERT INTO public.cash_transactions (
    type, nominal, keterangan, student_id, foto_bukti_url, tanggal,
    saldo_sebelum, saldo_sesudah, idempotency_key, created_by, is_billing,
    payment_method_id
  ) VALUES (
    p_type::public.transaction_type,
    p_nominal,
    TRIM(p_keterangan),
    v_student_id,
    p_foto_bukti_url,
    p_tanggal,
    v_saldo_sebelum,
    v_saldo_sebelum + p_nominal,
    p_idempotency_key,
    v_created_by,
    FALSE,
    v_payment_method_id
  )
  RETURNING * INTO v_transaction;

  IF v_student_id IS NULL THEN
    RETURN jsonb_build_object(
      'payment_status', 'paid',
      'already_recorded', FALSE,
      'cash_transaction', to_jsonb(v_transaction),
      'debt', NULL,
      'amount_due', 0,
      'amount_paid', p_nominal,
      'amount_outstanding', 0,
      'payment_method', p_payment_method_code
    );
  END IF;

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

  SELECT * INTO v_debt
  FROM public.debt_records
  WHERE student_id = v_student_id
    AND periode = v_current_period
    AND status = 'unpaid'
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  v_amount_outstanding := COALESCE(v_debt.amount, 0);
  v_payment_status := CASE WHEN v_amount_outstanding > 0 THEN 'partial' ELSE 'paid' END;

  RETURN jsonb_build_object(
    'payment_status', v_payment_status,
    'already_recorded', FALSE,
    'cash_transaction', to_jsonb(v_transaction),
    'debt', CASE WHEN v_debt.id IS NULL THEN NULL ELSE to_jsonb(v_debt) END,
    'amount_due', COALESCE(p_weekly_due, 0),
    'amount_paid', GREATEST(COALESCE(p_weekly_due, 0) - v_amount_outstanding, 0),
    'amount_outstanding', v_amount_outstanding,
    'payment_method', p_payment_method_code
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_cash_in_with_status_atomic(
  TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, DATE, TEXT
) TO service_role;

REVOKE EXECUTE ON FUNCTION public.record_cash_in_with_status_atomic(
  TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, DATE, TEXT
) FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
