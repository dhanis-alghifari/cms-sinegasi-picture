-- 012_cash_legacy_schema_upgrade.sql
-- Normalize the legacy cash schema currently used by the deployed database.
-- Existing legacy columns are preserved for compatibility; the backend uses
-- the canonical columns added below.

DO $$ BEGIN
  CREATE TYPE transaction_type AS ENUM ('iuran_wajib', 'pemasukan', 'pengeluaran', 'koreksi');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.cash_transactions
  ADD COLUMN IF NOT EXISTS type transaction_type,
  ADD COLUMN IF NOT EXISTS nominal NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS saldo_sebelum NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS saldo_sesudah NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS tipe TEXT,
  ADD COLUMN IF NOT EXISTS jumlah NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS tanggal DATE;

-- Legacy columns were required by the old schema. They are retained but no
-- longer required by the canonical ledger functions.
ALTER TABLE public.cash_transactions
  ALTER COLUMN tipe DROP NOT NULL,
  ALTER COLUMN jumlah DROP NOT NULL,
  ALTER COLUMN tanggal DROP NOT NULL,
  ALTER COLUMN tanggal SET DEFAULT CURRENT_DATE;

UPDATE public.cash_transactions
SET type = CASE
  WHEN tipe = 'keluar' THEN 'pengeluaran'::transaction_type
  WHEN student_id IS NOT NULL THEN 'iuran_wajib'::transaction_type
  ELSE 'pemasukan'::transaction_type
END
WHERE type IS NULL;

UPDATE public.cash_transactions
SET nominal = COALESCE(jumlah, 1)
WHERE nominal IS NULL;

UPDATE public.cash_transactions
SET tipe = CASE WHEN type = 'pengeluaran'::transaction_type THEN 'keluar' ELSE 'masuk' END,
    jumlah = nominal,
    tanggal = COALESCE(tanggal, created_at::DATE)
WHERE tipe IS NULL OR jumlah IS NULL OR tanggal IS NULL;

WITH ordered AS (
  SELECT
    id,
    COALESCE(SUM(CASE
      WHEN COALESCE(is_billing, FALSE) THEN 0
      WHEN type = 'pengeluaran'::transaction_type THEN -nominal
      ELSE nominal
    END) OVER (
      ORDER BY created_at, id
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ), 0) AS saldo_sebelum,
    COALESCE(SUM(CASE
      WHEN COALESCE(is_billing, FALSE) THEN 0
      WHEN type = 'pengeluaran'::transaction_type THEN -nominal
      ELSE nominal
    END) OVER (
      ORDER BY created_at, id
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ), 0) AS saldo_sesudah
  FROM public.cash_transactions
)
UPDATE public.cash_transactions target
SET saldo_sebelum = ordered.saldo_sebelum,
    saldo_sesudah = ordered.saldo_sesudah
FROM ordered
WHERE target.id = ordered.id;

ALTER TABLE public.cash_transactions
  ALTER COLUMN type SET NOT NULL,
  ALTER COLUMN nominal SET NOT NULL,
  ALTER COLUMN saldo_sebelum SET NOT NULL,
  ALTER COLUMN saldo_sesudah SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.cash_transactions
    ADD CONSTRAINT cash_transactions_nominal_positive CHECK (nominal > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.cash_transactions
    ADD CONSTRAINT cash_transactions_saldo_nonnegative CHECK (saldo_sesudah >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_cash_transactions_type ON public.cash_transactions(type);

ALTER TABLE public.debt_records
  ADD COLUMN IF NOT EXISTS keterangan TEXT,
  ADD COLUMN IF NOT EXISTS periode TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

UPDATE public.debt_records
SET periode = COALESCE(periode, to_char(created_at, 'IYYY-IW'), to_char(CURRENT_DATE, 'IYYY-IW')),
    idempotency_key = COALESCE(idempotency_key, 'legacy-debt-' || id::TEXT),
    keterangan = COALESCE(keterangan, 'Tunggakan iuran mingguan')
WHERE periode IS NULL OR idempotency_key IS NULL OR keterangan IS NULL;

ALTER TABLE public.debt_records
  ALTER COLUMN periode SET NOT NULL,
  ALTER COLUMN idempotency_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_debt_records_idempotency_key
  ON public.debt_records(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_debt_student_status ON public.debt_records(student_id, status);

ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS action TEXT,
  ADD COLUMN IF NOT EXISTS table_name TEXT,
  ADD COLUMN IF NOT EXISTS old_values JSONB,
  ADD COLUMN IF NOT EXISTS new_values JSONB,
  ADD COLUMN IF NOT EXISTS aksi TEXT,
  ADD COLUMN IF NOT EXISTS tabel TEXT,
  ADD COLUMN IF NOT EXISTS data_lama JSONB,
  ADD COLUMN IF NOT EXISTS data_baru JSONB;

-- The deployed database still has audit triggers from the legacy schema. Keep
-- the zero-silent-edit rule, but make those triggers write the canonical audit
-- columns used by the cash RPCs.
CREATE OR REPLACE FUNCTION public.log_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id UUID;
  reason TEXT;
  is_system_operation BOOLEAN := COALESCE(NULLIF(current_setting('app.system_operation', TRUE), '') = 'true', FALSE);
BEGIN
  BEGIN
    actor_id := NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID;
    reason := NULLIF(current_setting('app.change_reason', TRUE), '');
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Aksi Ditolak: app.current_user_id dan app.change_reason wajib diset di level session.';
  END;
  IF reason IS NULL OR (actor_id IS NULL AND NOT is_system_operation) THEN
    RAISE EXCEPTION 'Aksi Ditolak: Prinsip Zero Silent Edits dilanggar (ID/Alasan kosong).';
  END IF;

  INSERT INTO activity_logs (
    user_id, action, table_name, record_id, old_values, new_values,
    aksi, tabel, data_lama, data_baru, change_reason
  ) VALUES (
    actor_id, TG_OP, TG_TABLE_NAME, COALESCE(NEW.id, OLD.id),
    to_jsonb(OLD), to_jsonb(NEW),
    TG_OP, TG_TABLE_NAME, to_jsonb(OLD), to_jsonb(NEW), reason
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_cash_transaction_final()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance NUMERIC;
BEGIN
  IF NEW.type = 'pengeluaran'::transaction_type THEN
    IF NEW.keterangan IS NULL OR TRIM(NEW.keterangan) = '' THEN
      RAISE EXCEPTION 'Untuk pengeluaran, rincian untuk beli apa wajib diisi pada kolom keterangan.';
    END IF;

    SELECT COALESCE(SUM(
      CASE
        WHEN COALESCE(is_billing, FALSE) THEN 0
        WHEN type = 'pengeluaran'::transaction_type THEN -nominal
        ELSE nominal
      END
    ), 0)
    INTO current_balance
    FROM cash_transactions;

    IF current_balance < NEW.nominal THEN
      RAISE EXCEPTION 'Aksi Ditolak: Saldo kas tidak mencukupi untuk pengeluaran sebesar %', NEW.nominal;
    END IF;
  END IF;
  NEW.tipe := CASE WHEN NEW.type = 'pengeluaran'::transaction_type THEN 'keluar' ELSE 'masuk' END;
  NEW.jumlah := NEW.nominal;
  NEW.tanggal := COALESCE(NEW.tanggal, CURRENT_DATE);
  RETURN NEW;
END;
$$;

ALTER TABLE public.cash_disputes
  ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS alasan_sanggahan TEXT,
  ADD COLUMN IF NOT EXISTS reason TEXT;

UPDATE public.cash_disputes
SET reason = COALESCE(reason, alasan_sanggahan, 'Sanggahan transaksi kas')
WHERE reason IS NULL;

ALTER TABLE public.cash_disputes
  ALTER COLUMN reason SET NOT NULL;

UPDATE public.cash_disputes dispute
SET student_id = transaction_row.student_id
FROM public.cash_transactions transaction_row
WHERE dispute.transaction_id = transaction_row.id
  AND dispute.student_id IS NULL;

DO $$ BEGIN
  ALTER TABLE public.cash_disputes
    ADD CONSTRAINT cash_disputes_transaction_id_fkey
    FOREIGN KEY (transaction_id) REFERENCES cash_transactions(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

UPDATE public.activity_logs
SET action = COALESCE(action, aksi),
    table_name = COALESCE(table_name, tabel),
    old_values = COALESCE(old_values, data_lama),
    new_values = COALESCE(new_values, data_baru)
WHERE action IS NULL OR table_name IS NULL OR old_values IS NULL OR new_values IS NULL;

ALTER TABLE public.activity_logs
  ALTER COLUMN aksi DROP NOT NULL,
  ALTER COLUMN tabel DROP NOT NULL,
  ALTER COLUMN record_id DROP NOT NULL,
  ALTER COLUMN action SET NOT NULL,
  ALTER COLUMN table_name SET NOT NULL;

NOTIFY pgrst, 'reload schema';
