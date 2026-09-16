BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.record_equipment_charge_payment_event_atomic(uuid,numeric,uuid[],text,uuid,text)') IS NULL
     OR to_regprocedure('public.finalize_contest_entry_atomic(uuid,text,jsonb,uuid,text,uuid,text,uuid,uuid,text)') IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'MIGRATION_PREFLIGHT_FAILED: canonical evidence-backed mutation functions are missing';
  END IF;
END;
$$;

-- Keep the old signatures upgradeable, but make them non-mutating. All writes
-- must go through the evidence-backed, idempotent operations introduced by
-- migrations 053 and 064.
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
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = 'P0001',
    MESSAGE = 'CHARGE_PAYMENT_LEGACY_DISABLED';
END;
$$;

CREATE OR REPLACE FUNCTION public.record_contest_entry_result_atomic(
  p_entry_id UUID,
  p_outcome_status TEXT,
  p_results JSONB,
  p_change_reason TEXT,
  p_actor_id UUID,
  p_idempotency_key TEXT,
  p_evidence_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = 'P0001',
    MESSAGE = 'CONTEST_RESULT_LEGACY_DISABLED';
END;
$$;

-- No API role may execute a mutating legacy RPC. The canonical endpoints call
-- record_equipment_charge_payment_event_atomic and finalize_contest_entry_atomic.
REVOKE ALL ON FUNCTION public.record_equipment_charge_payment_atomic(
  UUID, NUMERIC, TEXT, TEXT, UUID, TEXT
) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.record_contest_entry_result_atomic(
  UUID, TEXT, JSONB, TEXT, UUID, TEXT, TEXT
) FROM PUBLIC, anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
