-- 071_cash_personal_scope_and_teacher_dispute_review.sql
-- Gives every student-backed committee role a personal cash ledger and makes
-- dispute review a teacher-only operation. Existing cash management rights
-- remain unchanged.

BEGIN;

SELECT set_config('app.system_operation', 'true', true);
SELECT set_config('app.change_reason', 'SYSTEM:MIGRATION_071_CASH_PERSONAL_SCOPE', true);

DO $$
BEGIN
  IF to_regclass('public.cash_disputes') IS NULL
     OR to_regclass('public.students') IS NULL
     OR to_regclass('public.users') IS NULL
     OR to_regclass('public.access_permissions') IS NULL
     OR to_regclass('public.access_roles') IS NULL
     OR to_regclass('public.access_role_permissions') IS NULL THEN
    RAISE EXCEPTION 'CASH_PERSONAL_SCOPE_SCHEMA_MISSING';
  END IF;
END;
$$;

INSERT INTO public.access_permissions (permission_key, label)
VALUES
  ('cash.read.own', 'Cash Read Own'),
  ('cash.dispute.create', 'Cash Dispute Create'),
  ('cash.dispute.read.own', 'Cash Dispute Read Own'),
  ('cash.dispute.review', 'Cash Dispute Review')
ON CONFLICT (permission_key) DO UPDATE SET label = EXCLUDED.label;

INSERT INTO public.access_role_permissions (role_key, permission_key)
SELECT role_key, permission_key
FROM public.access_roles
CROSS JOIN (VALUES ('cash.read.own'), ('cash.dispute.create'), ('cash.dispute.read.own')) AS permissions(permission_key)
WHERE role_key IN ('leader', 'vice_leader', 'secretary', 'treasurer', 'equipment_team', 'contest_team', 'member')
ON CONFLICT DO NOTHING;

INSERT INTO public.access_role_permissions (role_key, permission_key)
VALUES ('teacher', 'cash.dispute.review')
ON CONFLICT DO NOTHING;

-- Teacher reviews the queue; the treasurer can manage ledger entries but must
-- not decide whether a student's objection is valid.
DELETE FROM public.access_role_permissions
WHERE role_key = 'treasurer' AND permission_key = 'cash.dispute.review';
DELETE FROM public.access_role_permissions
WHERE role_key = 'teacher' AND permission_key IN ('cash.read.own', 'cash.dispute.create', 'cash.dispute.read.own');

CREATE OR REPLACE FUNCTION public.guard_cash_dispute_actor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.created_by IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.users u ON u.id = s.user_id
    WHERE s.id = NEW.student_id
      AND s.user_id = NEW.created_by
      AND s.is_active = TRUE
      AND u.is_active = TRUE
      AND u.role::TEXT <> 'teacher'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_TARGET_FORBIDDEN';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_cash_dispute_reviewer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status
     AND (NEW.resolved_by IS NULL OR NOT EXISTS (
       SELECT 1 FROM public.users
       WHERE id = NEW.resolved_by AND is_active = TRUE AND role::TEXT = 'teacher'
     )) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DISPUTE_REVIEWER_INVALID';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_cash_dispute_actor ON public.cash_disputes;
CREATE TRIGGER trg_guard_cash_dispute_actor
  BEFORE INSERT ON public.cash_disputes
  FOR EACH ROW EXECUTE FUNCTION public.guard_cash_dispute_actor();

DROP TRIGGER IF EXISTS trg_guard_cash_dispute_reviewer ON public.cash_disputes;
CREATE TRIGGER trg_guard_cash_dispute_reviewer
  BEFORE UPDATE OF status ON public.cash_disputes
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.guard_cash_dispute_reviewer();

CREATE OR REPLACE FUNCTION public.fn_notify_cash_dispute()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_student_user_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, type, title, body, message, is_read, metadata)
    SELECT u.id, 'cash_dispute_response'::notification_type,
      'Sanggahan kas baru',
      'Ada laporan sanggahan kas baru yang perlu diperiksa guru.',
      'Ada laporan sanggahan kas baru yang perlu diperiksa guru.',
      FALSE,
      jsonb_build_object('dispute_id', NEW.id, 'student_id', NEW.student_id, 'attempt_number', NEW.attempt_number)
    FROM public.users u
    WHERE u.is_active = TRUE AND u.role::TEXT = 'teacher';
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT s.user_id INTO v_student_user_id FROM public.students s WHERE s.id = NEW.student_id;
    IF v_student_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, message, is_read, metadata)
      VALUES (
        v_student_user_id,
        'cash_dispute_response'::notification_type,
        CASE WHEN NEW.status = 'approved' THEN 'Sanggahan kas disetujui' ELSE 'Sanggahan kas ditolak' END,
        CASE WHEN NEW.status = 'approved' THEN 'Bukti pembayaran Anda telah diverifikasi.' ELSE 'Sanggahan kas Anda ditolak. Periksa catatan reviewer sebelum mengajukan ulang.' END,
        CASE WHEN NEW.status = 'approved' THEN 'Bukti pembayaran Anda telah diverifikasi.' ELSE 'Sanggahan kas Anda ditolak. Periksa catatan reviewer sebelum mengajukan ulang.' END,
        FALSE,
        jsonb_build_object('dispute_id', NEW.id, 'status', NEW.status, 'attempt_number', NEW.attempt_number, 'review_note', NEW.review_note)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_cash_dispute_actor() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_cash_dispute_reviewer() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_cash_dispute_actor() TO service_role;
GRANT EXECUTE ON FUNCTION public.guard_cash_dispute_reviewer() TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
