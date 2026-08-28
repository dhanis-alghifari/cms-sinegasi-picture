-- 045_cash_dispute_schema_compatibility.sql
-- Align the legacy cash-dispute schema with debt-record disputes and the
-- canonical backend contract. This migration is idempotent and is executed
-- inside applyCashMigration's transaction.

-- A dispute can target either a cash transaction or a debt record. Legacy
-- deployments required transaction_id even after 042 introduced debt_record_id.
ALTER TABLE public.cash_disputes
  ADD COLUMN IF NOT EXISTS debt_record_id UUID REFERENCES public.debt_records(id) ON DELETE CASCADE,
  ALTER COLUMN transaction_id DROP NOT NULL,
  ALTER COLUMN alasan_sanggahan DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_disputes_debt_record
  ON public.cash_disputes(debt_record_id)
  WHERE debt_record_id IS NOT NULL;

-- Keep legacy resolved rows readable while making approved the canonical
-- status written by the API. Historical rows are normalized without sending
-- notifications through the dispute trigger.
ALTER TABLE public.cash_disputes
  DROP CONSTRAINT IF EXISTS cash_disputes_status_check;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.cash_disputes'::regclass
      AND tgname = 'trg_cash_dispute_notify'
      AND NOT tgisinternal
  ) THEN
    ALTER TABLE public.cash_disputes DISABLE TRIGGER trg_cash_dispute_notify;
  END IF;
END
$$;

UPDATE public.cash_disputes
SET status = 'approved'
WHERE status = 'resolved';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.cash_disputes'::regclass
      AND tgname = 'trg_cash_dispute_notify'
      AND NOT tgisinternal
  ) THEN
    ALTER TABLE public.cash_disputes ENABLE TRIGGER trg_cash_dispute_notify;
  END IF;
END
$$;

ALTER TABLE public.cash_disputes
  ADD CONSTRAINT cash_disputes_status_check
  CHECK (status IN ('pending', 'approved', 'rejected'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.cash_disputes'::regclass
      AND conname = 'cash_disputes_exactly_one_target_check'
  ) THEN
    ALTER TABLE public.cash_disputes
      ADD CONSTRAINT cash_disputes_exactly_one_target_check
      CHECK ((transaction_id IS NOT NULL) <> (debt_record_id IS NOT NULL));
  END IF;
END
$$;

-- Notifications have two names in deployed schemas. Keep both populated so
-- old readers and the canonical body-based reader remain compatible.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS message TEXT;

UPDATE public.notifications
SET body = COALESCE(NULLIF(body, ''), NULLIF(message, ''), ''),
    message = COALESCE(NULLIF(message, ''), NULLIF(body, ''), '');

ALTER TABLE public.notifications
  ALTER COLUMN body SET DEFAULT '',
  ALTER COLUMN body SET NOT NULL,
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

NOTIFY pgrst, 'reload schema';
