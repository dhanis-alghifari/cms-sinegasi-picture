-- 015_borrowing_notifications_hardening.sql
-- Notifikasi lifecycle peminjaman: pengajuan, keputusan, serah-terima,
-- pengembalian, dan deduplikasi event.

-- Pastikan enum tersedia di schema yang dipakai function di bawah.
-- Ini menangani database yang belum menjalankan migration 003 atau pernah
-- membuat tabel notifications secara parsial.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'notification_type'
  ) THEN
    CREATE TYPE public.notification_type AS ENUM (
      'attendance_correction',
      'grade_posted',
      'grade_correction',
      'borrowing_approved',
      'borrowing_rejected',
      'borrowing_overdue',
      'cash_deducted',
      'cash_dispute_response',
      'contest_assigned',
      'system_alert',
      'password_reset'
    );
  END IF;
END
$$;

-- Tabel notifications bisa sudah terlanjur dibuat oleh schema lama/parsial.
-- CREATE TABLE IF NOT EXISTS tidak menambahkan kolom ke tabel yang sudah ada.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::JSONB;

-- Schema lama bisa memakai nama kolom `message`, sedangkan backend dan
-- migration resmi memakai `body`. Tambahkan kontrak `body` tanpa menghapus
-- data lama, lalu salin nilainya bila kolom `message` tersedia.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS body TEXT NOT NULL DEFAULT '';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'notifications'
      AND column_name = 'message'
  ) THEN
    EXECUTE $sql$
      UPDATE public.notifications
      SET body = COALESCE(NULLIF(body, ''), message)
      WHERE body IS NULL OR body = ''
    $sql$;
  END IF;
END
$$;

UPDATE public.notifications
SET body = ''
WHERE body IS NULL;

ALTER TABLE public.notifications
  ALTER COLUMN body SET DEFAULT '',
  ALTER COLUMN body SET NOT NULL;

-- Database lama mewajibkan `message`, sedangkan schema resmi memakai `body`.
-- Pertahankan kompatibilitas dengan menyediakan dan mengisi keduanya.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS message TEXT;

DO $$
BEGIN
  EXECUTE $sql$
    UPDATE public.notifications
    SET message = COALESCE(NULLIF(message, ''), body)
    WHERE message IS NULL OR message = ''
  $sql$;
END
$$;

UPDATE public.notifications
SET message = ''
WHERE message IS NULL;

ALTER TABLE public.notifications
  ALTER COLUMN message SET DEFAULT '',
  ALTER COLUMN message SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_borrowing_event
  ON public.notifications ((metadata->>'event_key'))
  WHERE metadata ? 'event_key' AND NULLIF(metadata->>'event_key', '') IS NOT NULL;

CREATE OR REPLACE FUNCTION public.notify_borrowing_recipients(
  p_borrowing_id UUID,
  p_event TEXT,
  p_type public.notification_type,
  p_title TEXT,
  p_body TEXT,
  p_recipient_ids UUID[],
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_event_key TEXT;
BEGIN
  IF p_recipient_ids IS NULL THEN
    RETURN;
  END IF;

  FOREACH v_user_id IN ARRAY p_recipient_ids
  LOOP
    IF v_user_id IS NULL THEN
      CONTINUE;
    END IF;

    v_event_key := p_borrowing_id::TEXT || ':' || p_event || ':' || v_user_id::TEXT;

    INSERT INTO public.notifications (user_id, type, title, body, message, is_read, metadata)
    VALUES (
      v_user_id,
      p_type,
      p_title,
      p_body,
      p_body,
      FALSE,
      COALESCE(p_metadata, '{}'::JSONB) || jsonb_build_object(
        'borrowing_id', p_borrowing_id,
        'event_key', v_event_key,
        'link_url', '/borrowing'
      )
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_borrowing_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_user_id UUID;
  v_student_name TEXT;
  v_equipment_names TEXT;
  v_teacher_ids UUID[];
  v_metadata JSONB;
BEGIN
  SELECT s.user_id, s.nama
  INTO v_student_user_id, v_student_name
  FROM public.students s
  WHERE s.id = NEW.student_id;

  SELECT COALESCE(string_agg(e.nama_alat, ', ' ORDER BY e.nama_alat), 'alat yang dipilih')
  INTO v_equipment_names
  FROM public.borrowing_items bi
  JOIN public.equipment e ON e.id = bi.equipment_id
  WHERE bi.borrowing_id = NEW.id;

  v_metadata := jsonb_build_object(
    'student_id', NEW.student_id,
    'equipment', v_equipment_names,
    'due_at', NEW.due_at
  );

  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    SELECT COALESCE(array_agg(u.id), ARRAY[]::UUID[])
    INTO v_teacher_ids
    FROM public.users u
    WHERE u.role::TEXT = 'teacher' AND u.is_active = TRUE;

    PERFORM public.notify_borrowing_recipients(
      NEW.id,
      'submitted',
      'system_alert',
      '📦 Peminjaman Baru Menunggu Persetujuan',
      format('Pengajuan peminjaman dari %s menunggu persetujuan Guru.', COALESCE(v_student_name, 'siswa')),
      v_teacher_ids,
      v_metadata
    );

    IF v_student_user_id IS NOT NULL THEN
      PERFORM public.notify_borrowing_recipients(
        NEW.id,
        'submitted',
        'system_alert',
        '📨 Pengajuan Peminjaman Diterima',
        'Pengajuan peminjaman Anda sudah tercatat dan sedang menunggu persetujuan Guru.',
        ARRAY[v_student_user_id],
        v_metadata
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND v_student_user_id IS NOT NULL THEN
    IF NEW.status = 'approved' THEN
      PERFORM public.notify_borrowing_recipients(
        NEW.id,
        'approved',
        'borrowing_approved',
        '✅ Peminjaman Alat Disetujui',
        format('Peminjaman %s telah disetujui Guru. Batas pengembalian: %s.', v_equipment_names, COALESCE(NEW.rencana_kembali::TEXT, NEW.due_at::DATE::TEXT, '-')),
        ARRAY[v_student_user_id],
        v_metadata
      );
    ELSIF NEW.status = 'rejected' THEN
      PERFORM public.notify_borrowing_recipients(
        NEW.id,
        'rejected',
        'borrowing_rejected',
        '❌ Peminjaman Alat Ditolak',
        format('Pengajuan peminjaman %s ditolak. Lihat catatan keputusan untuk detailnya.', v_equipment_names),
        ARRAY[v_student_user_id],
        v_metadata
      );
    ELSIF NEW.status = 'borrowed' THEN
      PERFORM public.notify_borrowing_recipients(
        NEW.id,
        'handover',
        'system_alert',
        '🤝 Alat Berhasil Diserahkan',
        format('%s telah diserahkan dan tercatat sebagai alat yang sedang Anda pinjam.', v_equipment_names),
        ARRAY[v_student_user_id],
        v_metadata
      );
    ELSIF NEW.status = 'returned' THEN
      PERFORM public.notify_borrowing_recipients(
        NEW.id,
        'returned',
        'system_alert',
        '↩️ Pengembalian Alat Tercatat',
        format('Pengembalian %s telah dicatat oleh petugas.', v_equipment_names),
        ARRAY[v_student_user_id],
        v_metadata
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_borrowing_status_notification ON public.borrowings;
CREATE TRIGGER trg_borrowing_status_notification
  AFTER INSERT OR UPDATE OF status ON public.borrowings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_borrowing_status_change();

-- Overdue notification sekarang menjadi tanggung jawab worker Supabase-backed
-- agar penerima (siswa dan Guru/Ketua) serta deduplikasi event konsisten.
DROP TRIGGER IF EXISTS trg_borrowing_overdue ON public.borrowings;

-- Pengajuan yang sudah tersimpan sebelum migration ini tetap diberi notifikasi
-- satu kali agar tidak hilang dari approval inbox Guru.
DO $$
DECLARE
  v_borrowing RECORD;
  v_teacher_ids UUID[];
  v_student_user_id UUID;
BEGIN
  SELECT COALESCE(array_agg(u.id), ARRAY[]::UUID[])
  INTO v_teacher_ids
  FROM public.users u
  WHERE u.role::TEXT = 'teacher' AND u.is_active = TRUE;

  FOR v_borrowing IN
    SELECT b.id, b.student_id, b.due_at, s.nama, s.user_id
    FROM public.borrowings b
    LEFT JOIN public.students s ON s.id = b.student_id
    WHERE b.status = 'pending'
  LOOP
    PERFORM public.notify_borrowing_recipients(
      v_borrowing.id,
      'submitted',
      'system_alert',
      '📦 Peminjaman Baru Menunggu Persetujuan',
      format('Pengajuan peminjaman dari %s menunggu persetujuan Guru.', COALESCE(v_borrowing.nama, 'siswa')),
      v_teacher_ids,
      jsonb_build_object('student_id', v_borrowing.student_id, 'due_at', v_borrowing.due_at)
    );

    v_student_user_id := v_borrowing.user_id;
    IF v_student_user_id IS NOT NULL THEN
      PERFORM public.notify_borrowing_recipients(
        v_borrowing.id,
        'submitted',
        'system_alert',
        '📨 Pengajuan Peminjaman Diterima',
        'Pengajuan peminjaman Anda sudah tercatat dan sedang menunggu persetujuan Guru.',
        ARRAY[v_student_user_id],
        jsonb_build_object('student_id', v_borrowing.student_id, 'due_at', v_borrowing.due_at)
      );
    END IF;
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
