BEGIN;

-- Purges only an inactive student's school records. Financial entries that
-- represent money received or spent remain in the cash ledger.
CREATE OR REPLACE FUNCTION public.purge_student_history_atomic(
  p_student_id UUID,
  p_actor_id UUID,
  p_change_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_student public.students%ROWTYPE;
  v_actor_allowed BOOLEAN;
  v_user_id UUID;
  v_deleted_user BOOLEAN := FALSE;
  v_account_deactivated BOOLEAN := FALSE;
  v_deleted_attendance BIGINT := 0;
  v_deleted_debt_records BIGINT := 0;
  v_deleted_billing_transactions BIGINT := 0;
  v_deleted_equipment_charges BIGINT := 0;
  v_preserved_cash_transactions BIGINT := 0;
BEGIN
  IF p_student_id IS NULL OR p_actor_id IS NULL THEN
    RAISE EXCEPTION 'STUDENT_PURGE_ACTOR_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_change_reason IS NULL OR CHAR_LENGTH(BTRIM(p_change_reason)) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION 'STUDENT_PURGE_REASON_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.users AS u
    JOIN public.access_role_permissions AS rp ON rp.role_key = u.role::TEXT
    WHERE u.id = p_actor_id
      AND u.is_active IS TRUE
      AND rp.permission_key = 'users.manage'
  ) INTO v_actor_allowed;
  IF v_actor_allowed IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'STUDENT_PURGE_ACTOR_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_student
  FROM public.students
  WHERE id = p_student_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STUDENT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_student.is_active IS TRUE THEN
    RAISE EXCEPTION 'STUDENT_PURGE_ACTIVE' USING ERRCODE = 'P0001';
  END IF;

  v_user_id := v_student.user_id;
  SELECT COUNT(*) INTO v_deleted_attendance FROM public.attendance WHERE student_id = p_student_id;
  SELECT COUNT(*) INTO v_deleted_debt_records FROM public.debt_records WHERE student_id = p_student_id;
  SELECT COUNT(*) INTO v_deleted_billing_transactions
  FROM public.cash_transactions
  WHERE student_id = p_student_id AND COALESCE(is_billing, FALSE) IS TRUE;
  SELECT COUNT(*) INTO v_deleted_equipment_charges
  FROM public.equipment_charge_settlements
  WHERE student_id = p_student_id;
  SELECT COUNT(*) INTO v_preserved_cash_transactions
  FROM public.cash_transactions
  WHERE student_id = p_student_id AND COALESCE(is_billing, FALSE) IS FALSE;

  -- Billing rows are receivables, not money movement. Remove them with the
  -- student's debt records; keep and detach real cash movements below.
  DELETE FROM public.cash_transactions
  WHERE student_id = p_student_id AND COALESCE(is_billing, FALSE) IS TRUE;
  DELETE FROM public.debt_records WHERE student_id = p_student_id;
  DELETE FROM public.equipment_charge_settlements WHERE student_id = p_student_id;

  -- ON DELETE behaviour differs between legacy deployments. Explicitly detach
  -- real cash movements so this purge can never change cashflow or saldo.
  UPDATE public.cash_transactions
  SET student_id = NULL
  WHERE student_id = p_student_id AND COALESCE(is_billing, FALSE) IS FALSE;

  DELETE FROM public.students WHERE id = p_student_id;

  IF v_user_id IS NOT NULL THEN
    BEGIN
      DELETE FROM public.users WHERE id = v_user_id;
      v_deleted_user := TRUE;
    EXCEPTION
      WHEN foreign_key_violation THEN
        UPDATE public.users
        SET is_active = FALSE, updated_by = p_actor_id, updated_at = NOW()
        WHERE id = v_user_id;
        v_account_deactivated := TRUE;
      WHEN OTHERS THEN
        IF SQLERRM LIKE '%activity_logs bersifat immutable%' THEN
          UPDATE public.users
          SET is_active = FALSE, updated_by = p_actor_id, updated_at = NOW()
          WHERE id = v_user_id;
          v_account_deactivated := TRUE;
        ELSE
          RAISE;
        END IF;
    END;
  END IF;

  RETURN jsonb_build_object(
    'student_id', p_student_id,
    'user_id', v_user_id,
    'deleted_user', v_deleted_user,
    'account_deactivated', v_account_deactivated,
    'deleted_attendance', v_deleted_attendance,
    'deleted_debt_records', v_deleted_debt_records,
    'deleted_billing_transactions', v_deleted_billing_transactions,
    'deleted_equipment_charges', v_deleted_equipment_charges,
    'preserved_cash_transactions', v_preserved_cash_transactions
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purge_student_history_atomic(UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_student_history_atomic(UUID, UUID, TEXT)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
