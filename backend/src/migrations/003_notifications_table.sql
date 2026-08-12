-- ==========================================
-- 003_notifications_table.sql
-- Tabel Notifikasi & Trigger Push Notification
-- ==========================================

-- Notification type enum
DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM (
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
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Main notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Trigger: Auto-notify all active users when a new system_alert is broadcast
CREATE OR REPLACE FUNCTION fn_broadcast_system_alert()
RETURNS TRIGGER AS $$
DECLARE
  v_user RECORD;
BEGIN
  IF NEW.type = 'system_alert' AND NEW.user_id IS NULL THEN
    FOR v_user IN SELECT id FROM users WHERE is_active = true LOOP
      INSERT INTO notifications (user_id, type, title, body, metadata)
      VALUES (v_user.id, NEW.type, NEW.title, NEW.body, NEW.metadata);
    END LOOP;
    RETURN NULL; -- Skip original row, we inserted individually
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-create overdue notification when borrowing.due_at has passed
CREATE OR REPLACE FUNCTION fn_notify_borrowing_overdue()
RETURNS TRIGGER AS $$
DECLARE
  v_student RECORD;
BEGIN
  -- Only trigger if still 'borrowed' and due_at has just passed
  IF OLD.status = 'borrowed' AND NEW.status = 'borrowed' AND NEW.due_at < NOW() THEN
    SELECT s.user_id, s.nama INTO v_student
    FROM students s
    WHERE s.id = NEW.student_id;

    IF v_student.user_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, body, metadata)
      VALUES (
        v_student.user_id,
        'borrowing_overdue',
        '⚠️ Alat Pinjaman Telat Dikembalikan!',
        'Peminjaman Anda telah melewati batas waktu pengembalian. Segera kembalikan alat ke lab.',
        jsonb_build_object('borrowing_id', NEW.id, 'due_at', NEW.due_at)
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_borrowing_overdue
  AFTER UPDATE OF status, due_at ON borrowings
  FOR EACH ROW
  EXECUTE FUNCTION fn_notify_borrowing_overdue();

-- Trigger: Auto-notify student when grade is posted or corrected
CREATE OR REPLACE FUNCTION fn_notify_grade_posted()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_assignment_title TEXT;
BEGIN
  SELECT s.user_id INTO v_user_id FROM students s WHERE s.id = NEW.student_id;
  SELECT a.title INTO v_assignment_title FROM assignments a WHERE a.id = NEW.assignment_id;

  IF v_user_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, metadata)
    VALUES (
      v_user_id,
      CASE WHEN TG_OP = 'INSERT' THEN 'grade_posted' ELSE 'grade_correction' END,
      CASE WHEN TG_OP = 'INSERT' THEN '📊 Nilai Baru Telah Diposting' ELSE '✏️ Nilai Telah Dikoreksi' END,
      format('Nilai untuk tugas "%s" telah %s: Predikat %s.',
        v_assignment_title,
        CASE WHEN TG_OP = 'INSERT' THEN 'diposting' ELSE 'dikoreksi' END,
        NEW.nilai
      ),
      jsonb_build_object('grade_id', NEW.id, 'nilai', NEW.nilai, 'assignment_id', NEW.assignment_id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_grade_notify
  AFTER INSERT OR UPDATE OF nilai ON grades
  FOR EACH ROW
  WHEN (NEW.status = 'graded')
  EXECUTE FUNCTION fn_notify_grade_posted();

-- Seed: Sample notifications for development
INSERT INTO notifications (id, user_id, type, title, body, is_read, metadata) VALUES
  (gen_random_uuid(), '11111111-0000-0000-0000-000000000002', 'borrowing_approved',
    '✅ Peminjaman Alat Disetujui Guru',
    'Peminjaman Kamera Sony Alpha A7 III telah disetujui oleh guru pembina.',
    false,
    '{"equipment": "Kamera Sony Alpha A7 III", "due_at": "2026-08-08"}'
  ),
  (gen_random_uuid(), '11111111-0000-0000-0000-000000000006', 'borrowing_overdue',
    '⚠️ Alat Pinjaman Telat Dikembalikan!',
    'Peminjaman Anda telah melewati batas waktu pengembalian. Segera kembalikan alat ke lab.',
    false,
    '{"borrowing_id": "55555555-0000-0000-0000-000000000002", "due_at": "2026-08-03"}'
  ),
  (gen_random_uuid(), '11111111-0000-0000-0000-000000000002', 'grade_posted',
    '📊 Nilai Baru Telah Diposting',
    'Nilai untuk tugas "Sinematografi Dasar & Lighting Lab" telah diposting: Predikat A.',
    true,
    '{"nilai": "A", "assignment": "Sinematografi Dasar & Lighting Lab"}'
  ),
  (gen_random_uuid(), '11111111-0000-0000-0000-000000000005', 'attendance_correction',
    '✏️ Koreksi Absensi Diproses',
    'Absensi Anda tanggal 4 Agustus 2026 telah dikoreksi dari Alpha menjadi Hadir oleh guru.',
    false,
    '{"tanggal": "2026-08-04", "status_lama": "alpha", "status_baru": "hadir"}'
  ),
  (gen_random_uuid(), '11111111-0000-0000-0000-000000000004', 'cash_deducted',
    '💰 Iuran Kas Berhasil Diproses',
    'Iuran kas bulan Agustus 2026 sebesar Rp 50.000 berhasil tercatat.',
    true,
    '{"nominal": 50000, "bulan": "Agustus 2026"}'
  )
ON CONFLICT DO NOTHING;
