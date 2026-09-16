BEGIN;

CREATE TABLE IF NOT EXISTS public.equipment_recovery_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE RESTRICT,
  assessment_item_id UUID REFERENCES public.borrowing_return_assessment_items(id) ON DELETE SET NULL,
  recovery_type TEXT NOT NULL CHECK (recovery_type IN ('repair', 'replacement')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'awaiting_verification', 'completed', 'unrepairable', 'cancelled')),
  reported_condition TEXT NOT NULL CHECK (reported_condition IN ('sedikit_kerusakan', 'rusak', 'rusak_besar', 'sedang_diperbaiki', 'hilang')),
  notes TEXT,
  inspection_photos JSONB NOT NULL DEFAULT '[]'::JSONB,
  estimated_cost NUMERIC(14, 2) CHECK (estimated_cost IS NULL OR estimated_cost > 0),
  actual_cost NUMERIC(14, 2) CHECK (actual_cost IS NULL OR actual_cost >= 0),
  inspection_passed BOOLEAN NOT NULL DEFAULT FALSE,
  replacement_equipment_id UUID REFERENCES public.equipment(id) ON DELETE RESTRICT,
  opened_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT equipment_recovery_photos_array CHECK (jsonb_typeof(inspection_photos) = 'array'),
  CONSTRAINT equipment_recovery_completion_check CHECK (
    (status = 'completed' AND completed_at IS NOT NULL AND (recovery_type <> 'repair' OR inspection_passed = TRUE))
    OR status <> 'completed'
  ),
  CONSTRAINT equipment_recovery_replacement_link_check CHECK (
    recovery_type <> 'replacement' OR status <> 'completed' OR replacement_equipment_id IS NOT NULL
  )
);

ALTER TABLE public.equipment_recovery_cases
  ADD COLUMN IF NOT EXISTS inspection_passed BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_equipment_recovery_equipment_status
  ON public.equipment_recovery_cases (equipment_id, status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_equipment_recovery_open_case
  ON public.equipment_recovery_cases (equipment_id)
  WHERE status IN ('open', 'in_progress', 'awaiting_verification');

ALTER TABLE public.equipment_recovery_cases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.equipment_recovery_cases FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.equipment_recovery_cases TO service_role;

CREATE TABLE IF NOT EXISTS public.equipment_charge_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_item_id UUID NOT NULL UNIQUE REFERENCES public.borrowing_return_assessment_items(id) ON DELETE CASCADE,
  borrowing_id UUID NOT NULL REFERENCES public.borrowings(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  paid_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid', 'waived')),
  notes TEXT,
  recorded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT equipment_charge_amount_check CHECK (paid_amount <= amount OR status = 'waived'),
  CONSTRAINT equipment_charge_status_check CHECK (
    (status = 'unpaid' AND paid_amount = 0)
    OR (status = 'partial' AND paid_amount > 0 AND paid_amount < amount)
    OR (status = 'paid' AND paid_amount >= amount)
    OR status = 'waived'
  )
);

CREATE INDEX IF NOT EXISTS idx_equipment_charge_student_status
  ON public.equipment_charge_settlements (student_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_equipment_charge_borrowing
  ON public.equipment_charge_settlements (borrowing_id, created_at DESC);

INSERT INTO public.equipment_charge_settlements (assessment_item_id, borrowing_id, student_id, amount)
SELECT item.id, assessment.borrowing_id, borrowing.student_id, item.charged_amount
FROM public.borrowing_return_assessment_items item
JOIN public.borrowing_return_assessments assessment ON assessment.id = item.assessment_id
JOIN public.borrowings borrowing ON borrowing.id = assessment.borrowing_id
WHERE item.charged_amount > 0
ON CONFLICT (assessment_item_id) DO NOTHING;

ALTER TABLE public.equipment_charge_settlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.equipment_charge_settlements FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.equipment_charge_settlements TO service_role;

CREATE OR REPLACE FUNCTION public.create_equipment_recovery_case_atomic(
  p_equipment_id UUID,
  p_recovery_type TEXT,
  p_assessment_item_id UUID,
  p_reported_condition TEXT,
  p_notes TEXT,
  p_opened_by UUID,
  p_change_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case_id UUID;
  v_condition TEXT;
  v_status TEXT;
BEGIN
  IF p_equipment_id IS NULL OR p_opened_by IS NULL THEN RAISE EXCEPTION 'RECOVERY_IDENTITY_INVALID'; END IF;
  IF p_recovery_type NOT IN ('repair', 'replacement') THEN RAISE EXCEPTION 'RECOVERY_TYPE_INVALID'; END IF;
  IF p_reported_condition NOT IN ('sedikit_kerusakan', 'rusak', 'rusak_besar', 'sedang_diperbaiki', 'hilang') THEN
    RAISE EXCEPTION 'RECOVERY_CONDITION_INVALID';
  END IF;
  IF p_reported_condition = 'hilang' AND p_recovery_type <> 'replacement' THEN RAISE EXCEPTION 'RECOVERY_TYPE_INVALID'; END IF;
  IF p_change_reason IS NULL OR length(trim(p_change_reason)) < 5 THEN RAISE EXCEPTION 'RECOVERY_CHANGE_REASON_REQUIRED'; END IF;

  SELECT kondisi, status INTO v_condition, v_status
  FROM public.equipment WHERE id = p_equipment_id FOR UPDATE;
  IF v_condition IS NULL THEN RAISE EXCEPTION 'EQUIPMENT_NOT_FOUND'; END IF;
  IF v_status = 'dipinjam' THEN RAISE EXCEPTION 'EQUIPMENT_STILL_BORROWED'; END IF;
  IF p_assessment_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.borrowing_return_assessment_items
    WHERE id = p_assessment_item_id AND equipment_id = p_equipment_id
  ) THEN RAISE EXCEPTION 'RECOVERY_ASSESSMENT_LINK_INVALID'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.equipment_recovery_cases
    WHERE equipment_id = p_equipment_id AND status IN ('open', 'in_progress', 'awaiting_verification')
  ) THEN RAISE EXCEPTION 'RECOVERY_CASE_ALREADY_OPEN'; END IF;

  INSERT INTO public.equipment_recovery_cases (
    equipment_id, assessment_item_id, recovery_type, reported_condition, notes, opened_by
  ) VALUES (
    p_equipment_id, p_assessment_item_id, p_recovery_type, p_reported_condition, NULLIF(trim(p_notes), ''), p_opened_by
  ) RETURNING id INTO v_case_id;

  UPDATE public.equipment
  SET status = 'maintenance', availability_status = 'maintenance'::availability_status,
      kondisi = CASE WHEN p_reported_condition = 'hilang' THEN 'hilang' ELSE p_reported_condition END,
      physical_condition = CASE WHEN p_reported_condition = 'hilang' THEN 'hilang' ELSE p_reported_condition END::physical_condition,
      asset_state = CASE WHEN p_reported_condition = 'hilang' THEN 'lost' ELSE 'active' END,
      updated_at = NOW()
  WHERE id = p_equipment_id;

  INSERT INTO public.activity_logs (user_id, action, table_name, record_id, new_values, change_reason)
  VALUES (p_opened_by, 'INSERT', 'equipment_recovery_cases', v_case_id,
    jsonb_build_object('equipment_id', p_equipment_id, 'recovery_type', p_recovery_type, 'status', 'open'), trim(p_change_reason));
  RETURN v_case_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_equipment_repair_atomic(
  p_case_id UUID,
  p_inspection_photos JSONB,
  p_actual_cost NUMERIC,
  p_notes TEXT,
  p_inspection_passed BOOLEAN,
  p_verified_by UUID,
  p_change_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_equipment_id UUID;
  v_type TEXT;
  v_status TEXT;
  v_photo_count INTEGER;
BEGIN
  IF p_case_id IS NULL OR p_verified_by IS NULL THEN RAISE EXCEPTION 'RECOVERY_IDENTITY_INVALID'; END IF;
  IF p_change_reason IS NULL OR length(trim(p_change_reason)) < 5 THEN RAISE EXCEPTION 'RECOVERY_CHANGE_REASON_REQUIRED'; END IF;
  IF p_inspection_passed IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'RECOVERY_INSPECTION_REQUIRED'; END IF;
  IF p_inspection_photos IS NULL OR jsonb_typeof(p_inspection_photos) <> 'array' THEN RAISE EXCEPTION 'RECOVERY_EVIDENCE_REQUIRED'; END IF;
  SELECT jsonb_array_length(p_inspection_photos) INTO v_photo_count;
  IF v_photo_count < 2 OR v_photo_count > 12 THEN RAISE EXCEPTION 'RECOVERY_EVIDENCE_REQUIRED'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_inspection_photos) AS photo(value) WHERE value !~* '^(https?://[^[:space:]]+|data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2})$') THEN RAISE EXCEPTION 'RECOVERY_EVIDENCE_INVALID'; END IF;

  SELECT equipment_id, recovery_type, status INTO v_equipment_id, v_type, v_status
  FROM public.equipment_recovery_cases WHERE id = p_case_id FOR UPDATE;
  IF v_equipment_id IS NULL THEN RAISE EXCEPTION 'RECOVERY_CASE_NOT_FOUND'; END IF;
  IF v_type <> 'repair' THEN RAISE EXCEPTION 'RECOVERY_CASE_TYPE_INVALID'; END IF;
  IF v_status NOT IN ('open', 'in_progress', 'awaiting_verification') THEN RAISE EXCEPTION 'RECOVERY_CASE_NOT_OPEN'; END IF;

  UPDATE public.equipment_recovery_cases
  SET status = 'completed', inspection_photos = p_inspection_photos,
      actual_cost = NULLIF(p_actual_cost, 0), notes = COALESCE(NULLIF(trim(p_notes), ''), notes),
      inspection_passed = TRUE,
      verified_by = p_verified_by, completed_at = NOW(), updated_at = NOW()
  WHERE id = p_case_id;

  UPDATE public.equipment
  SET kondisi = 'bagus', physical_condition = 'bagus'::physical_condition,
      status = 'tersedia', availability_status = 'tersedia'::availability_status,
      asset_state = 'active', catatan_kerusakan = NULL, updated_at = NOW()
  WHERE id = v_equipment_id;

  INSERT INTO public.activity_logs (user_id, action, table_name, record_id, new_values, change_reason)
  VALUES (p_verified_by, 'UPDATE', 'equipment_recovery_cases', p_case_id,
    jsonb_build_object('status', 'completed', 'equipment_id', v_equipment_id), trim(p_change_reason));
  RETURN v_equipment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_equipment_replacement_atomic(
  p_case_id UUID,
  p_equipment_code TEXT,
  p_name TEXT,
  p_category TEXT,
  p_storage_location TEXT,
  p_serial_number TEXT,
  p_photo_urls JSONB,
  p_description TEXT,
  p_replacement_value NUMERIC,
  p_created_by UUID,
  p_change_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_equipment_id UUID;
  v_case_type TEXT;
  v_case_status TEXT;
  v_old_condition TEXT;
  v_new_equipment_id UUID;
  v_photos TEXT[];
BEGIN
  IF p_case_id IS NULL OR p_created_by IS NULL THEN RAISE EXCEPTION 'RECOVERY_IDENTITY_INVALID'; END IF;
  IF p_change_reason IS NULL OR length(trim(p_change_reason)) < 5 THEN RAISE EXCEPTION 'RECOVERY_CHANGE_REASON_REQUIRED'; END IF;
  IF NULLIF(trim(p_equipment_code), '') IS NULL OR NULLIF(trim(p_name), '') IS NULL OR NULLIF(trim(p_category), '') IS NULL THEN RAISE EXCEPTION 'REPLACEMENT_EQUIPMENT_REQUIRED'; END IF;
  IF p_photo_urls IS NULL OR jsonb_typeof(p_photo_urls) <> 'array' OR jsonb_array_length(p_photo_urls) < 3 OR jsonb_array_length(p_photo_urls) > 12 THEN RAISE EXCEPTION 'REPLACEMENT_PHOTOS_REQUIRED'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_photo_urls) AS photo(value) WHERE value !~* '^(https?://[^[:space:]]+|data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2})$') THEN RAISE EXCEPTION 'REPLACEMENT_PHOTOS_INVALID'; END IF;
  IF p_replacement_value IS NOT NULL AND p_replacement_value <= 0 THEN RAISE EXCEPTION 'INVALID_REPLACEMENT_VALUE'; END IF;
  IF EXISTS (SELECT 1 FROM public.equipment WHERE kode_alat = trim(p_equipment_code)) THEN RAISE EXCEPTION 'EQUIPMENT_CODE_ALREADY_EXISTS'; END IF;

  SELECT equipment_id, recovery_type, status INTO v_old_equipment_id, v_case_type, v_case_status
  FROM public.equipment_recovery_cases WHERE id = p_case_id FOR UPDATE;
  IF v_old_equipment_id IS NULL THEN RAISE EXCEPTION 'RECOVERY_CASE_NOT_FOUND'; END IF;
  IF v_case_type <> 'replacement' THEN RAISE EXCEPTION 'RECOVERY_CASE_TYPE_INVALID'; END IF;
  IF v_case_status NOT IN ('open', 'in_progress', 'awaiting_verification') THEN RAISE EXCEPTION 'RECOVERY_CASE_NOT_OPEN'; END IF;
  SELECT kondisi INTO v_old_condition FROM public.equipment WHERE id = v_old_equipment_id FOR UPDATE;

  SELECT COALESCE(array_agg(value), ARRAY[]::TEXT[]) INTO v_photos
  FROM jsonb_array_elements_text(p_photo_urls) AS photo(value);
  INSERT INTO public.equipment (
    kode_alat, kode_qr, nama_alat, kategori, kondisi, physical_condition, status,
    availability_status, fotos, foto_url, lokasi_penyimpanan, serial_number, deskripsi, asset_state, created_by
  ) VALUES (
    trim(p_equipment_code), trim(p_equipment_code), trim(p_name), trim(p_category), 'bagus', 'bagus'::physical_condition,
    'tersedia', 'tersedia'::availability_status, v_photos, v_photos[1], NULLIF(trim(p_storage_location), ''),
    NULLIF(trim(p_serial_number), ''), NULLIF(trim(p_description), ''), 'active', p_created_by
  ) RETURNING id INTO v_new_equipment_id;

  UPDATE public.equipment
  SET asset_state = CASE WHEN v_old_condition = 'hilang' THEN 'lost' ELSE 'retired' END,
      status = 'maintenance', availability_status = 'maintenance'::availability_status, updated_at = NOW()
  WHERE id = v_old_equipment_id;

  UPDATE public.equipment_recovery_cases
  SET status = 'completed', replacement_equipment_id = v_new_equipment_id,
      verified_by = p_created_by, completed_at = NOW(), updated_at = NOW()
  WHERE id = p_case_id;

  IF p_replacement_value IS NOT NULL THEN
    INSERT INTO public.equipment_valuations (equipment_id, replacement_value, currency, effective_at, created_by, change_reason)
    VALUES (v_new_equipment_id, p_replacement_value, 'IDR', CURRENT_DATE, p_created_by, trim(p_change_reason));
  END IF;

  INSERT INTO public.activity_logs (user_id, action, table_name, record_id, new_values, change_reason)
  VALUES (p_created_by, 'INSERT', 'equipment', v_new_equipment_id,
    jsonb_build_object('replacement_for', v_old_equipment_id, 'recovery_case_id', p_case_id), trim(p_change_reason));
  RETURN v_new_equipment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_equipment_charge_payment_atomic(
  p_settlement_id UUID,
  p_paid_amount NUMERIC,
  p_status TEXT,
  p_notes TEXT,
  p_recorded_by UUID,
  p_change_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount NUMERIC;
  v_status TEXT;
BEGIN
  IF p_settlement_id IS NULL OR p_recorded_by IS NULL THEN RAISE EXCEPTION 'CHARGE_IDENTITY_INVALID'; END IF;
  IF p_change_reason IS NULL OR length(trim(p_change_reason)) < 5 THEN RAISE EXCEPTION 'CHARGE_CHANGE_REASON_REQUIRED'; END IF;
  SELECT amount, status INTO v_amount, v_status FROM public.equipment_charge_settlements WHERE id = p_settlement_id FOR UPDATE;
  IF v_amount IS NULL THEN RAISE EXCEPTION 'CHARGE_SETTLEMENT_NOT_FOUND'; END IF;
  IF p_status NOT IN ('unpaid', 'partial', 'paid', 'waived') THEN RAISE EXCEPTION 'CHARGE_STATUS_INVALID'; END IF;
  IF p_paid_amount IS NULL OR p_paid_amount < 0 OR (p_status <> 'waived' AND p_paid_amount > v_amount) THEN RAISE EXCEPTION 'CHARGE_AMOUNT_INVALID'; END IF;
  UPDATE public.equipment_charge_settlements
  SET paid_amount = CASE WHEN p_status = 'waived' THEN 0 ELSE p_paid_amount END,
      status = p_status, notes = NULLIF(trim(p_notes), ''), recorded_by = p_recorded_by, updated_at = NOW()
  WHERE id = p_settlement_id;
  INSERT INTO public.activity_logs (user_id, action, table_name, record_id, new_values, change_reason)
  VALUES (p_recorded_by, 'UPDATE', 'equipment_charge_settlements', p_settlement_id,
    jsonb_build_object('status', p_status, 'paid_amount', p_paid_amount), trim(p_change_reason));
  RETURN p_settlement_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_equipment_charge_settlement_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_borrowing_id UUID;
  v_student_id UUID;
BEGIN
  IF NEW.charged_amount IS NULL OR NEW.charged_amount <= 0 THEN RETURN NEW; END IF;
  SELECT borrowing_id INTO v_borrowing_id FROM public.borrowing_return_assessments WHERE id = NEW.assessment_id;
  SELECT student_id INTO v_student_id FROM public.borrowings WHERE id = v_borrowing_id;
  IF v_borrowing_id IS NULL OR v_student_id IS NULL THEN RAISE EXCEPTION 'CHARGE_BORROWING_LINK_INVALID'; END IF;
  INSERT INTO public.equipment_charge_settlements (assessment_item_id, borrowing_id, student_id, amount)
  VALUES (NEW.id, v_borrowing_id, v_student_id, NEW.charged_amount)
  ON CONFLICT (assessment_item_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_equipment_charge_settlement ON public.borrowing_return_assessment_items;
CREATE TRIGGER trg_create_equipment_charge_settlement
AFTER INSERT ON public.borrowing_return_assessment_items
FOR EACH ROW EXECUTE FUNCTION public.create_equipment_charge_settlement_trigger();

CREATE OR REPLACE FUNCTION public.block_borrowing_approval_with_unpaid_charge()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM NEW.status AND EXISTS (
    SELECT 1 FROM public.equipment_charge_settlements ecs
    WHERE ecs.student_id = NEW.student_id AND ecs.status IN ('unpaid', 'partial')
  ) THEN
    RAISE EXCEPTION 'STUDENT_HAS_OUTSTANDING_EQUIPMENT_CHARGE';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_borrowing_approval_with_unpaid_charge ON public.borrowings;
CREATE TRIGGER trg_block_borrowing_approval_with_unpaid_charge
BEFORE UPDATE OF status ON public.borrowings
FOR EACH ROW EXECUTE FUNCTION public.block_borrowing_approval_with_unpaid_charge();

CREATE OR REPLACE FUNCTION public.enforce_equipment_state_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.kondisi IS NULL OR NEW.status IS NULL
    OR NEW.kondisi NOT IN ('bagus', 'sedikit_kerusakan', 'rusak', 'rusak_besar', 'sedang_diperbaiki', 'hilang')
    OR NEW.status NOT IN ('tersedia', 'dipinjam', 'maintenance') THEN
    RAISE EXCEPTION 'EQUIPMENT_STATE_INVALID';
  END IF;
  IF NEW.kondisi = 'bagus' AND NEW.status NOT IN ('tersedia', 'dipinjam') THEN
    RAISE EXCEPTION 'EQUIPMENT_STATE_INVALID';
  END IF;
  IF NEW.kondisi <> 'bagus' AND NEW.status <> 'maintenance' THEN
    RAISE EXCEPTION 'EQUIPMENT_STATE_INVALID';
  END IF;
  RETURN NEW;
END;
$$;

-- Reconcile legacy rows before enabling the invariant for future writes.
UPDATE public.equipment AS equipment
SET status = CASE
      WHEN EXISTS (
        SELECT 1 FROM public.borrowing_items item
        WHERE item.equipment_id = equipment.id AND item.status = 'borrowed'
      ) THEN 'dipinjam'
      ELSE 'tersedia'
    END,
    availability_status = CASE
      WHEN EXISTS (
        SELECT 1 FROM public.borrowing_items item
        WHERE item.equipment_id = equipment.id AND item.status = 'borrowed'
      ) THEN 'dipinjam'::availability_status
      ELSE 'tersedia'::availability_status
    END,
    physical_condition = 'bagus'::physical_condition
WHERE equipment.kondisi = 'bagus'
  AND equipment.status NOT IN ('tersedia', 'dipinjam');

UPDATE public.equipment
SET status = 'maintenance',
    availability_status = 'maintenance'::availability_status,
    physical_condition = CASE
      WHEN kondisi IN ('bagus', 'sedikit_kerusakan', 'rusak', 'rusak_besar', 'sedang_diperbaiki', 'hilang')
      THEN kondisi::physical_condition
      ELSE physical_condition
    END
WHERE kondisi <> 'bagus' AND status <> 'maintenance';

DROP TRIGGER IF EXISTS trg_enforce_equipment_state_consistency ON public.equipment;
CREATE TRIGGER trg_enforce_equipment_state_consistency
BEFORE INSERT OR UPDATE OF kondisi, status ON public.equipment
FOR EACH ROW EXECUTE FUNCTION public.enforce_equipment_state_consistency();

REVOKE ALL ON FUNCTION public.create_equipment_recovery_case_atomic(UUID, TEXT, UUID, TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_equipment_repair_atomic(UUID, JSONB, NUMERIC, TEXT, BOOLEAN, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.register_equipment_replacement_atomic(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, NUMERIC, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_equipment_charge_payment_atomic(UUID, NUMERIC, TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_equipment_recovery_case_atomic(UUID, TEXT, UUID, TEXT, TEXT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_equipment_repair_atomic(UUID, JSONB, NUMERIC, TEXT, BOOLEAN, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.register_equipment_replacement_atomic(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, NUMERIC, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_equipment_charge_payment_atomic(UUID, NUMERIC, TEXT, TEXT, UUID, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
