-- 061_equipment_valuation_ordering.sql
-- Make same-day valuation revisions deterministic. UUID ordering is random and
-- must not be used as the tie-breaker for the active replacement value.

DROP INDEX IF EXISTS public.idx_equipment_valuations_lookup;
CREATE INDEX IF NOT EXISTS idx_equipment_valuations_lookup
  ON public.equipment_valuations (equipment_id, effective_at DESC, created_at DESC, id DESC);

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
    WHERE bi.borrowing_id = p_borrowing_id
      AND bi.equipment_id = v_equipment_id
      AND bi.status = 'borrowed';
    IF v_borrowing_item_id IS NULL THEN
      RAISE EXCEPTION 'Equipment is not part of the active borrowing.';
    END IF;

    IF v_condition NOT IN ('bagus', 'sedikit_kerusakan', 'rusak', 'rusak_besar', 'sedang_diperbaiki', 'hilang') THEN
      RAISE EXCEPTION 'Invalid return condition.';
    END IF;
    IF v_condition = 'bagus' AND v_settlement <> 'none' THEN
      RAISE EXCEPTION 'Good equipment cannot have a settlement charge.';
    END IF;
    IF v_condition = 'hilang' AND v_settlement <> 'replacement' THEN
      RAISE EXCEPTION 'Lost equipment must use replacement settlement.';
    END IF;

    IF v_settlement = 'replacement' THEN
      SELECT ev.replacement_value INTO v_value
      FROM public.equipment_valuations ev
      WHERE ev.equipment_id = v_equipment_id
        AND ev.effective_at <= (COALESCE(p_returned_at, CURRENT_DATE)::TIMESTAMPTZ + INTERVAL '1 day')
      ORDER BY ev.effective_at DESC, ev.created_at DESC, ev.id DESC
      LIMIT 1;
      IF v_value IS NULL THEN
        RAISE EXCEPTION 'Replacement valuation is missing for equipment %.', v_equipment_id;
      END IF;
      v_charge := v_value;
    ELSIF v_settlement = 'repair' THEN
      IF v_repair_cost IS NULL OR v_repair_cost <= 0 THEN
        RAISE EXCEPTION 'A positive repair cost is required for repair settlement.';
      END IF;
      v_charge := v_repair_cost;
    ELSIF v_settlement <> 'none' THEN
      RAISE EXCEPTION 'Invalid settlement method.';
    END IF;

    v_total := v_total + v_charge;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'equipment_id', v_equipment_id,
      'borrowing_item_id', v_borrowing_item_id,
      'condition', v_condition,
      'settlement_method', v_settlement,
      'replacement_value', v_value,
      'repair_cost', v_repair_cost,
      'charge', v_charge
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'borrowing_id', p_borrowing_id,
    'return_date', COALESCE(p_returned_at, CURRENT_DATE),
    'damage_charge', v_total,
    'late_charge', 0,
    'total_charge', v_total,
    'items', v_items
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
BEGIN
  PERFORM set_config('app.current_user_id', COALESCE(p_returned_by::TEXT, ''), TRUE);
  PERFORM set_config('app.change_reason', COALESCE(LEFT(TRIM(p_change_reason), 500), ''), TRUE);

  IF p_change_reason IS NULL OR length(trim(p_change_reason)) < 5 THEN
    RAISE EXCEPTION 'Return change reason must contain at least 5 characters.';
  END IF;
  IF p_item_conditions IS NULL OR jsonb_typeof(p_item_conditions) <> 'array' OR jsonb_array_length(p_item_conditions) = 0 THEN
    RAISE EXCEPTION 'Return item conditions are required.';
  END IF;

  SELECT status INTO v_current_status
  FROM public.borrowings
  WHERE id = p_borrowing_id
  FOR UPDATE;
  IF v_current_status IS NULL THEN RAISE EXCEPTION 'Borrowing not found.'; END IF;
  IF v_current_status NOT IN ('borrowed', 'partial') THEN RAISE EXCEPTION 'Borrowing is not returnable.'; END IF;
  IF (SELECT COUNT(*) FROM public.borrowing_items WHERE borrowing_id = p_borrowing_id AND status = 'borrowed') <> jsonb_array_length(p_item_conditions) THEN
    RAISE EXCEPTION 'Every active borrowing item must be assessed.';
  END IF;

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

    SELECT bi.id INTO v_borrowing_item_id
    FROM public.borrowing_items bi
    WHERE bi.borrowing_id = p_borrowing_id AND bi.equipment_id = v_equipment_id AND bi.status = 'borrowed'
    FOR UPDATE;
    IF v_borrowing_item_id IS NULL THEN RAISE EXCEPTION 'Equipment is not part of the active borrowing.'; END IF;
    IF v_condition NOT IN ('bagus', 'sedikit_kerusakan', 'rusak', 'rusak_besar', 'sedang_diperbaiki', 'hilang') THEN RAISE EXCEPTION 'Invalid return condition.'; END IF;
    IF v_condition = 'bagus' AND v_settlement <> 'none' THEN RAISE EXCEPTION 'Good equipment cannot have a settlement charge.'; END IF;
    IF v_condition = 'hilang' AND v_settlement <> 'replacement' THEN RAISE EXCEPTION 'Lost equipment must use replacement settlement.'; END IF;

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
      valuation_id, replacement_value_snapshot, repair_cost, charged_amount,
      evidence_urls, notes
    ) VALUES (
      v_assessment_id, (SELECT id FROM public.borrowing_items WHERE borrowing_id = p_borrowing_id AND equipment_id = v_equipment_id),
      v_equipment_id, v_condition, v_settlement,
      v_valuation_id,
      v_value, v_repair_cost, v_charge,
      CASE WHEN jsonb_typeof(v_item->'evidence_urls') = 'array' THEN v_item->'evidence_urls' ELSE '[]'::JSONB END,
      NULLIF(trim(v_item->>'catatan'), '')
    );

    UPDATE public.borrowing_items
    SET status = 'returned', kondisi_kembali = v_condition, denda = v_charge,
        tanggal_dikembalikan = COALESCE(p_returned_at::TIMESTAMPTZ, NOW()),
        catatan = NULLIF(trim(v_item->>'catatan'), ''), updated_by = p_returned_by, updated_at = NOW()
    WHERE id = (SELECT id FROM public.borrowing_items WHERE borrowing_id = p_borrowing_id AND equipment_id = v_equipment_id);

    UPDATE public.equipment
    SET kondisi = v_condition,
        physical_condition = v_condition::physical_condition,
        asset_state = CASE WHEN v_condition = 'hilang' THEN 'lost' ELSE 'active' END,
        status = CASE WHEN v_condition = 'bagus' THEN 'tersedia' ELSE 'maintenance' END,
        availability_status = (CASE WHEN v_condition = 'bagus' THEN 'tersedia' ELSE 'maintenance' END)::availability_status,
        updated_at = NOW()
    WHERE id = v_equipment_id;
    v_total := v_total + v_charge;
  END LOOP;

  UPDATE public.borrowing_return_assessments
  SET damage_charge = v_total, total_charge = v_total
  WHERE id = v_assessment_id;

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

REVOKE ALL ON FUNCTION public.preview_return_assessment(UUID, DATE, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preview_return_assessment(UUID, DATE, JSONB) TO service_role;
REVOKE ALL ON FUNCTION public.return_borrowing_atomic(UUID, DATE, JSONB, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.return_borrowing_atomic(UUID, DATE, JSONB, TEXT, UUID, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
