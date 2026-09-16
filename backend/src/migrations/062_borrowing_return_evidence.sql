-- 062_borrowing_return_evidence.sql
-- Private, compressed return-condition evidence linked to each borrowing item.

BEGIN;

CREATE TABLE IF NOT EXISTS public.borrowing_return_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrowing_id UUID NOT NULL REFERENCES public.borrowings(id) ON DELETE CASCADE,
  borrowing_item_id UUID NOT NULL REFERENCES public.borrowing_items(id) ON DELETE RESTRICT,
  equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE RESTRICT,
  assessment_item_id UUID REFERENCES public.borrowing_return_assessment_items(id) ON DELETE SET NULL,
  object_key TEXT NOT NULL,
  storage_provider TEXT NOT NULL DEFAULT 'r2',
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  original_filename TEXT NOT NULL,
  upload_status TEXT NOT NULL DEFAULT 'pending',
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  attached_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT borrowing_return_evidence_key_check CHECK (
    length(btrim(object_key)) BETWEEN 8 AND 1024
    AND btrim(object_key) ~ '^[A-Za-z0-9][A-Za-z0-9._/-]+$'
  ),
  CONSTRAINT borrowing_return_evidence_storage_check CHECK (storage_provider = 'r2'),
  CONSTRAINT borrowing_return_evidence_mime_check CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT borrowing_return_evidence_size_check CHECK (file_size_bytes BETWEEN 1 AND 614400),
  CONSTRAINT borrowing_return_evidence_filename_check CHECK (length(btrim(original_filename)) BETWEEN 1 AND 255),
  CONSTRAINT borrowing_return_evidence_status_check CHECK (upload_status IN ('pending', 'attached', 'abandoned')),
  CONSTRAINT borrowing_return_evidence_attachment_check CHECK (
    (upload_status = 'pending' AND attached_at IS NULL AND assessment_item_id IS NULL)
    OR (upload_status = 'attached' AND attached_at IS NOT NULL AND assessment_item_id IS NOT NULL)
    OR (upload_status = 'abandoned')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_borrowing_return_evidence_object_key
  ON public.borrowing_return_evidence (object_key);
CREATE INDEX IF NOT EXISTS idx_borrowing_return_evidence_item_status
  ON public.borrowing_return_evidence (borrowing_id, equipment_id, upload_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_borrowing_return_evidence_pending_cleanup
  ON public.borrowing_return_evidence (created_at, id)
  WHERE upload_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_borrowing_return_evidence_assessment_item
  ON public.borrowing_return_evidence (assessment_item_id)
  WHERE assessment_item_id IS NOT NULL;

ALTER TABLE public.borrowing_return_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.borrowing_return_evidence FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.borrowing_return_evidence TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_borrowing_return_evidence_atomic(
  p_borrowing_id UUID,
  p_equipment_id UUID,
  p_object_key TEXT,
  p_mime_type TEXT,
  p_file_size_bytes BIGINT,
  p_original_filename TEXT,
  p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_borrowing_item_id UUID;
  v_evidence public.borrowing_return_evidence;
BEGIN
  IF p_borrowing_id IS NULL OR p_equipment_id IS NULL OR p_actor_id IS NULL THEN
    RAISE EXCEPTION 'RETURN_EVIDENCE_IDENTITY_INVALID';
  END IF;
  IF length(btrim(COALESCE(p_object_key, ''))) NOT BETWEEN 8 AND 1024
     OR btrim(p_object_key) !~ '^[A-Za-z0-9][A-Za-z0-9._/-]+$' THEN
    RAISE EXCEPTION 'RETURN_EVIDENCE_OBJECT_KEY_INVALID';
  END IF;
  IF p_mime_type IS NULL OR p_mime_type NOT IN ('image/jpeg', 'image/png', 'image/webp')
     OR p_file_size_bytes IS NULL OR p_file_size_bytes NOT BETWEEN 1 AND 614400
     OR length(btrim(COALESCE(p_original_filename, ''))) NOT BETWEEN 1 AND 255 THEN
    RAISE EXCEPTION 'RETURN_EVIDENCE_FILE_INVALID';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = p_actor_id
      AND is_active = TRUE
      AND role::TEXT IN ('teacher', 'leader', 'vice_leader', 'equipment_team')
  ) THEN
    RAISE EXCEPTION 'RETURN_EVIDENCE_ACTOR_FORBIDDEN';
  END IF;

  SELECT bi.id
  INTO v_borrowing_item_id
  FROM public.borrowing_items bi
  JOIN public.borrowings b ON b.id = bi.borrowing_id
  WHERE bi.borrowing_id = p_borrowing_id
    AND bi.equipment_id = p_equipment_id
    AND bi.status = 'borrowed'
    AND b.status IN ('borrowed', 'partial')
  FOR UPDATE;
  IF v_borrowing_item_id IS NULL THEN
    RAISE EXCEPTION 'RETURN_EVIDENCE_ITEM_INVALID';
  END IF;

  SELECT *
  INTO v_evidence
  FROM public.borrowing_return_evidence
  WHERE object_key = btrim(p_object_key)
  FOR UPDATE;
  IF FOUND THEN
    IF v_evidence.borrowing_id IS DISTINCT FROM p_borrowing_id
       OR v_evidence.equipment_id IS DISTINCT FROM p_equipment_id
       OR v_evidence.created_by IS DISTINCT FROM p_actor_id THEN
      RAISE EXCEPTION 'RETURN_EVIDENCE_OBJECT_KEY_REUSED';
    END IF;
    RETURN jsonb_build_object('evidence', to_jsonb(v_evidence), 'idempotent_replay', TRUE);
  END IF;

  INSERT INTO public.borrowing_return_evidence (
    borrowing_id, borrowing_item_id, equipment_id, object_key, storage_provider,
    mime_type, file_size_bytes, original_filename, upload_status, created_by
  ) VALUES (
    p_borrowing_id, v_borrowing_item_id, p_equipment_id, btrim(p_object_key), 'r2',
    p_mime_type, p_file_size_bytes, btrim(p_original_filename), 'pending', p_actor_id
  )
  RETURNING * INTO v_evidence;

  RETURN jsonb_build_object('evidence', to_jsonb(v_evidence), 'idempotent_replay', FALSE);
END;
$$;

CREATE OR REPLACE FUNCTION public.preview_return_assessment(
  p_borrowing_id UUID,
  p_returned_at DATE,
  p_item_conditions JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_equipment_id UUID;
  v_borrowing_item_id UUID;
  v_valuation_id UUID;
  v_condition TEXT;
  v_settlement TEXT;
  v_value NUMERIC(14, 2);
  v_repair_cost NUMERIC(14, 2);
  v_charge NUMERIC(14, 2);
  v_total NUMERIC(14, 2) := 0;
  v_items JSONB := '[]'::JSONB;
BEGIN
  IF p_item_conditions IS NULL OR jsonb_typeof(p_item_conditions) <> 'array' OR jsonb_array_length(p_item_conditions) = 0 THEN
    RAISE EXCEPTION 'Return item conditions are required.';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_item_conditions)
  LOOP
    v_equipment_id := (v_item->>'equipment_id')::UUID;
    v_condition := v_item->>'kondisi_kembali';
    v_settlement := COALESCE(NULLIF(v_item->>'settlement_method', ''), CASE WHEN v_condition = 'bagus' THEN 'none' WHEN v_condition = 'hilang' THEN 'replacement' ELSE 'repair' END);
    v_repair_cost := NULLIF(trim(v_item->>'repair_cost'), '')::NUMERIC;
    v_value := NULL;
    v_valuation_id := NULL;
    v_charge := 0;

    SELECT bi.id INTO v_borrowing_item_id
    FROM public.borrowing_items bi
    WHERE bi.borrowing_id = p_borrowing_id AND bi.equipment_id = v_equipment_id AND bi.status = 'borrowed';
    IF v_borrowing_item_id IS NULL THEN RAISE EXCEPTION 'Equipment is not part of the active borrowing.'; END IF;
    IF v_condition NOT IN ('bagus', 'sedikit_kerusakan', 'rusak', 'rusak_besar', 'hilang') THEN RAISE EXCEPTION 'Invalid return condition.'; END IF;
    IF v_condition = 'bagus' AND v_settlement <> 'none' THEN RAISE EXCEPTION 'Good equipment cannot have a settlement charge.'; END IF;
    IF v_condition = 'hilang' AND v_settlement <> 'replacement' THEN RAISE EXCEPTION 'Lost equipment must use replacement settlement.'; END IF;

    IF v_settlement = 'replacement' THEN
      SELECT ev.replacement_value INTO v_value
      FROM public.equipment_valuations ev
      WHERE ev.equipment_id = v_equipment_id
        AND ev.effective_at <= (COALESCE(p_returned_at, CURRENT_DATE)::TIMESTAMPTZ + INTERVAL '1 day')
      ORDER BY ev.effective_at DESC, ev.created_at DESC, ev.id DESC LIMIT 1;
      IF v_value IS NULL THEN RAISE EXCEPTION 'Replacement valuation is missing for equipment %.', v_equipment_id; END IF;
      v_charge := v_value;
    ELSIF v_settlement = 'repair' THEN
      IF v_repair_cost IS NULL OR v_repair_cost <= 0 THEN RAISE EXCEPTION 'A positive repair cost is required for repair settlement.'; END IF;
      v_charge := v_repair_cost;
    ELSIF v_settlement <> 'none' THEN
      RAISE EXCEPTION 'Invalid settlement method.';
    END IF;

    v_total := v_total + v_charge;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'equipment_id', v_equipment_id, 'borrowing_item_id', v_borrowing_item_id,
      'condition', v_condition, 'settlement_method', v_settlement,
      'replacement_value', v_value, 'repair_cost', v_repair_cost, 'charge', v_charge
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'borrowing_id', p_borrowing_id, 'return_date', COALESCE(p_returned_at, CURRENT_DATE),
    'damage_charge', v_total, 'late_charge', 0, 'total_charge', v_total, 'items', v_items
  );
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
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_current_status TEXT;
  v_item JSONB;
  v_equipment_id UUID;
  v_borrowing_item_id UUID;
  v_valuation_id UUID;
  v_condition TEXT;
  v_settlement TEXT;
  v_value NUMERIC(14, 2);
  v_repair_cost NUMERIC(14, 2);
  v_charge NUMERIC(14, 2);
  v_total NUMERIC(14, 2) := 0;
  v_assessment_id UUID;
  v_assessment_item_id UUID;
  v_evidence_ids UUID[] := ARRAY[]::UUID[];
  v_evidence_count INTEGER;
BEGIN
  PERFORM set_config('app.current_user_id', COALESCE(p_returned_by::TEXT, ''), TRUE);
  PERFORM set_config('app.change_reason', COALESCE(LEFT(TRIM(p_change_reason), 500), ''), TRUE);

  IF p_change_reason IS NULL OR length(trim(p_change_reason)) < 5 THEN RAISE EXCEPTION 'Return change reason must contain at least 5 characters.'; END IF;
  IF p_item_conditions IS NULL OR jsonb_typeof(p_item_conditions) <> 'array' OR jsonb_array_length(p_item_conditions) = 0 THEN RAISE EXCEPTION 'Return item conditions are required.'; END IF;

  SELECT status INTO v_current_status FROM public.borrowings WHERE id = p_borrowing_id FOR UPDATE;
  IF v_current_status IS NULL THEN RAISE EXCEPTION 'Borrowing not found.'; END IF;
  IF v_current_status NOT IN ('borrowed', 'partial') THEN RAISE EXCEPTION 'Borrowing is not returnable.'; END IF;
  IF (SELECT COUNT(*) FROM public.borrowing_items WHERE borrowing_id = p_borrowing_id AND status = 'borrowed') <> jsonb_array_length(p_item_conditions) THEN RAISE EXCEPTION 'Every active borrowing item must be assessed.'; END IF;

  INSERT INTO public.borrowing_return_assessments (
    borrowing_id, status, return_date, notes, created_by, finalized_by, finalized_at
  ) VALUES (
    p_borrowing_id, 'finalized', COALESCE(p_returned_at, CURRENT_DATE), NULLIF(trim(p_catatan), ''), p_returned_by, p_returned_by, NOW()
  ) RETURNING id INTO v_assessment_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_item_conditions)
  LOOP
    v_equipment_id := (v_item->>'equipment_id')::UUID;
    v_condition := v_item->>'kondisi_kembali';
    v_settlement := COALESCE(NULLIF(v_item->>'settlement_method', ''), CASE WHEN v_condition = 'bagus' THEN 'none' WHEN v_condition = 'hilang' THEN 'replacement' ELSE 'repair' END);
    v_repair_cost := NULLIF(trim(v_item->>'repair_cost'), '')::NUMERIC;
    v_value := NULL;
    v_valuation_id := NULL;
    v_charge := 0;
    v_evidence_ids := ARRAY[]::UUID[];

    SELECT bi.id INTO v_borrowing_item_id
    FROM public.borrowing_items bi
    WHERE bi.borrowing_id = p_borrowing_id AND bi.equipment_id = v_equipment_id AND bi.status = 'borrowed'
    FOR UPDATE;
    IF v_borrowing_item_id IS NULL THEN RAISE EXCEPTION 'Equipment is not part of the active borrowing.'; END IF;
    IF v_condition NOT IN ('bagus', 'sedikit_kerusakan', 'rusak', 'rusak_besar', 'hilang') THEN RAISE EXCEPTION 'Invalid return condition.'; END IF;
    IF v_condition = 'bagus' AND v_settlement <> 'none' THEN RAISE EXCEPTION 'Good equipment cannot have a settlement charge.'; END IF;
    IF v_condition = 'hilang' AND v_settlement <> 'replacement' THEN RAISE EXCEPTION 'Lost equipment must use replacement settlement.'; END IF;

    IF v_item ? 'evidence_ids' AND jsonb_typeof(v_item->'evidence_ids') <> 'array' THEN
      RAISE EXCEPTION 'RETURN_EVIDENCE_INVALID';
    END IF;
    IF jsonb_typeof(v_item->'evidence_ids') = 'array' THEN
      IF EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(v_item->'evidence_ids') AS evidence(value)
        WHERE value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      ) THEN RAISE EXCEPTION 'RETURN_EVIDENCE_INVALID'; END IF;
      SELECT COALESCE(array_agg(value::UUID), ARRAY[]::UUID[])
      INTO v_evidence_ids
      FROM jsonb_array_elements_text(v_item->'evidence_ids') AS evidence(value);
    END IF;
    IF cardinality(v_evidence_ids) > 5 THEN RAISE EXCEPTION 'RETURN_EVIDENCE_INVALID'; END IF;
    IF cardinality(v_evidence_ids) <> (SELECT COUNT(DISTINCT evidence_id) FROM unnest(v_evidence_ids) AS ids(evidence_id)) THEN RAISE EXCEPTION 'RETURN_EVIDENCE_INVALID'; END IF;
    IF v_condition <> 'hilang' AND cardinality(v_evidence_ids) < 2 THEN RAISE EXCEPTION 'RETURN_EVIDENCE_REQUIRED'; END IF;
    IF cardinality(v_evidence_ids) > 0 THEN
      SELECT COUNT(*) INTO v_evidence_count
      FROM public.borrowing_return_evidence bre
      WHERE bre.id = ANY(v_evidence_ids)
        AND bre.borrowing_id = p_borrowing_id
        AND bre.borrowing_item_id = v_borrowing_item_id
        AND bre.equipment_id = v_equipment_id
        AND bre.created_by = p_returned_by
        AND bre.upload_status = 'pending';
      IF v_evidence_count <> cardinality(v_evidence_ids) THEN RAISE EXCEPTION 'RETURN_EVIDENCE_INVALID'; END IF;
    END IF;

    IF v_settlement = 'replacement' THEN
      SELECT ev.id, ev.replacement_value INTO v_valuation_id, v_value
      FROM public.equipment_valuations ev
      WHERE ev.equipment_id = v_equipment_id
        AND ev.effective_at <= (COALESCE(p_returned_at, CURRENT_DATE)::TIMESTAMPTZ + INTERVAL '1 day')
      ORDER BY ev.effective_at DESC, ev.created_at DESC, ev.id DESC LIMIT 1;
      IF v_value IS NULL THEN RAISE EXCEPTION 'Replacement valuation is missing for equipment %.', v_equipment_id; END IF;
      v_charge := v_value;
    ELSIF v_settlement = 'repair' THEN
      IF v_repair_cost IS NULL OR v_repair_cost <= 0 THEN RAISE EXCEPTION 'A positive repair cost is required for repair settlement.'; END IF;
      v_charge := v_repair_cost;
    ELSIF v_settlement <> 'none' THEN
      RAISE EXCEPTION 'Invalid settlement method.';
    END IF;

    INSERT INTO public.borrowing_return_assessment_items (
      assessment_id, borrowing_item_id, equipment_id, condition, settlement_method,
      valuation_id, replacement_value_snapshot, repair_cost, charged_amount, evidence_urls, notes
    ) VALUES (
      v_assessment_id, v_borrowing_item_id, v_equipment_id, v_condition, v_settlement,
      v_valuation_id, v_value, v_repair_cost, v_charge, '[]'::JSONB, NULLIF(trim(v_item->>'catatan'), '')
    ) RETURNING id INTO v_assessment_item_id;

    IF cardinality(v_evidence_ids) > 0 THEN
      UPDATE public.borrowing_return_evidence
      SET upload_status = 'attached', assessment_item_id = v_assessment_item_id, attached_at = NOW(), updated_at = NOW()
      WHERE id = ANY(v_evidence_ids) AND upload_status = 'pending';
    END IF;

    UPDATE public.borrowing_items
    SET status = 'returned', kondisi_kembali = v_condition, denda = v_charge,
        tanggal_dikembalikan = COALESCE(p_returned_at::TIMESTAMPTZ, NOW()),
        catatan = NULLIF(trim(v_item->>'catatan'), ''), updated_by = p_returned_by, updated_at = NOW()
    WHERE id = v_borrowing_item_id;

    UPDATE public.equipment
    SET kondisi = v_condition, physical_condition = v_condition::physical_condition,
        asset_state = CASE WHEN v_condition = 'hilang' THEN 'lost' ELSE 'active' END,
        status = CASE WHEN v_condition = 'bagus' THEN 'tersedia' ELSE 'maintenance' END,
        availability_status = (CASE WHEN v_condition = 'bagus' THEN 'tersedia' ELSE 'maintenance' END)::availability_status,
        updated_at = NOW()
    WHERE id = v_equipment_id;
    v_total := v_total + v_charge;
  END LOOP;

  UPDATE public.borrowing_return_assessments SET damage_charge = v_total, total_charge = v_total WHERE id = v_assessment_id;
  UPDATE public.borrowings
  SET status = 'returned', returned_at = COALESCE(p_returned_at::TIMESTAMPTZ, NOW()),
      catatan_pengembalian = NULLIF(trim(p_catatan), ''), total_denda = v_total,
      processed_return_by = p_returned_by, updated_by = p_returned_by, updated_at = NOW()
  WHERE id = p_borrowing_id;

  INSERT INTO public.activity_logs (user_id, action, table_name, record_id, new_values, change_reason)
  VALUES (p_returned_by, 'UPDATE', 'borrowings', p_borrowing_id,
    jsonb_build_object('status', 'returned', 'total_charge', v_total, 'assessment_id', v_assessment_id), trim(p_change_reason));

  RETURN p_borrowing_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_borrowing_return_evidence_atomic(UUID, UUID, TEXT, TEXT, BIGINT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_borrowing_return_evidence_atomic(UUID, UUID, TEXT, TEXT, BIGINT, TEXT, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.preview_return_assessment(UUID, DATE, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preview_return_assessment(UUID, DATE, JSONB) TO service_role;
REVOKE ALL ON FUNCTION public.return_borrowing_atomic(UUID, DATE, JSONB, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.return_borrowing_atomic(UUID, DATE, JSONB, TEXT, UUID, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
