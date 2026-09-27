-- Make the agenda facilitator optional so Humas can record student-led
-- activities without inventing an instructor. Agenda remains canonical.
BEGIN;

SELECT set_config('app.system_operation', 'true', true);
SELECT set_config('app.change_reason', 'SYSTEM:MIGRATION_084_AGENDA_OPTIONAL_INSTRUCTOR', true);

DO $$
BEGIN
  IF to_regclass('public.agenda_activities') IS NULL
     OR to_regprocedure('public.create_agenda_activity_atomic(date,text,text,text,text[],uuid,text,uuid,uuid,text)') IS NULL
     OR to_regprocedure('public.update_agenda_activity_atomic(uuid,date,text,text,text,text[],integer,text,uuid,text,uuid,uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'AGENDA_OPTIONAL_INSTRUCTOR_SCHEMA_MISSING';
  END IF;
END;
$$;

ALTER TABLE public.agenda_activities ALTER COLUMN instructor_name DROP NOT NULL;

-- Preserve the original security mode, search_path, owner, and EXECUTE grants
-- by editing only the two existing function bodies with CREATE OR REPLACE.
DO $$
DECLARE
  v_signature REGPROCEDURE;
  v_definition TEXT;
  v_rewritten TEXT;
  v_old TEXT;
  v_new TEXT;
BEGIN
  v_signature := to_regprocedure('public.create_agenda_activity_atomic(date,text,text,text,text[],uuid,text,uuid,uuid,text)');
  v_definition := pg_get_functiondef(v_signature);
  v_rewritten := v_definition;

  v_old := 'OR length(btrim(COALESCE(p_instructor_name, ''''))) NOT BETWEEN 2 AND 120';
  v_new := 'OR (NULLIF(btrim(COALESCE(p_instructor_name, '''')), '''') IS NOT NULL AND length(btrim(p_instructor_name)) NOT BETWEEN 2 AND 120)';
  IF strpos(v_rewritten, v_old) = 0 THEN RAISE EXCEPTION 'AGENDA_CREATE_INSTRUCTOR_VALIDATION_NOT_FOUND'; END IF;
  v_rewritten := replace(v_rewritten, v_old, v_new);
  v_old := 'p_activity_date, btrim(p_activity_name), btrim(p_activity_description), btrim(p_instructor_name), p_pic_names';
  v_new := 'p_activity_date, btrim(p_activity_name), btrim(p_activity_description), NULLIF(btrim(p_instructor_name), ''''), p_pic_names';
  IF strpos(v_rewritten, v_old) = 0 THEN RAISE EXCEPTION 'AGENDA_CREATE_INSTRUCTOR_VALUE_NOT_FOUND'; END IF;
  v_rewritten := replace(v_rewritten, v_old, v_new);
  EXECUTE v_rewritten;

  v_signature := to_regprocedure('public.update_agenda_activity_atomic(uuid,date,text,text,text,text[],integer,text,uuid,text,uuid,uuid,text)');
  v_definition := pg_get_functiondef(v_signature);
  v_rewritten := v_definition;
  v_old := 'OR length(btrim(COALESCE(p_instructor_name, ''''))) NOT BETWEEN 2 AND 120';
  v_new := 'OR (NULLIF(btrim(COALESCE(p_instructor_name, '''')), '''') IS NOT NULL AND length(btrim(p_instructor_name)) NOT BETWEEN 2 AND 120)';
  IF strpos(v_rewritten, v_old) = 0 THEN RAISE EXCEPTION 'AGENDA_UPDATE_INSTRUCTOR_VALIDATION_NOT_FOUND'; END IF;
  v_rewritten := replace(v_rewritten, v_old, v_new);
  v_old := 'instructor_name = btrim(p_instructor_name)';
  v_new := 'instructor_name = NULLIF(btrim(p_instructor_name), '''')';
  IF strpos(v_rewritten, v_old) = 0 THEN RAISE EXCEPTION 'AGENDA_UPDATE_INSTRUCTOR_VALUE_NOT_FOUND'; END IF;
  v_rewritten := replace(v_rewritten, v_old, v_new);
  EXECUTE v_rewritten;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
