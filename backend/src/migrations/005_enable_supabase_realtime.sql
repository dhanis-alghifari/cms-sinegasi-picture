-- ==========================================
-- 005_enable_supabase_realtime.sql
-- Aktifkan Supabase Realtime untuk tabel yang perlu update live
-- Jalankan di Supabase SQL Editor atau via supabase CLI
-- ==========================================

-- Enable Realtime on grades table (notif langsung saat nilai diposting/dikoreksi)
ALTER PUBLICATION supabase_realtime ADD TABLE grades;

-- Enable Realtime on notifications table (notif langsung ke klien)
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Enable Realtime on attendance (koreksi absensi real-time)
ALTER PUBLICATION supabase_realtime ADD TABLE attendance;

-- Enable Realtime on borrowings (status pinjam diperbarui langsung)
ALTER PUBLICATION supabase_realtime ADD TABLE borrowings;

-- Enable Realtime on cash_transactions (update saldo live)
ALTER PUBLICATION supabase_realtime ADD TABLE cash_transactions;

-- NOTE: activity_logs NOT added to realtime — it is immutable and append-only.
-- Clients should poll /api/audit-logs periodically, not subscribe to realtime.

-- Supabase RLS notes:
-- Aktifkan RLS di setiap tabel agar Row Level Security berfungsi di sisi database.
-- Policy contoh untuk notifications: user hanya bisa baca notifnya sendiri.

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrowings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: students hanya bisa baca notifikasi milik dirinya
CREATE POLICY "students_own_notifications" ON notifications
  FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM users WHERE username = current_setting('request.jwt.claims', true)::json->>'username'
    )
  );

-- RLS Policy: grades hanya bisa dibaca oleh guru atau oleh siswa bersangkutan
CREATE POLICY "view_own_grades" ON grades
  FOR SELECT
  USING (
    student_id IN (
      SELECT s.id FROM students s
      JOIN users u ON u.id = s.user_id
      WHERE u.username = current_setting('request.jwt.claims', true)::json->>'username'
    )
    OR
    (current_setting('request.jwt.claims', true)::json->>'role') IN ('teacher', 'leader', 'vice_leader', 'secretary')
  );
