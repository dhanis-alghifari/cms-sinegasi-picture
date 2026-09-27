BEGIN;

-- Migration 076 deliberately removed `treasurer` from student-account roles.
-- Rebuild only the affected clauses from PostgreSQL's stored function source
-- so the existing transaction, validation, SECURITY DEFINER/INVOKER,
-- search_path, ownership, and execute grants remain unchanged.
DO $$
DECLARE
  v_target RECORD;
  v_signature REGPROCEDURE;
  v_definition TEXT;
  v_rewritten TEXT;
  v_occurrences INTEGER;
  v_is_definer BOOLEAN;
  v_service_execute BOOLEAN;
  v_anon_execute BOOLEAN;
  v_authenticated_execute BOOLEAN;
BEGIN
  FOR v_target IN
    SELECT *
    FROM (VALUES
      (
        'public.create_student_with_account_atomic(text, text, text, text, text, text, text, text, uuid, text)',
        $old$IF v_role NOT IN ('leader', 'vice_leader', 'secretary', 'equipment_team', 'contest_team', 'member')$old$,
        $new$IF v_role NOT IN ('leader', 'vice_leader', 'secretary', 'treasurer', 'equipment_team', 'contest_team', 'member')$new$,
        TRUE, TRUE
      ),
      (
        'public.enforce_user_role_account_boundary()',
        $old$NEW.role::TEXT NOT IN ('leader', 'vice_leader', 'secretary', 'equipment_team', 'contest_team', 'member')$old$,
        $new$NEW.role::TEXT NOT IN ('leader', 'vice_leader', 'secretary', 'treasurer', 'equipment_team', 'contest_team', 'member')$new$,
        FALSE, FALSE
      ),
      (
        'public.list_unlinked_student_accounts(text, integer, uuid)',
        $old$u.role::TEXT IN ('leader', 'vice_leader', 'secretary', 'equipment_team', 'contest_team', 'member')$old$,
        $new$u.role::TEXT IN ('leader', 'vice_leader', 'secretary', 'treasurer', 'equipment_team', 'contest_team', 'member')$new$,
        FALSE, TRUE
      ),
      (
        'public.link_existing_student_account_atomic(uuid, text, text, text, text, text, text, uuid, text)',
        $old$v_target.role::TEXT NOT IN ('leader', 'vice_leader', 'secretary', 'equipment_team', 'contest_team', 'member')$old$,
        $new$v_target.role::TEXT NOT IN ('leader', 'vice_leader', 'secretary', 'treasurer', 'equipment_team', 'contest_team', 'member')$new$,
        TRUE, TRUE
      ),
      (
        'public.link_account_to_existing_student_atomic(uuid, uuid, uuid, text)',
        $old$v_target.role::TEXT NOT IN ('leader', 'vice_leader', 'secretary', 'equipment_team', 'contest_team', 'member')$old$,
        $new$v_target.role::TEXT NOT IN ('leader', 'vice_leader', 'secretary', 'treasurer', 'equipment_team', 'contest_team', 'member')$new$,
        TRUE, TRUE
      )
    ) AS changes(signature, old_clause, new_clause, expects_definer, expects_service_execute)
  LOOP
    v_signature := pg_catalog.to_regprocedure(v_target.signature);
    IF v_signature IS NULL THEN
      RAISE EXCEPTION 'STUDENT_TREASURER_FUNCTION_MISSING: %', v_target.signature;
    END IF;

    v_definition := pg_catalog.pg_get_functiondef(v_signature::OID);
    v_occurrences := (
      pg_catalog.length(v_definition)
      - pg_catalog.length(pg_catalog.replace(v_definition, v_target.old_clause, ''))
    ) / pg_catalog.length(v_target.old_clause);
    IF v_occurrences <> 1 THEN
      RAISE EXCEPTION 'STUDENT_TREASURER_EXPECTED_ONE_ROLE_CHECK: %', v_target.signature;
    END IF;

    v_rewritten := pg_catalog.replace(v_definition, v_target.old_clause, v_target.new_clause);
    EXECUTE v_rewritten;

    v_definition := pg_catalog.pg_get_functiondef(v_signature::OID);
    IF pg_catalog.strpos(v_definition, v_target.new_clause) = 0
       OR pg_catalog.strpos(v_definition, v_target.old_clause) > 0 THEN
      RAISE EXCEPTION 'STUDENT_TREASURER_ROLE_CHECK_UPDATE_FAILED: %', v_target.signature;
    END IF;

    SELECT
      proc.prosecdef,
      pg_catalog.has_function_privilege('service_role', proc.oid, 'EXECUTE'),
      pg_catalog.has_function_privilege('anon', proc.oid, 'EXECUTE'),
      pg_catalog.has_function_privilege('authenticated', proc.oid, 'EXECUTE')
    INTO v_is_definer, v_service_execute, v_anon_execute, v_authenticated_execute
    FROM pg_catalog.pg_proc AS proc
    WHERE proc.oid = v_signature::OID;

    IF v_is_definer IS DISTINCT FROM v_target.expects_definer
       OR v_service_execute IS DISTINCT FROM v_target.expects_service_execute
       OR v_anon_execute IS DISTINCT FROM FALSE
       OR v_authenticated_execute IS DISTINCT FROM FALSE THEN
      RAISE EXCEPTION 'STUDENT_TREASURER_FUNCTION_SECURITY_CHANGED: %', v_target.signature;
    END IF;
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
