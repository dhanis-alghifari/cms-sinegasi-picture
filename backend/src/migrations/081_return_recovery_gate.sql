-- Keep damaged or missing equipment unresolved until verified recovery finishes.
-- Migration 080 remains immutable; this migration adds the recovery lifecycle on top.

BEGIN;

SELECT set_config('app.system_operation', 'true', true);
SELECT set_config('app.change_reason', 'SYSTEM:MIGRATION_081_RETURN_RECOVERY_GATE', true);

DO $$
BEGIN
  IF to_regclass('public.borrowing_items') IS NULL
     OR to_regclass('public.borrowings') IS NULL
     OR to_regclass('public.borrowing_return_assessment_items') IS NULL
     OR to_regclass('public.equipment_recovery_cases') IS NULL
     OR to_regclass('public.borrowing_return_reports') IS NULL
     OR to_regclass('public.borrowing_return_evidence') IS NULL
     OR to_regprocedure('public.create_equipment_recovery_case_atomic(uuid,text,uuid,text,text,uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'RETURN_RECOVERY_SCHEMA_MISSING';
  END IF;
END;
$$;

ALTER TABLE public.borrowing_items
  DROP CONSTRAINT IF EXISTS borrowing_items_status_check,
  ADD CONSTRAINT borrowing_items_status_check CHECK (
    status IN ('pending', 'approved', 'borrowed', 'pending_resolution', 'returned', 'rejected')
  ) NOT VALID;

-- The teacher records the recovery path, but cannot settle a damaged unit as
-- replaced or a lost unit as repaired. Existing historical rows are preserved.
ALTER TABLE public.borrowing_return_assessment_items
  ADD CONSTRAINT return_assessment_recovery_settlement_check CHECK (
    (condition = 'bagus' AND settlement_method = 'none')
    OR (condition = 'hilang' AND settlement_method = 'replacement')
    OR (condition IN ('sedikit_kerusakan', 'rusak', 'rusak_besar') AND settlement_method = 'repair')
  ) NOT VALID;

CREATE OR REPLACE FUNCTION public.open_return_recovery_case()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_borrowing_id UUID;
  v_item_status TEXT;
  v_actor_id UUID;
  v_change_reason TEXT;
  v_recovery_type TEXT;
BEGIN
  IF NEW.condition = 'bagus' THEN
    RETURN NEW;
  END IF;

  IF (NEW.condition = 'hilang' AND NEW.settlement_method <> 'replacement')
     OR (NEW.condition <> 'hilang' AND NEW.settlement_method <> 'repair') THEN
    RAISE EXCEPTION 'RETURN_RECOVERY_METHOD_INVALID';
  END IF;

  v_actor_id := NULLIF(current_setting('app.current_user_id', true), '')::UUID;
  v_change_reason := NULLIF(current_setting('app.change_reason', true), '');
  IF v_actor_id IS NULL OR length(btrim(COALESCE(v_change_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'RETURN_RECOVERY_AUDIT_CONTEXT_REQUIRED';
  END IF;

  SELECT borrowing_id, status INTO v_borrowing_id, v_item_status
  FROM public.borrowing_items
  WHERE id = NEW.borrowing_item_id
  FOR UPDATE;
  IF v_borrowing_id IS NULL OR v_item_status <> 'borrowed' THEN
    RAISE EXCEPTION 'RETURN_RECOVERY_ITEM_NOT_ACTIVE';
  END IF;

  -- The school has custody of the returned-but-damaged/missing item now. Keep
  -- the borrowing obligation open until the linked recovery case is completed.
  UPDATE public.borrowing_items
  SET status = 'pending_resolution',
      kondisi_kembali = NEW.condition,
      denda = NEW.charged_amount,
      tanggal_dikembalikan = NOW(),
      catatan = COALESCE(NEW.notes, catatan),
      updated_by = v_actor_id,
      updated_at = NOW()
  WHERE id = NEW.borrowing_item_id;

  UPDATE public.equipment
  SET status = 'maintenance',
      availability_status = 'maintenance'::availability_status,
      kondisi = NEW.condition,
      physical_condition = NEW.condition::physical_condition,
      asset_state = CASE WHEN NEW.condition = 'hilang' THEN 'lost' ELSE 'active' END,
      updated_at = NOW()
  WHERE id = NEW.equipment_id;

  v_recovery_type := CASE WHEN NEW.condition = 'hilang' THEN 'replacement' ELSE 'repair' END;
  PERFORM public.create_equipment_recovery_case_atomic(
    NEW.equipment_id,
    v_recovery_type,
    NEW.id,
    NEW.condition,
    COALESCE(NEW.notes, 'Tindak lanjut otomatis dari verifikasi pengembalian.'),
    v_actor_id,
    v_change_reason
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_open_return_recovery_case ON public.borrowing_return_assessment_items;
CREATE TRIGGER trg_open_return_recovery_case
AFTER INSERT ON public.borrowing_return_assessment_items
FOR EACH ROW EXECUTE FUNCTION public.open_return_recovery_case();

CREATE OR REPLACE FUNCTION public.guard_borrowing_return_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'returned' AND EXISTS (
    SELECT 1
    FROM public.borrowing_items
    WHERE borrowing_id = NEW.id
      AND status IN ('borrowed', 'pending_resolution')
  ) THEN
    NEW.status := CASE
      WHEN EXISTS (
        SELECT 1 FROM public.borrowing_return_reports
        WHERE borrowing_id = NEW.id AND status = 'pending_verification'
      ) THEN 'pending_verification'
      ELSE 'partial'
    END;
    NEW.returned_at := OLD.returned_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_borrowing_return_completion ON public.borrowings;
CREATE TRIGGER trg_guard_borrowing_return_completion
BEFORE UPDATE OF status ON public.borrowings
FOR EACH ROW EXECUTE FUNCTION public.guard_borrowing_return_completion();

CREATE OR REPLACE FUNCTION public.guard_return_report_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM NEW.status AND EXISTS (
    SELECT 1
    FROM public.borrowing_items
    WHERE borrowing_id = NEW.borrowing_id
      AND status IN ('borrowed', 'pending_resolution')
  ) THEN
    NEW.status := 'pending_verification';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_return_report_approval ON public.borrowing_return_reports;
CREATE TRIGGER trg_guard_return_report_approval
BEFORE UPDATE OF status ON public.borrowing_return_reports
FOR EACH ROW EXECUTE FUNCTION public.guard_return_report_approval();

CREATE OR REPLACE FUNCTION public.finish_borrowing_after_recovery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_borrowing_id UUID;
  v_item_status TEXT;
  v_remaining_count INTEGER;
  v_final_borrowing_status TEXT;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' OR NEW.assessment_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT assessment.borrowing_id, borrowing_item.status
  INTO v_borrowing_id, v_item_status
  FROM public.borrowing_return_assessment_items AS assessment_item
  JOIN public.borrowing_return_assessments AS assessment
    ON assessment.id = assessment_item.assessment_id
  JOIN public.borrowing_items AS borrowing_item
    ON borrowing_item.id = assessment_item.borrowing_item_id
  WHERE assessment_item.id = NEW.assessment_item_id
  FOR UPDATE OF borrowing_item;

  IF v_borrowing_id IS NULL OR v_item_status <> 'pending_resolution' THEN
    RETURN NEW;
  END IF;

  UPDATE public.borrowing_items
  SET status = 'returned',
      tanggal_dikembalikan = COALESCE(tanggal_dikembalikan, NOW()),
      updated_by = NEW.verified_by,
      updated_at = NOW()
  WHERE id = (
    SELECT borrowing_item_id
    FROM public.borrowing_return_assessment_items
    WHERE id = NEW.assessment_item_id
  );

  SELECT COUNT(*) INTO v_remaining_count
  FROM public.borrowing_items
  WHERE borrowing_id = v_borrowing_id
    AND status IN ('borrowed', 'pending_resolution');

  IF v_remaining_count = 0 THEN
    v_final_borrowing_status := 'returned';
  ELSIF EXISTS (
    SELECT 1 FROM public.borrowing_return_reports
    WHERE borrowing_id = v_borrowing_id AND status = 'pending_verification'
  ) THEN
    v_final_borrowing_status := 'pending_verification';
  ELSE
    v_final_borrowing_status := 'partial';
  END IF;

  UPDATE public.borrowings
  SET status = v_final_borrowing_status,
      returned_at = CASE WHEN v_final_borrowing_status = 'returned' THEN COALESCE(returned_at, NOW()) ELSE returned_at END,
      return_verified_at = CASE WHEN v_final_borrowing_status = 'returned' THEN NOW() ELSE return_verified_at END,
      return_verified_by = CASE WHEN v_final_borrowing_status = 'returned' THEN NEW.verified_by ELSE return_verified_by END,
      updated_by = NEW.verified_by,
      updated_at = NOW()
  WHERE id = v_borrowing_id;

  IF v_final_borrowing_status = 'returned' THEN
    UPDATE public.borrowing_return_reports AS report
    SET status = 'approved', verified_by = NEW.verified_by, verified_at = NOW(), updated_at = NOW()
    WHERE report.status = 'pending_verification'
      AND report.borrowing_id = v_borrowing_id;
  END IF;

  INSERT INTO public.activity_logs (user_id, action, table_name, record_id, new_values, change_reason)
  VALUES (
    NEW.verified_by,
    'UPDATE',
    'borrowings',
    v_borrowing_id,
    jsonb_build_object('status', v_final_borrowing_status, 'recovery_case_id', NEW.id, 'remaining_item_count', v_remaining_count),
    'SYSTEM:RETURN_RECOVERY_COMPLETED'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_finish_borrowing_after_recovery ON public.equipment_recovery_cases;
CREATE TRIGGER trg_finish_borrowing_after_recovery
AFTER UPDATE OF status ON public.equipment_recovery_cases
FOR EACH ROW EXECUTE FUNCTION public.finish_borrowing_after_recovery();

REVOKE ALL ON FUNCTION public.open_return_recovery_case() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_borrowing_return_completion() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_return_report_approval() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_borrowing_after_recovery() FROM PUBLIC, anon, authenticated;

INSERT INTO public.borrowing_migration_history (migration_name)
VALUES ('081_return_recovery_gate.sql')
ON CONFLICT (migration_name) DO NOTHING;

NOTIFY pgrst, 'reload schema';
COMMIT;
