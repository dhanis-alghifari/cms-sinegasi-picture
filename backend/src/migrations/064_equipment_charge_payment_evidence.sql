BEGIN;

CREATE TABLE IF NOT EXISTS public.equipment_charge_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID NOT NULL REFERENCES public.equipment_charge_settlements(id) ON DELETE CASCADE,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  notes TEXT,
  recorded_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_charge_payments_settlement
  ON public.equipment_charge_payments (settlement_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.equipment_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID NOT NULL REFERENCES public.equipment_charge_settlements(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.equipment_charge_payments(id) ON DELETE SET NULL,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('payment', 'repair', 'replacement')),
  object_key TEXT NOT NULL UNIQUE,
  storage_provider TEXT NOT NULL DEFAULT 'r2' CHECK (storage_provider = 'r2'),
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 614400),
  original_filename TEXT NOT NULL CHECK (length(trim(original_filename)) BETWEEN 1 AND 255),
  upload_status TEXT NOT NULL DEFAULT 'pending' CHECK (upload_status IN ('pending', 'attached', 'abandoned')),
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_evidence_settlement_status
  ON public.equipment_evidence (settlement_id, upload_status, created_at DESC);

ALTER TABLE public.equipment_charge_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.equipment_charge_payments, public.equipment_evidence FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.equipment_charge_payments TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.equipment_evidence TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_equipment_charge_evidence_atomic(
  p_settlement_id UUID,
  p_evidence_type TEXT,
  p_object_key TEXT,
  p_mime_type TEXT,
  p_file_size_bytes INTEGER,
  p_original_filename TEXT,
  p_created_by UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evidence_id UUID;
  v_charge_amount NUMERIC;
  v_charge_paid NUMERIC;
  v_charge_status TEXT;
BEGIN
  IF p_settlement_id IS NULL OR p_created_by IS NULL THEN RAISE EXCEPTION 'CHARGE_IDENTITY_INVALID'; END IF;
  SELECT amount, paid_amount, status INTO v_charge_amount, v_charge_paid, v_charge_status
  FROM public.equipment_charge_settlements WHERE id = p_settlement_id FOR UPDATE;
  IF v_charge_amount IS NULL THEN RAISE EXCEPTION 'CHARGE_SETTLEMENT_NOT_FOUND'; END IF;
  IF v_charge_status = 'waived' OR v_charge_paid >= v_charge_amount THEN RAISE EXCEPTION 'CHARGE_AMOUNT_INVALID'; END IF;
  IF p_evidence_type NOT IN ('payment', 'repair', 'replacement') THEN RAISE EXCEPTION 'CHARGE_EVIDENCE_INVALID'; END IF;
  IF p_mime_type NOT IN ('image/jpeg', 'image/png', 'image/webp') OR p_file_size_bytes IS NULL OR p_file_size_bytes < 1 OR p_file_size_bytes > 614400 THEN RAISE EXCEPTION 'CHARGE_EVIDENCE_FILE_INVALID'; END IF;
  IF NULLIF(trim(p_object_key), '') IS NULL OR NULLIF(trim(p_original_filename), '') IS NULL THEN RAISE EXCEPTION 'CHARGE_EVIDENCE_FILE_INVALID'; END IF;
  INSERT INTO public.equipment_evidence (settlement_id, evidence_type, object_key, mime_type, file_size_bytes, original_filename, created_by)
  VALUES (p_settlement_id, p_evidence_type, trim(p_object_key), p_mime_type, p_file_size_bytes, left(trim(p_original_filename), 255), p_created_by)
  RETURNING id INTO v_evidence_id;
  RETURN v_evidence_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_equipment_charge_payment_event_atomic(
  p_settlement_id UUID,
  p_payment_amount NUMERIC,
  p_evidence_ids UUID[],
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
  v_paid_amount NUMERIC;
  v_status TEXT;
  v_next_paid NUMERIC;
  v_payment_id UUID;
  v_evidence_count INTEGER;
  v_payment_evidence_count INTEGER;
  v_assessment_item_id UUID;
  v_recovery_type TEXT;
  v_resolution_evidence_count INTEGER;
  v_required_resolution_evidence INTEGER;
BEGIN
  IF p_settlement_id IS NULL OR p_recorded_by IS NULL THEN RAISE EXCEPTION 'CHARGE_IDENTITY_INVALID'; END IF;
  IF p_change_reason IS NULL OR length(trim(p_change_reason)) < 5 THEN RAISE EXCEPTION 'CHARGE_CHANGE_REASON_REQUIRED'; END IF;
  IF p_payment_amount IS NULL OR p_payment_amount <= 0 OR p_payment_amount > 9999999999.99 OR p_payment_amount <> round(p_payment_amount, 2) THEN RAISE EXCEPTION 'CHARGE_AMOUNT_INVALID'; END IF;
  IF p_evidence_ids IS NULL OR cardinality(p_evidence_ids) = 0 OR cardinality(p_evidence_ids) > 12 THEN RAISE EXCEPTION 'CHARGE_EVIDENCE_REQUIRED'; END IF;
  IF cardinality(p_evidence_ids) <> (SELECT count(DISTINCT id) FROM unnest(p_evidence_ids) AS ids(id)) THEN RAISE EXCEPTION 'CHARGE_EVIDENCE_INVALID'; END IF;

  SELECT amount, paid_amount, status, assessment_item_id INTO v_amount, v_paid_amount, v_status, v_assessment_item_id
  FROM public.equipment_charge_settlements WHERE id = p_settlement_id FOR UPDATE;
  IF v_amount IS NULL THEN RAISE EXCEPTION 'CHARGE_SETTLEMENT_NOT_FOUND'; END IF;
  IF v_status = 'waived' OR v_paid_amount >= v_amount THEN RAISE EXCEPTION 'CHARGE_AMOUNT_INVALID'; END IF;
  v_next_paid := v_paid_amount + p_payment_amount;
  IF v_next_paid > v_amount THEN RAISE EXCEPTION 'CHARGE_AMOUNT_INVALID'; END IF;

  SELECT count(*), count(*) FILTER (WHERE evidence_type = 'payment') INTO v_evidence_count, v_payment_evidence_count
  FROM public.equipment_evidence
  WHERE id = ANY(p_evidence_ids) AND settlement_id = p_settlement_id AND created_by = p_recorded_by
    AND upload_status = 'pending';
  IF v_evidence_count <> cardinality(p_evidence_ids) THEN RAISE EXCEPTION 'CHARGE_EVIDENCE_INVALID'; END IF;
  IF v_payment_evidence_count = 0 THEN RAISE EXCEPTION 'CHARGE_EVIDENCE_REQUIRED'; END IF;

  SELECT recovery_type INTO v_recovery_type
  FROM public.equipment_recovery_cases
  WHERE assessment_item_id = v_assessment_item_id
    AND status IN ('open', 'in_progress', 'awaiting_verification')
  ORDER BY created_at DESC LIMIT 1;
  IF v_next_paid >= v_amount AND v_recovery_type IS NOT NULL THEN
    SELECT count(*) INTO v_resolution_evidence_count
    FROM public.equipment_evidence
    WHERE id = ANY(p_evidence_ids) AND evidence_type = v_recovery_type
      AND settlement_id = p_settlement_id AND created_by = p_recorded_by AND upload_status = 'pending';
    v_required_resolution_evidence := CASE
      WHEN v_recovery_type = 'replacement' THEN 3
      ELSE 2
    END;
    IF v_resolution_evidence_count < v_required_resolution_evidence THEN
      RAISE EXCEPTION 'CHARGE_RESOLUTION_EVIDENCE_REQUIRED';
    END IF;
  END IF;

  INSERT INTO public.equipment_charge_payments (settlement_id, amount, notes, recorded_by)
  VALUES (p_settlement_id, p_payment_amount, NULLIF(trim(p_notes), ''), p_recorded_by)
  RETURNING id INTO v_payment_id;

  UPDATE public.equipment_evidence
  SET payment_id = v_payment_id, upload_status = 'attached', updated_at = NOW()
  WHERE id = ANY(p_evidence_ids);

  UPDATE public.equipment_charge_settlements
  SET paid_amount = v_next_paid,
      status = CASE WHEN v_next_paid >= amount THEN 'paid' ELSE 'partial' END,
      notes = COALESCE(NULLIF(trim(p_notes), ''), notes), recorded_by = p_recorded_by, updated_at = NOW()
  WHERE id = p_settlement_id;

  INSERT INTO public.activity_logs (user_id, action, table_name, record_id, new_values, change_reason)
  VALUES (p_recorded_by, 'INSERT', 'equipment_charge_payments', v_payment_id,
    jsonb_build_object('settlement_id', p_settlement_id, 'amount', p_payment_amount, 'evidence_count', cardinality(p_evidence_ids)), trim(p_change_reason));
  RETURN p_settlement_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_equipment_charge_evidence_atomic(UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_equipment_charge_payment_event_atomic(UUID, NUMERIC, UUID[], TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_equipment_charge_evidence_atomic(UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_equipment_charge_payment_event_atomic(UUID, NUMERIC, UUID[], TEXT, UUID, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
