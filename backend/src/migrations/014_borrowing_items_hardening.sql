-- 014_borrowing_items_hardening.sql
-- Relasi transaksi peminjaman per alat, anti double-booking, dan operasi atomik.

ALTER TABLE public.borrowings
  ADD COLUMN IF NOT EXISTS tanggal_pinjam DATE,
  ADD COLUMN IF NOT EXISTS rencana_kembali DATE,
  ADD COLUMN IF NOT EXISTS keperluan TEXT,
  ADD COLUMN IF NOT EXISTS catatan_persetujuan TEXT,
  ADD COLUMN IF NOT EXISTS catatan_pengembalian TEXT,
  ADD COLUMN IF NOT EXISTS total_denda NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processed_return_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.borrowings
SET
  tanggal_pinjam = COALESCE(tanggal_pinjam, borrowed_at::DATE, created_at::DATE),
  rencana_kembali = COALESCE(rencana_kembali, due_at::DATE)
WHERE tanggal_pinjam IS NULL OR rencana_kembali IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_borrowings_idempotency_key
  ON public.borrowings (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.borrowing_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrowing_id UUID NOT NULL REFERENCES public.borrowings(id) ON DELETE CASCADE,
  equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'borrowed', 'returned', 'rejected')),
  kondisi_awal TEXT,
  kondisi_kembali TEXT,
  denda NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (denda >= 0),
  tanggal_diserahkan TIMESTAMPTZ,
  tanggal_dikembalikan TIMESTAMPTZ,
  catatan TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_borrowing_item UNIQUE (borrowing_id, equipment_id),
  CONSTRAINT borrowing_item_return_condition_check CHECK (
    kondisi_kembali IS NULL OR kondisi_kembali IN (
      'bagus', 'sedikit_kerusakan', 'rusak', 'rusak_besar', 'sedang_diperbaiki', 'hilang'
    )
  )
);

-- Upgrade tabel parsial yang mungkin sudah dibuat pada percobaan migration sebelumnya.
-- CREATE TABLE IF NOT EXISTS tidak menambahkan kolom ke tabel yang sudah ada.
ALTER TABLE public.borrowing_items
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS borrowing_id UUID,
  ADD COLUMN IF NOT EXISTS equipment_id UUID,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS kondisi_awal TEXT,
  ADD COLUMN IF NOT EXISTS kondisi_kembali TEXT,
  ADD COLUMN IF NOT EXISTS denda NUMERIC(14, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tanggal_diserahkan TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tanggal_dikembalikan TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS catatan TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.borrowing_items
SET
  id = COALESCE(id, gen_random_uuid()),
  status = COALESCE(status, 'pending'),
  denda = COALESCE(denda, 0),
  created_at = COALESCE(created_at, NOW()),
  updated_at = COALESCE(updated_at, NOW())
WHERE id IS NULL
   OR status IS NULL
   OR denda IS NULL
   OR created_at IS NULL
   OR updated_at IS NULL;

ALTER TABLE public.borrowing_items
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'pending',
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN denda SET DEFAULT 0,
  ALTER COLUMN denda SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET NOT NULL;

DO $$
BEGIN
  -- Constraint lama bisa memiliki nama sama tetapi daftar status berbeda.
  -- Drop/recreate memastikan definisi database mengikuti kontrak backend.
  ALTER TABLE public.borrowing_items
    DROP CONSTRAINT IF EXISTS borrowing_item_return_condition_check,
    DROP CONSTRAINT IF EXISTS borrowing_items_status_check,
    DROP CONSTRAINT IF EXISTS borrowing_items_denda_check;

  ALTER TABLE public.borrowing_items
    ADD CONSTRAINT borrowing_item_return_condition_check CHECK (
      kondisi_kembali IS NULL OR kondisi_kembali IN (
        'bagus', 'sedikit_kerusakan', 'rusak', 'rusak_besar', 'sedang_diperbaiki', 'hilang'
      )
    ) NOT VALID,
    ADD CONSTRAINT borrowing_items_status_check CHECK (
      status IN ('pending', 'approved', 'borrowed', 'returned', 'rejected')
    ) NOT VALID,
    ADD CONSTRAINT borrowing_items_denda_check CHECK (denda >= 0) NOT VALID;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.borrowing_items'::regclass
      AND contype = 'f'
      AND confrelid = 'public.borrowings'::regclass
  ) THEN
    ALTER TABLE public.borrowing_items
      ADD CONSTRAINT borrowing_items_borrowing_id_fkey
      FOREIGN KEY (borrowing_id) REFERENCES public.borrowings(id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.borrowing_items'::regclass
      AND contype = 'f'
      AND confrelid = 'public.equipment'::regclass
  ) THEN
    ALTER TABLE public.borrowing_items
      ADD CONSTRAINT borrowing_items_equipment_id_fkey
      FOREIGN KEY (equipment_id) REFERENCES public.equipment(id)
      ON DELETE RESTRICT NOT VALID;
  END IF;
END;
$$;

-- Detail peminjaman hanya boleh diakses melalui backend/service_role.
-- Tanpa policy, RLS otomatis menolak akses langsung anon/authenticated.
ALTER TABLE public.borrowing_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_borrowing_items_borrowing_id
  ON public.borrowing_items (borrowing_id);

CREATE INDEX IF NOT EXISTS idx_borrowing_items_equipment_id
  ON public.borrowing_items (equipment_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_borrowing_item
  ON public.borrowing_items (borrowing_id, equipment_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_borrowing_item_equipment
  ON public.borrowing_items (equipment_id)
  WHERE status IN ('pending', 'approved', 'borrowed');

CREATE OR REPLACE FUNCTION public.create_borrowing_atomic(
  p_student_id UUID,
  p_equipment_ids UUID[],
  p_tanggal_pinjam DATE,
  p_rencana_kembali DATE,
  p_keperluan TEXT,
  p_created_by UUID,
  p_idempotency_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_borrowing_id UUID;
  v_equipment_count INTEGER;
  v_distinct_equipment_count INTEGER;
BEGIN
  -- Legacy audit trigger membutuhkan konteks actor dan alasan di session.
  PERFORM set_config('app.current_user_id', COALESCE(p_created_by::TEXT, ''), TRUE);
  PERFORM set_config('app.change_reason', 'Pengajuan peminjaman alat dibuat.', TRUE);

  IF p_student_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.students WHERE id = p_student_id AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Siswa aktif tidak ditemukan.';
  END IF;

  IF p_equipment_ids IS NULL OR COALESCE(array_length(p_equipment_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Minimal satu alat harus dipilih.';
  END IF;

  SELECT COUNT(*), COUNT(DISTINCT equipment_id)
  INTO v_equipment_count, v_distinct_equipment_count
  FROM unnest(p_equipment_ids) AS requested(equipment_id);

  IF v_equipment_count <> v_distinct_equipment_count THEN
    RAISE EXCEPTION 'Daftar alat tidak boleh berisi duplikasi.';
  END IF;

  IF p_tanggal_pinjam IS NULL OR p_rencana_kembali IS NULL OR p_rencana_kembali < p_tanggal_pinjam THEN
    RAISE EXCEPTION 'Tanggal pengembalian harus sama atau setelah tanggal peminjaman.';
  END IF;

  IF p_keperluan IS NULL OR length(trim(p_keperluan)) < 5 THEN
    RAISE EXCEPTION 'Keperluan peminjaman minimal 5 karakter.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    -- Serialisasi request retry dengan key yang sama sebelum pengecekan unique key.
    PERFORM pg_advisory_xact_lock(hashtext(p_idempotency_key));
    SELECT id INTO v_borrowing_id
    FROM public.borrowings
    WHERE idempotency_key = p_idempotency_key;
    IF v_borrowing_id IS NOT NULL THEN
      RETURN v_borrowing_id;
    END IF;
  END IF;

  -- Lock semua alat lebih dulu agar dua request bersamaan tidak bisa sama-sama lolos.
  PERFORM 1
  FROM public.equipment
  WHERE id = ANY(p_equipment_ids)
  ORDER BY id
  FOR UPDATE;

  SELECT COUNT(*) INTO v_equipment_count
  FROM public.equipment
  WHERE id = ANY(p_equipment_ids);
  IF v_equipment_count <> v_distinct_equipment_count THEN
    RAISE EXCEPTION 'Salah satu alat tidak ditemukan.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.equipment
    WHERE id = ANY(p_equipment_ids)
      AND COALESCE(status, availability_status::TEXT) <> 'tersedia'
  ) THEN
    RAISE EXCEPTION 'Salah satu alat tidak sedang tersedia.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.borrowing_items
    WHERE equipment_id = ANY(p_equipment_ids)
      AND status IN ('pending', 'approved', 'borrowed')
  ) THEN
    RAISE EXCEPTION 'Salah satu alat sedang dipesan atau dipinjam pengguna lain.';
  END IF;

  INSERT INTO public.borrowings (
    student_id, status, tanggal_pinjam, rencana_kembali, due_at,
    keperluan, idempotency_key, created_by, created_at
  ) VALUES (
    p_student_id, 'pending', p_tanggal_pinjam, p_rencana_kembali,
    p_rencana_kembali::TIMESTAMPTZ, trim(p_keperluan), p_idempotency_key, p_created_by, NOW()
  )
  RETURNING id INTO v_borrowing_id;

  INSERT INTO public.borrowing_items (borrowing_id, equipment_id, status, kondisi_awal, created_by)
  SELECT v_borrowing_id, e.id, 'pending', e.kondisi, p_created_by
  FROM public.equipment e
  WHERE e.id = ANY(p_equipment_ids);

  INSERT INTO public.activity_logs (
    user_id, action, table_name, record_id, new_values, change_reason
  ) VALUES (
    p_created_by, 'INSERT', 'borrowings', v_borrowing_id,
    jsonb_build_object('student_id', p_student_id, 'equipment_ids', to_jsonb(p_equipment_ids), 'status', 'pending'),
    'Pengajuan peminjaman alat dibuat.'
  );

  RETURN v_borrowing_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_borrowing_atomic(
  p_borrowing_id UUID,
  p_action TEXT,
  p_catatan TEXT,
  p_approved_by UUID,
  p_change_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status TEXT;
  v_next_status TEXT;
BEGIN
  -- Sinkronkan konteks dengan trigger Zero Silent Edits pada database lama.
  PERFORM set_config('app.current_user_id', COALESCE(p_approved_by::TEXT, ''), TRUE);
  PERFORM set_config('app.change_reason', COALESCE(LEFT(TRIM(p_change_reason), 500), ''), TRUE);

  IF p_change_reason IS NULL OR length(trim(p_change_reason)) < 5 THEN
    RAISE EXCEPTION 'Alasan keputusan minimal 5 karakter.';
  END IF;

  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Aksi persetujuan tidak valid.';
  END IF;

  SELECT status INTO v_current_status
  FROM public.borrowings
  WHERE id = p_borrowing_id
  FOR UPDATE;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Pengajuan peminjaman tidak ditemukan.';
  END IF;
  IF v_current_status <> 'pending' THEN
    RAISE EXCEPTION 'Pengajuan ini sudah diproses sebelumnya.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.borrowing_items WHERE borrowing_id = p_borrowing_id) THEN
    RAISE EXCEPTION 'Detail alat belum tersedia pada pengajuan ini. Rekonsiliasi data lama terlebih dahulu.';
  END IF;

  v_next_status := CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'rejected' END;

  IF p_action = 'approve' AND EXISTS (
    SELECT 1
    FROM public.borrowing_items bi
    JOIN public.equipment e ON e.id = bi.equipment_id
    WHERE bi.borrowing_id = p_borrowing_id
      AND (bi.status <> 'pending' OR COALESCE(e.status, e.availability_status::TEXT) <> 'tersedia')
  ) THEN
    RAISE EXCEPTION 'Salah satu alat sudah tidak tersedia. Pengajuan tidak dapat disetujui.';
  END IF;

  UPDATE public.borrowings
  SET status = v_next_status,
      approved_by = p_approved_by,
      catatan_persetujuan = NULLIF(trim(p_catatan), ''),
      updated_by = p_approved_by,
      updated_at = NOW()
  WHERE id = p_borrowing_id;

  UPDATE public.borrowing_items
  SET status = v_next_status,
      updated_by = p_approved_by,
      updated_at = NOW()
  WHERE borrowing_id = p_borrowing_id;

  INSERT INTO public.activity_logs (
    user_id, action, table_name, record_id, old_values, new_values, change_reason
  ) VALUES (
    p_approved_by, 'UPDATE', 'borrowings', p_borrowing_id,
    jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', v_next_status, 'catatan', p_catatan),
    trim(p_change_reason)
  );

  RETURN p_borrowing_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.handover_borrowing_atomic(
  p_borrowing_id UUID,
  p_handover_by UUID,
  p_change_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status TEXT;
BEGIN
  -- Sinkronkan konteks dengan trigger Zero Silent Edits pada database lama.
  PERFORM set_config('app.current_user_id', COALESCE(p_handover_by::TEXT, ''), TRUE);
  PERFORM set_config('app.change_reason', COALESCE(LEFT(TRIM(p_change_reason), 500), ''), TRUE);

  IF p_change_reason IS NULL OR length(trim(p_change_reason)) < 5 THEN
    RAISE EXCEPTION 'Alasan serah-terima minimal 5 karakter.';
  END IF;

  SELECT status INTO v_current_status
  FROM public.borrowings
  WHERE id = p_borrowing_id
  FOR UPDATE;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Peminjaman tidak ditemukan.';
  END IF;
  IF v_current_status <> 'approved' THEN
    RAISE EXCEPTION 'Peminjaman belum disetujui atau sudah diserahkan.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.borrowing_items WHERE borrowing_id = p_borrowing_id) THEN
    RAISE EXCEPTION 'Detail alat belum tersedia pada peminjaman ini. Rekonsiliasi data lama terlebih dahulu.';
  END IF;

  PERFORM 1
  FROM public.equipment e
  JOIN public.borrowing_items bi ON bi.equipment_id = e.id
  WHERE bi.borrowing_id = p_borrowing_id
  ORDER BY e.id
  FOR UPDATE;

  IF EXISTS (
    SELECT 1
    FROM public.borrowing_items bi
    JOIN public.equipment e ON e.id = bi.equipment_id
    WHERE bi.borrowing_id = p_borrowing_id
      AND (bi.status <> 'approved' OR COALESCE(e.status, e.availability_status::TEXT) <> 'tersedia')
  ) THEN
    RAISE EXCEPTION 'Kondisi alat berubah. Periksa kembali ketersediaan sebelum serah-terima.';
  END IF;

  UPDATE public.borrowing_items
  SET status = 'borrowed', tanggal_diserahkan = NOW(), updated_by = p_handover_by, updated_at = NOW()
  WHERE borrowing_id = p_borrowing_id;

  UPDATE public.equipment e
  SET status = 'dipinjam',
      availability_status = 'dipinjam',
      updated_at = NOW()
  WHERE e.id IN (
    SELECT equipment_id FROM public.borrowing_items WHERE borrowing_id = p_borrowing_id
  );

  UPDATE public.borrowings
  SET status = 'borrowed', borrowed_at = NOW(), updated_by = p_handover_by, updated_at = NOW()
  WHERE id = p_borrowing_id;

  INSERT INTO public.activity_logs (
    user_id, action, table_name, record_id, new_values, change_reason
  ) VALUES (
    p_handover_by, 'UPDATE', 'borrowings', p_borrowing_id,
    jsonb_build_object('status', 'borrowed'), trim(p_change_reason)
  );

  RETURN p_borrowing_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.return_borrowing_atomic(
  p_borrowing_id UUID,
  p_returned_at DATE,
  p_item_conditions JSONB,
  p_catatan TEXT,
  p_returned_by UUID,
  p_change_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status TEXT;
  v_item JSONB;
  v_equipment_id UUID;
  v_condition TEXT;
  v_fine NUMERIC(14, 2);
  v_total_fine NUMERIC(14, 2) := 0;
BEGIN
  -- Sinkronkan konteks dengan trigger Zero Silent Edits pada database lama.
  PERFORM set_config('app.current_user_id', COALESCE(p_returned_by::TEXT, ''), TRUE);
  PERFORM set_config('app.change_reason', COALESCE(LEFT(TRIM(p_change_reason), 500), ''), TRUE);

  IF p_change_reason IS NULL OR length(trim(p_change_reason)) < 5 THEN
    RAISE EXCEPTION 'Alasan pengembalian minimal 5 karakter.';
  END IF;
  IF p_item_conditions IS NULL OR jsonb_typeof(p_item_conditions) <> 'array' OR jsonb_array_length(p_item_conditions) = 0 THEN
    RAISE EXCEPTION 'Kondisi setiap alat yang dikembalikan wajib diisi.';
  END IF;

  SELECT status INTO v_current_status
  FROM public.borrowings
  WHERE id = p_borrowing_id
  FOR UPDATE;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Peminjaman tidak ditemukan.';
  END IF;
  IF v_current_status NOT IN ('borrowed', 'partial') THEN
    RAISE EXCEPTION 'Peminjaman belum berada pada status dapat dikembalikan.';
  END IF;

  IF (
    SELECT COUNT(*) FROM public.borrowing_items
    WHERE borrowing_id = p_borrowing_id AND status = 'borrowed'
  ) <> jsonb_array_length(p_item_conditions) THEN
    RAISE EXCEPTION 'Kondisi pengembalian harus diisi untuk setiap alat yang masih dipinjam.';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_item_conditions)
  LOOP
    BEGIN
      v_equipment_id := (v_item->>'equipment_id')::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'ID alat pada pengembalian tidak valid.';
    END;

    v_condition := v_item->>'kondisi_kembali';
    IF v_condition NOT IN ('bagus', 'sedikit_kerusakan', 'rusak', 'rusak_besar', 'sedang_diperbaiki', 'hilang') THEN
      RAISE EXCEPTION 'Kondisi pengembalian alat tidak valid.';
    END IF;

    SELECT CASE v_condition
      WHEN 'bagus' THEN 0
      WHEN 'sedikit_kerusakan' THEN 50000
      WHEN 'rusak' THEN 200000
      WHEN 'rusak_besar' THEN 300000
      WHEN 'sedang_diperbaiki' THEN 200000
      WHEN 'hilang' THEN 500000
    END INTO v_fine;
    v_total_fine := v_total_fine + v_fine;

    IF NOT EXISTS (
      SELECT 1 FROM public.borrowing_items
      WHERE borrowing_id = p_borrowing_id AND equipment_id = v_equipment_id AND status = 'borrowed'
    ) THEN
      RAISE EXCEPTION 'Alat tidak termasuk dalam peminjaman aktif ini.';
    END IF;

    UPDATE public.borrowing_items
    SET status = 'returned',
        kondisi_kembali = v_condition,
        denda = v_fine,
        tanggal_dikembalikan = COALESCE(p_returned_at::TIMESTAMPTZ, NOW()),
        catatan = NULLIF(trim(v_item->>'catatan'), ''),
        updated_by = p_returned_by,
        updated_at = NOW()
    WHERE borrowing_id = p_borrowing_id AND equipment_id = v_equipment_id;

    UPDATE public.equipment
    SET kondisi = v_condition,
        physical_condition = v_condition::physical_condition,
        status = CASE WHEN v_condition = 'bagus' THEN 'tersedia' ELSE 'maintenance' END,
        availability_status = (CASE WHEN v_condition = 'bagus' THEN 'tersedia' ELSE 'maintenance' END)::availability_status,
        updated_at = NOW()
    WHERE id = v_equipment_id;
  END LOOP;

  UPDATE public.borrowings
  SET status = 'returned',
      returned_at = COALESCE(p_returned_at::TIMESTAMPTZ, NOW()),
      catatan_pengembalian = NULLIF(trim(p_catatan), ''),
      total_denda = v_total_fine,
      processed_return_by = p_returned_by,
      updated_by = p_returned_by,
      updated_at = NOW()
  WHERE id = p_borrowing_id;

  INSERT INTO public.activity_logs (
    user_id, action, table_name, record_id, new_values, change_reason
  ) VALUES (
    p_returned_by, 'UPDATE', 'borrowings', p_borrowing_id,
    jsonb_build_object('status', 'returned', 'total_denda', v_total_fine),
    trim(p_change_reason)
  );

  RETURN p_borrowing_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_borrowing_atomic(UUID, UUID[], DATE, DATE, TEXT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.approve_borrowing_atomic(UUID, TEXT, TEXT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.handover_borrowing_atomic(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.return_borrowing_atomic(UUID, DATE, JSONB, TEXT, UUID, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
