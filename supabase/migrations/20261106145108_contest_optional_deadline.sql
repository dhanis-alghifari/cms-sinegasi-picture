-- Historical contests do not always have a registration deadline.
ALTER TABLE public.contests ALTER COLUMN tanggal_lomba DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_contest_deadline_future()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_validate boolean := false;
  v_deadline date := COALESCE(NEW.deadline, NEW.tanggal, NEW.tanggal_lomba);
BEGIN
  IF NEW.status_public = 'buka' THEN
    IF TG_OP = 'INSERT' THEN
      v_validate := true;
    ELSE
      v_validate := NEW.status_public IS DISTINCT FROM OLD.status_public
        OR NEW.deadline IS DISTINCT FROM OLD.deadline
        OR NEW.tanggal IS DISTINCT FROM OLD.tanggal
        OR NEW.tanggal_lomba IS DISTINCT FROM OLD.tanggal_lomba;
    END IF;

    IF v_validate AND (v_deadline IS NULL OR v_deadline < (now() AT TIME ZONE 'Asia/Jakarta')::date) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CONTEST_DEADLINE_MUST_BE_TODAY_OR_LATER';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

NOTIFY pgrst, 'reload schema';
