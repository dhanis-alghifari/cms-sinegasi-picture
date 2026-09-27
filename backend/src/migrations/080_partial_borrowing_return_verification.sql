-- Allow teachers to verify returned equipment in independent batches.
-- A borrowing remains a single parent transaction; each borrowing item can be
-- assessed once, and only the items included in a verification are finalized.

BEGIN;

SELECT set_config('app.system_operation', 'true', true);
SELECT set_config('app.change_reason', 'SYSTEM:MIGRATION_080_PARTIAL_BORROWING_RETURN_VERIFICATION', true);

DO $$
BEGIN
  IF to_regclass('public.borrowings') IS NULL
     OR to_regclass('public.borrowing_items') IS NULL
     OR to_regclass('public.borrowing_return_reports') IS NULL
     OR to_regclass('public.borrowing_return_operations') IS NULL
     OR to_regclass('public.borrowing_return_assessments') IS NULL
     OR to_regclass('public.borrowing_return_assessment_items') IS NULL
     OR to_regclass('public.borrowing_return_evidence') IS NULL
     OR to_regclass('public.borrowing_migration_history') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM public.borrowing_migration_history
       WHERE migration_name = '068_borrowing_self_return_verification.sql'
     ) THEN
    RAISE EXCEPTION 'PARTIAL_RETURN_SCHEMA_MISSING: jalankan migration borrowing sampai 068 terlebih dahulu';
  END IF;
END;
$$;

-- A finalized assessment now represents one return batch. The unique item
-- index prevents the same borrowed item from being charged in a later batch.
DROP INDEX IF EXISTS public.uq_final_return_assessment_per_borrowing;
CREATE UNIQUE INDEX IF NOT EXISTS uq_final_return_assessment_item_once
  ON public.borrowing_return_assessment_items (borrowing_item_id);

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
  v_cumulative_total NUMERIC(14, 2) := 0;
  v_assessment_id UUID;
  v_assessment_item_id UUID;
  v_evidence_ids UUID[] := ARRAY[]::UUID[];
  v_evidence_count INTEGER;
  v_active_count INTEGER;
  v_remaining_count INTEGER;
  v_borrowing_total NUMERIC(14, 2);
  v_final_status TEXT;
BEGIN
  PERFORM set_config('app.current_user_id', COALESCE(p_returned_by::TEXT, ''), TRUE);
  PERFORM set_config('app.change_reason', COALESCE(LEFT(TRIM(p_change_reason), 500), ''), TRUE);

  IF p_change_reason IS NULL OR length(trim(p_change_reason)) < 5 THEN RAISE EXCEPTION 'Return change reason must contain at least 5 characters.'; END IF;
  IF p_item_conditions IS NULL OR jsonb_typeof(p_item_conditions) <> 'array' OR jsonb_array_length(p_item_conditions) = 0 THEN
    RAISE EXCEPTION 'Return item conditions are required.';
  END IF;

  SELECT status, total_denda INTO v_current_status, v_borrowing_total
  FROM public.borrowings WHERE id = p_borrowing_id FOR UPDATE;
  IF v_current_status IS NULL THEN RAISE EXCEPTION 'Borrowing not found.'; END IF;
  IF v_current_status NOT IN ('borrowed', 'partial') THEN RAISE EXCEPTION 'Borrowing is not returnable.'; END IF;

  PERFORM bi.id
  FROM public.borrowing_items AS bi
  WHERE bi.borrowing_id = p_borrowing_id AND bi.status = 'borrowed'
  ORDER BY bi.id
  FOR UPDATE;
  SELECT COUNT(*) INTO v_active_count
  FROM public.borrowing_items
  WHERE borrowing_id = p_borrowing_id AND status = 'borrowed';
  IF jsonb_array_length(p_item_conditions) > v_active_count THEN
    RAISE EXCEPTION 'Return conditions may only include active borrowing items.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_item_conditions) AS entry(value)
    GROUP BY entry.value->>'equipment_id'
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate equipment in return conditions.';
  END IF;

  INSERT INTO public.borrowing_return_assessments (
    borrowing_id, status, return_date, notes, created_by, finalized_by, finalized_at
  ) VALUES (
    p_borrowing_id, 'finalized', COALESCE(p_returned_at, CURRENT_DATE), NULLIF(trim(p_catatan), ''), p_returned_by, p_returned_by, NOW()
  ) RETURNING id INTO v_assessment_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_item_conditions)
  LOOP
    IF jsonb_typeof(v_item) <> 'object' OR v_item->>'equipment_id' IS NULL OR v_item->>'kondisi_kembali' IS NULL THEN
      RAISE EXCEPTION 'Return item conditions are invalid.';
    END IF;
    v_equipment_id := (v_item->>'equipment_id')::UUID;
    v_condition := v_item->>'kondisi_kembali';
    v_settlement := COALESCE(NULLIF(v_item->>'settlement_method', ''), CASE WHEN v_condition = 'bagus' THEN 'none' WHEN v_condition = 'hilang' THEN 'replacement' ELSE 'repair' END);
    v_repair_cost := NULLIF(trim(v_item->>'repair_cost'), '')::NUMERIC;
    v_value := NULL;
    v_valuation_id := NULL;
    v_charge := 0;
    v_evidence_ids := ARRAY[]::UUID[];

    SELECT bi.id INTO v_borrowing_item_id
    FROM public.borrowing_items AS bi
    WHERE bi.borrowing_id = p_borrowing_id AND bi.equipment_id = v_equipment_id AND bi.status = 'borrowed'
    FOR UPDATE;
    IF v_borrowing_item_id IS NULL THEN RAISE EXCEPTION 'Equipment is not part of the active borrowing.'; END IF;
    IF v_condition NOT IN ('bagus', 'sedikit_kerusakan', 'rusak', 'rusak_besar', 'hilang') THEN RAISE EXCEPTION 'Invalid return condition.'; END IF;
    IF v_condition = 'bagus' AND v_settlement <> 'none' THEN RAISE EXCEPTION 'Good equipment cannot have a settlement charge.'; END IF;
    IF v_condition = 'hilang' AND v_settlement <> 'replacement' THEN RAISE EXCEPTION 'Lost equipment must use replacement settlement.'; END IF;

    IF v_item ? 'evidence_ids' AND jsonb_typeof(v_item->'evidence_ids') <> 'array' THEN RAISE EXCEPTION 'RETURN_EVIDENCE_INVALID'; END IF;
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
      FROM public.borrowing_return_evidence AS bre
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
      FROM public.equipment_valuations AS ev
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
    WHERE id = v_borrowing_item_id AND status = 'borrowed';

    UPDATE public.equipment
    SET kondisi = v_condition, physical_condition = v_condition::physical_condition,
        asset_state = CASE WHEN v_condition = 'hilang' THEN 'lost' ELSE 'active' END,
        status = CASE WHEN v_condition = 'bagus' THEN 'tersedia' ELSE 'maintenance' END,
        availability_status = (CASE WHEN v_condition = 'bagus' THEN 'tersedia' ELSE 'maintenance' END)::availability_status,
        updated_at = NOW()
    WHERE id = v_equipment_id;
    v_total := v_total + v_charge;
  END LOOP;

  SELECT COUNT(*) INTO v_remaining_count
  FROM public.borrowing_items
  WHERE borrowing_id = p_borrowing_id AND status = 'borrowed';
  v_final_status := CASE WHEN v_remaining_count = 0 THEN 'returned' ELSE 'partial' END;
  v_cumulative_total := COALESCE(v_borrowing_total, 0) + v_total;

  UPDATE public.borrowing_return_assessments
  SET damage_charge = v_total, total_charge = v_total
  WHERE id = v_assessment_id;
  UPDATE public.borrowings
  SET status = v_final_status,
      returned_at = CASE WHEN v_remaining_count = 0 THEN COALESCE(p_returned_at::TIMESTAMPTZ, NOW()) ELSE returned_at END,
      catatan_pengembalian = COALESCE(NULLIF(trim(p_catatan), ''), catatan_pengembalian),
      total_denda = v_cumulative_total,
      processed_return_by = p_returned_by, updated_by = p_returned_by, updated_at = NOW()
  WHERE id = p_borrowing_id;

  INSERT INTO public.activity_logs (user_id, action, table_name, record_id, new_values, change_reason)
  VALUES (p_returned_by, 'UPDATE', 'borrowings', p_borrowing_id,
    jsonb_build_object(
      'status', v_final_status,
      'batch_charge', v_total,
      'total_charge', v_cumulative_total,
      'assessment_id', v_assessment_id,
      'remaining_item_count', v_remaining_count
    ), trim(p_change_reason));

  RETURN p_borrowing_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_borrowing_self_return_atomic(
  p_report_id UUID,
  p_decision TEXT,
  p_verification_method TEXT,
  p_item_conditions JSONB,
  p_rejection_reason TEXT,
  p_verified_by UUID,
  p_idempotency_key TEXT,
  p_change_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_report public.borrowing_return_reports;
  v_borrowing public.borrowings;
  v_operation public.borrowing_return_operations;
  v_item JSONB;
  v_evidence_ids JSONB;
  v_conditions JSONB := '[]'::JSONB;
  v_equipment_ids UUID[] := ARRAY[]::UUID[];
  v_response JSONB;
  v_count INTEGER;
  v_active_count INTEGER;
  v_remaining_count INTEGER;
  v_returned_count INTEGER;
  v_parent_status TEXT;
  v_final_report_status TEXT;
  v_final_borrowing_status TEXT;
  v_equipment_id UUID;
BEGIN
  IF p_report_id IS NULL OR p_verified_by IS NULL OR p_decision IS NULL OR p_decision NOT IN ('approve', 'reject')
     OR (p_decision = 'approve' AND (p_verification_method IS NULL OR p_verification_method NOT IN ('photo', 'physical_check', 'photo_and_physical')))
     OR (p_decision = 'reject' AND length(btrim(COALESCE(p_rejection_reason, ''))) < 5)
     OR length(btrim(COALESCE(p_idempotency_key, ''))) NOT BETWEEN 8 AND 128
     OR length(btrim(COALESCE(p_change_reason, ''))) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_VERIFICATION_INPUT_INVALID';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_verified_by AND is_active = TRUE AND role::TEXT = 'teacher'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_VERIFICATION_ACTOR_FORBIDDEN';
  END IF;

  PERFORM set_config('app.current_user_id', p_verified_by::TEXT, TRUE);
  PERFORM set_config('app.change_reason', left(btrim(p_change_reason), 500), TRUE);

  SELECT * INTO v_report
  FROM public.borrowing_return_reports
  WHERE id = p_report_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_VERIFICATION_TRANSITION_INVALID';
  END IF;
  INSERT INTO public.borrowing_return_operations (idempotency_key, report_id, operation_kind, actor_id)
  VALUES (btrim(p_idempotency_key), p_report_id, 'verify', p_verified_by)
  ON CONFLICT (idempotency_key) DO NOTHING;
  IF NOT FOUND THEN
    SELECT * INTO v_operation
    FROM public.borrowing_return_operations
    WHERE idempotency_key = btrim(p_idempotency_key);
    IF v_operation.report_id IS DISTINCT FROM p_report_id
       OR v_operation.actor_id IS DISTINCT FROM p_verified_by
       OR v_operation.operation_kind <> 'verify' THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_VERIFICATION_IDEMPOTENCY_REUSED';
    END IF;
    IF v_operation.response_payload IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_VERIFICATION_OPERATION_INCOMPLETE';
    END IF;
    RETURN v_operation.response_payload || jsonb_build_object('idempotent_replay', TRUE);
  END IF;
  IF v_report.status <> 'pending_verification' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_VERIFICATION_TRANSITION_INVALID';
  END IF;

  SELECT * INTO v_borrowing
  FROM public.borrowings
  WHERE id = v_report.borrowing_id
  FOR UPDATE;
  IF NOT FOUND OR v_borrowing.status <> 'pending_verification' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_VERIFICATION_TRANSITION_INVALID';
  END IF;
  PERFORM bi.id
  FROM public.borrowing_items AS bi
  WHERE bi.borrowing_id = v_borrowing.id AND bi.status = 'borrowed'
  ORDER BY bi.id
  FOR UPDATE;
  SELECT COUNT(*) INTO v_active_count
  FROM public.borrowing_items
  WHERE borrowing_id = v_borrowing.id AND status = 'borrowed';
  SELECT COUNT(*) INTO v_returned_count
  FROM public.borrowing_items
  WHERE borrowing_id = v_borrowing.id AND status = 'returned';

  IF p_decision = 'reject' THEN
    UPDATE public.borrowing_return_evidence
    SET upload_status = 'abandoned', updated_at = NOW()
    WHERE return_report_id = p_report_id AND upload_status = 'pending';
    UPDATE public.borrowing_return_reports
    SET status = 'rejected', rejection_reason = btrim(p_rejection_reason),
        verified_by = p_verified_by, verified_at = NOW(), updated_at = NOW()
    WHERE id = p_report_id;

    IF v_active_count = 0 THEN
      v_parent_status := 'returned';
    ELSIF v_returned_count > 0 THEN
      v_parent_status := 'partial';
    ELSE
      v_parent_status := 'borrowed';
    END IF;
    UPDATE public.borrowings
    SET status = v_parent_status,
        return_reported_at = NULL,
        return_notes = NULL,
        updated_by = p_verified_by,
        updated_at = NOW()
    WHERE id = v_borrowing.id;

    INSERT INTO public.activity_logs (user_id, action, table_name, record_id, new_values, change_reason)
    VALUES (p_verified_by, 'UPDATE', 'borrowings', v_borrowing.id,
      jsonb_build_object(
        'return_report_id', p_report_id,
        'decision', 'reject',
        'borrowing_status', v_parent_status,
        'remaining_item_count', v_active_count,
        'rejection_reason', btrim(p_rejection_reason)
      ), btrim(p_change_reason));

    v_response := jsonb_build_object(
      'report_id', p_report_id,
      'borrowing_id', v_borrowing.id,
      'status', v_parent_status,
      'report_status', 'rejected',
      'remaining_item_count', v_active_count,
      'idempotent_replay', FALSE
    );
  ELSE
    IF p_item_conditions IS NULL OR jsonb_typeof(p_item_conditions) <> 'array'
       OR jsonb_array_length(p_item_conditions) = 0 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_VERIFICATION_CONDITIONS_REQUIRED';
    END IF;
    IF jsonb_array_length(p_item_conditions) > v_active_count THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_VERIFICATION_ITEM_NOT_ACTIVE';
    END IF;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_item_conditions)
    LOOP
      IF jsonb_typeof(v_item) <> 'object'
         OR v_item->>'equipment_id' IS NULL
         OR v_item->>'kondisi_kembali' IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_VERIFICATION_CONDITIONS_INVALID';
      END IF;
      v_equipment_id := (v_item->>'equipment_id')::UUID;
      IF v_equipment_id = ANY(v_equipment_ids) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_VERIFICATION_DUPLICATE_ITEM';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.borrowing_items AS bi
        WHERE bi.borrowing_id = v_borrowing.id
          AND bi.equipment_id = v_equipment_id
          AND bi.status = 'borrowed'
      ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RETURN_VERIFICATION_ITEM_NOT_ACTIVE';
      END IF;
      v_equipment_ids := array_append(v_equipment_ids, v_equipment_id);
      SELECT jsonb_agg(to_jsonb(bre.id)) INTO v_evidence_ids
      FROM public.borrowing_return_evidence AS bre
      WHERE bre.return_report_id = p_report_id
        AND bre.equipment_id = v_equipment_id
        AND bre.source = 'student_report'
        AND bre.upload_status = 'pending';
      v_conditions := v_conditions || jsonb_build_array(
        (v_item - 'evidence_ids') || jsonb_build_object('evidence_ids', COALESCE(v_evidence_ids, '[]'::JSONB))
      );
    END LOOP;

    UPDATE public.borrowing_return_evidence
    SET created_by = p_verified_by, updated_at = NOW()
    WHERE return_report_id = p_report_id
      AND equipment_id = ANY(v_equipment_ids)
      AND upload_status = 'pending';

    -- return_borrowing_atomic accepts the operational parent states. Restore
    -- the state derived from already-returned items inside this transaction;
    -- the parent is moved back to pending_verification below when items remain.
    UPDATE public.borrowings
    SET status = CASE WHEN v_returned_count > 0 THEN 'partial' ELSE 'borrowed' END
    WHERE id = v_borrowing.id;
    PERFORM public.return_borrowing_atomic(
      v_borrowing.id, CURRENT_DATE, v_conditions, v_report.notes, p_verified_by, p_change_reason
    );

    UPDATE public.borrowing_return_evidence
    SET created_by = v_report.reporter_id, return_report_id = p_report_id, updated_at = NOW()
    WHERE return_report_id = p_report_id;

    SELECT COUNT(*) INTO v_remaining_count
    FROM public.borrowing_items
    WHERE borrowing_id = v_borrowing.id AND status = 'borrowed';
    IF v_remaining_count = 0 THEN
      v_final_report_status := 'approved';
      v_final_borrowing_status := 'returned';
    ELSE
      v_final_report_status := 'pending_verification';
      v_final_borrowing_status := 'pending_verification';
    END IF;

    UPDATE public.borrowing_return_reports
    SET status = v_final_report_status,
        rejection_reason = NULL,
        verification_method = p_verification_method,
        verified_by = p_verified_by,
        verified_at = NOW(),
        updated_at = NOW()
    WHERE id = p_report_id;
    UPDATE public.borrowings
    SET status = v_final_borrowing_status,
        return_reported_at = CASE WHEN v_remaining_count = 0 THEN return_reported_at ELSE COALESCE(return_reported_at, v_report.reported_at, NOW()) END,
        return_verified_at = NOW(),
        return_verified_by = p_verified_by,
        updated_by = p_verified_by,
        updated_at = NOW()
    WHERE id = v_borrowing.id;

    SELECT COUNT(*) INTO v_count
    FROM public.borrowing_return_evidence AS bre
    WHERE bre.return_report_id = p_report_id
      AND bre.equipment_id = ANY(v_equipment_ids)
      AND bre.upload_status = 'attached';
    INSERT INTO public.activity_logs (user_id, action, table_name, record_id, new_values, change_reason)
    VALUES (p_verified_by, 'UPDATE', 'borrowings', v_borrowing.id,
      jsonb_build_object(
        'return_report_id', p_report_id,
        'decision', 'approve',
        'verified_equipment_ids', to_jsonb(v_equipment_ids),
        'verified_evidence_count', v_count,
        'report_status', v_final_report_status,
        'borrowing_status', v_final_borrowing_status,
        'remaining_item_count', v_remaining_count
      ), btrim(p_change_reason));

    v_response := jsonb_build_object(
      'report_id', p_report_id,
      'borrowing_id', v_borrowing.id,
      'status', v_final_borrowing_status,
      'report_status', v_final_report_status,
      'verified_equipment_ids', to_jsonb(v_equipment_ids),
      'remaining_item_count', v_remaining_count,
      'idempotent_replay', FALSE
    );
  END IF;

  UPDATE public.borrowing_return_operations
  SET response_payload = v_response
  WHERE idempotency_key = btrim(p_idempotency_key);
  RETURN v_response;
END;
$$;

REVOKE ALL ON FUNCTION public.return_borrowing_atomic(UUID, DATE, JSONB, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.return_borrowing_atomic(UUID, DATE, JSONB, TEXT, UUID, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.verify_borrowing_self_return_atomic(UUID, TEXT, TEXT, JSONB, TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_borrowing_self_return_atomic(UUID, TEXT, TEXT, JSONB, TEXT, UUID, TEXT, TEXT) TO service_role;

INSERT INTO public.borrowing_migration_history (migration_name)
VALUES ('080_partial_borrowing_return_verification.sql')
ON CONFLICT (migration_name) DO NOTHING;

NOTIFY pgrst, 'reload schema';
COMMIT;
