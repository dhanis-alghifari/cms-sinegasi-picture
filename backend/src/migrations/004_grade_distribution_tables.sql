-- ==========================================
-- 004_grade_distribution_tables.sql
-- Tabel Distribusi Nilai, Activity Log Immutable,
-- Cash Management, dan Contest Achievement
-- ==========================================

-- =====================
-- Debt / Cash Records
-- =====================
DO $$ BEGIN
    CREATE TYPE debt_status AS ENUM ('unpaid', 'paid', 'disputed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM ('iuran_wajib', 'pemasukan', 'pengeluaran', 'koreksi');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS debt_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  status debt_status DEFAULT 'unpaid',
  keterangan TEXT,
  periode TEXT NOT NULL, -- e.g. '2026-08'
  idempotency_key TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_debt_student_status ON debt_records(student_id, status);

CREATE TABLE IF NOT EXISTS cash_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type transaction_type NOT NULL,
  nominal NUMERIC(12,2) NOT NULL CHECK (nominal > 0),
  keterangan TEXT NOT NULL,
  saldo_sebelum NUMERIC(12,2) NOT NULL,
  saldo_sesudah NUMERIC(12,2) NOT NULL CHECK (saldo_sesudah >= 0), -- PROTEKSI SALDO NEGATIF
  idempotency_key TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_type ON cash_transactions(type);

-- Cash Dispute (Sanggahan Transaksi)
CREATE TABLE IF NOT EXISTS cash_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES cash_transactions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  alasan_sanggahan TEXT NOT NULL CHECK (length(alasan_sanggahan) >= 10),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- Grade Distribution View
-- =====================

-- Aggregate grade distribution per assignment and per student class
CREATE OR REPLACE VIEW v_grade_distribution AS
SELECT
  a.id AS assignment_id,
  a.title AS assignment_title,
  a.category,
  a.due_date,
  g.nilai,
  COUNT(g.id) AS jumlah_siswa,
  ROUND(COUNT(g.id)::NUMERIC / NULLIF(SUM(COUNT(g.id)) OVER (PARTITION BY a.id), 0) * 100, 1) AS persentase
FROM assignments a
JOIN grades g ON g.assignment_id = a.id AND g.status = 'graded'
GROUP BY a.id, a.title, a.category, a.due_date, g.nilai
ORDER BY a.due_date DESC, g.nilai;

-- Per-student grade summary view
CREATE OR REPLACE VIEW v_student_grade_summary AS
SELECT
  s.id AS student_id,
  s.nama,
  s.kelas,
  s.peminatan,
  COUNT(g.id) AS total_graded,
  COUNT(CASE WHEN g.nilai = 'A' THEN 1 END) AS predikat_a,
  COUNT(CASE WHEN g.nilai = 'B' THEN 1 END) AS predikat_b,
  COUNT(CASE WHEN g.nilai = 'C' THEN 1 END) AS predikat_c,
  COUNT(CASE WHEN g.nilai = 'D' THEN 1 END) AS predikat_d,
  COUNT(CASE WHEN g.nilai = 'E' THEN 1 END) AS predikat_e,
  MODE() WITHIN GROUP (ORDER BY g.nilai) AS predikat_dominan
FROM students s
LEFT JOIN grades g ON g.student_id = s.id AND g.status = 'graded'
GROUP BY s.id, s.nama, s.kelas, s.peminatan;

-- =====================
-- Contest Achievements
-- =====================
CREATE TABLE IF NOT EXISTS contests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL,
  jenis TEXT NOT NULL,
  level TEXT CHECK (level IN ('kabupaten', 'kota', 'provinsi', 'nasional', 'internasional')),
  tanggal DATE NOT NULL,
  status contest_status DEFAULT 'progres',
  hasil TEXT,
  piala_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contest_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  CONSTRAINT uq_contest_member UNIQUE (contest_id, student_id)
);

-- =====================
-- Immutable Activity Logs (Zero Silent Edits)
-- =====================
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,          -- INSERT, UPDATE, DELETE, SYSTEM_CHECK
  table_name TEXT NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  change_reason TEXT NOT NULL CHECK (length(change_reason) >= 5),
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- IMMUTABLE: Prevent any UPDATE or DELETE on activity_logs
CREATE OR REPLACE FUNCTION fn_prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'activity_logs bersifat immutable: UPDATE dan DELETE tidak diizinkan (Zero Silent Edits Policy).';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_update ON activity_logs;
CREATE TRIGGER trg_prevent_audit_update
  BEFORE UPDATE OR DELETE ON activity_logs
  FOR EACH ROW EXECUTE FUNCTION fn_prevent_audit_modification();

-- Seed grade distribution sample logs
INSERT INTO activity_logs (user_id, action, table_name, record_id, old_values, new_values, change_reason) VALUES
  ('11111111-0000-0000-0000-000000000001', 'INSERT', 'grades',       '33333333-0000-0000-0000-000000000001', NULL,              '{"nilai":"A","status":"graded"}',        'Guru menginput nilai bulk grading Sinematografi Dasar'),
  ('11111111-0000-0000-0000-000000000001', 'UPDATE', 'attendance',   '22222222-0000-0000-0000-000000000002', '{"status":"alpha"}','{"status":"hadir"}',                    'Guru mengoreksi absensi pasca-lock. Surat izin diserahkan.'),
  ('11111111-0000-0000-0000-000000000001', 'INSERT', 'cash_transactions', NULL,                              NULL,              '{"nominal":50000,"type":"iuran_wajib"}', 'Pencatatan iuran kas mingguan Agustus 2026'),
  ('11111111-0000-0000-0000-000000000002', 'INSERT', 'borrowings',   '55555555-0000-0000-0000-000000000001', NULL,              '{"status":"pending"}',                   'Pengajuan peminjaman Kamera Sony A7 III via Scan QR Code'),
  (NULL,                                  'SYSTEM_CHECK', 'borrowings', NULL,                               NULL,              '{"overdue_count":2}',                    'SYSTEM:OVERDUE_CHECK - Deteksi 2 item peminjaman telat kembali')
ON CONFLICT DO NOTHING;

-- Seed contests
INSERT INTO contests (id, nama, jenis, level, tanggal, status, hasil) VALUES
  ('66666666-0000-0000-0000-000000000001', 'LKS Sinematografi Provinsi Jawa Tengah 2026', 'Sinematografi', 'provinsi', '2026-09-15', 'progres', NULL),
  ('66666666-0000-0000-0000-000000000002', 'Festival Film Pelajar Nasional SMAN Cup 2026', 'Short Film',   'nasional',  '2026-07-20', 'selesai', 'Juara 2 Kategori Sinematografi Terbaik')
ON CONFLICT (id) DO NOTHING;

INSERT INTO contest_members (contest_id, student_id, role) VALUES
  ('66666666-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'DOP / Camera Operator'),
  ('66666666-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002', 'Editor & Color Grader'),
  ('66666666-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000001', 'Director of Photography'),
  ('66666666-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000004', 'Camera Operator')
ON CONFLICT DO NOTHING;
