-- 042_member_dashboard_disputes.sql
-- Member read scopes and auditable cash-dispute notifications.
-- Additive and safe to re-run.

BEGIN;

ALTER TABLE public.cash_disputes
  ADD COLUMN IF NOT EXISTS debt_record_id UUID REFERENCES public.debt_records(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_disputes_debt_record
  ON public.cash_disputes(debt_record_id)
  WHERE debt_record_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cash_disputes_debt_record
  ON public.cash_disputes(debt_record_id);

INSERT INTO public.access_permissions (permission_key, label)
SELECT permission_key, initcap(replace(permission_key, '.', ' '))
FROM unnest(ARRAY[
  'attendance.read.own',
  'cash.read.own',
  'cash.dispute.create',
  'cash.dispute.read.own',
  'cash.dispute.review'
]::TEXT[]) AS permission(permission_key)
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO public.access_role_permissions (role_key, permission_key)
SELECT role_key, permission_key
FROM (VALUES
  ('teacher', 'attendance.read.own'), ('teacher', 'cash.read.own'),
  ('teacher', 'cash.dispute.create'), ('teacher', 'cash.dispute.read.own'), ('teacher', 'cash.dispute.review'),
  ('treasurer', 'cash.read.own'), ('treasurer', 'cash.dispute.create'), ('treasurer', 'cash.dispute.review'),
  ('member', 'attendance.read.own'), ('member', 'cash.read.own'),
  ('member', 'cash.dispute.create'), ('member', 'cash.dispute.read.own')
) AS assignment(role_key, permission_key)
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_cash_disputes_student_created
  ON public.cash_disputes (student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_disputes_status_created
  ON public.cash_disputes (status, created_at DESC);

-- Legacy deployments may have both notification text columns. Keep the
-- compatibility column available before the trigger is created.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS message TEXT;
UPDATE public.notifications
SET message = COALESCE(NULLIF(message, ''), body, '')
WHERE message IS NULL OR message = '';
ALTER TABLE public.notifications
  ALTER COLUMN message SET DEFAULT '',
  ALTER COLUMN message SET NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_notify_cash_dispute()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_user_id UUID;
  v_actor RECORD;
BEGIN
  IF TG_OP = 'INSERT' THEN
    FOR v_actor IN
      SELECT id FROM public.users
      WHERE is_active = TRUE AND role IN ('teacher'::user_role, 'treasurer'::user_role)
    LOOP
      INSERT INTO public.notifications (user_id, type, title, body, message, is_read, metadata)
      VALUES (
        v_actor.id,
        'cash_dispute_response'::notification_type,
        'Sanggahan kas baru',
        'Ada laporan sanggahan kas baru yang perlu diperiksa.',
        'Ada laporan sanggahan kas baru yang perlu diperiksa.',
        FALSE,
        jsonb_build_object('dispute_id', NEW.id, 'student_id', NEW.student_id)
      );
    END LOOP;
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT user_id INTO v_student_user_id FROM public.students WHERE id = NEW.student_id;
    IF v_student_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, message, is_read, metadata)
      VALUES (
        v_student_user_id,
        'cash_dispute_response'::notification_type,
        CASE WHEN NEW.status = 'approved' THEN 'Sanggahan kas disetujui' ELSE 'Sanggahan kas ditolak' END,
        CASE WHEN NEW.status = 'approved' THEN 'Bukti pembayaran Anda telah diverifikasi.' ELSE 'Sanggahan kas Anda ditolak. Silakan cek catatan dan hubungi bendahara.' END,
        CASE WHEN NEW.status = 'approved' THEN 'Bukti pembayaran Anda telah diverifikasi.' ELSE 'Sanggahan kas Anda ditolak. Silakan cek catatan dan hubungi bendahara.' END,
        FALSE,
        jsonb_build_object('dispute_id', NEW.id, 'status', NEW.status)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cash_dispute_notify ON public.cash_disputes;
CREATE TRIGGER trg_cash_dispute_notify
  AFTER INSERT OR UPDATE OF status ON public.cash_disputes
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_cash_dispute();

NOTIFY pgrst, 'reload schema';
COMMIT;
