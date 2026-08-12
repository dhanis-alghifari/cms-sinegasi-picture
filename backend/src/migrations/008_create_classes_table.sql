-- ==========================================
-- 008_create_classes_table.sql
-- Migrasi Tabel Master Kelas (45 Kelas: TKJ, AK, TB, PH + RLS Policy)
-- (Siap Copy-Paste ke Supabase SQL Editor)
-- ==========================================

-- 1. Buat Tabel Master Kelas
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_kelas TEXT UNIQUE NOT NULL,                             -- Contoh: 'X TKJ 1', 'XII AK 5'
  tingkat TEXT NOT NULL CHECK (tingkat IN ('X', 'XI', 'XII')), -- Tingkat: X, XI, atau XII
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing untuk pencarian kilat berdasarkan tingkat & status aktif
CREATE INDEX IF NOT EXISTS idx_classes_tingkat ON classes(tingkat);
CREATE INDEX IF NOT EXISTS idx_classes_is_active ON classes(is_active);

-- 2. Aktifkan Row Level Security (RLS) & Policy Akses Supabase
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

-- Allow READ (SELECT) untuk semua authenticated/anon (agar form dropdown bisa mengambil opsi)
DROP POLICY IF EXISTS "Allow read access to classes" ON classes;
CREATE POLICY "Allow read access to classes" 
ON classes FOR SELECT 
TO authenticated, anon 
USING (true);

-- Allow FULL ACCESS (INSERT/UPDATE/DELETE) untuk authenticated users / admin
DROP POLICY IF EXISTS "Allow manage classes for authenticated users" ON classes;
CREATE POLICY "Allow manage classes for authenticated users" 
ON classes FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);

-- 3. Seed Initial Master Kelas (Total 45 Kelas)
INSERT INTO classes (nama_kelas, tingkat, is_active) VALUES
  -- TKJ (Teknik Komputer & Jaringan - 15 Kelas)
  ('X TKJ 1', 'X', true), ('X TKJ 2', 'X', true), ('X TKJ 3', 'X', true), ('X TKJ 4', 'X', true), ('X TKJ 5', 'X', true),
  ('XI TKJ 1', 'XI', true), ('XI TKJ 2', 'XI', true), ('XI TKJ 3', 'XI', true), ('XI TKJ 4', 'XI', true), ('XI TKJ 5', 'XI', true),
  ('XII TKJ 1', 'XII', true), ('XII TKJ 2', 'XII', true), ('XII TKJ 3', 'XII', true), ('XII TKJ 4', 'XII', true), ('XII TKJ 5', 'XII', true),

  -- AK (Akuntansi - 15 Kelas)
  ('X AK 1', 'X', true), ('X AK 2', 'X', true), ('X AK 3', 'X', true), ('X AK 4', 'X', true), ('X AK 5', 'X', true),
  ('XI AK 1', 'XI', true), ('XI AK 2', 'XI', true), ('XI AK 3', 'XI', true), ('XI AK 4', 'XI', true), ('XI AK 5', 'XI', true),
  ('XII AK 1', 'XII', true), ('XII AK 2', 'XII', true), ('XII AK 3', 'XII', true), ('XII AK 4', 'XII', true), ('XII AK 5', 'XII', true),

  -- TB (Tata Boga - 9 Kelas)
  ('X TB 1', 'X', true), ('X TB 2', 'X', true), ('X TB 3', 'X', true),
  ('XI TB 1', 'XI', true), ('XI TB 2', 'XI', true), ('XI TB 3', 'XI', true),
  ('XII TB 1', 'XII', true), ('XII TB 2', 'XII', true), ('XII TB 3', 'XII', true),

  -- PH (Perhotelan - 6 Kelas)
  ('X PH 1', 'X', true), ('X PH 2', 'X', true),
  ('XI PH 1', 'XI', true), ('XI PH 2', 'XI', true),
  ('XII PH 1', 'XII', true), ('XII PH 2', 'XII', true)
ON CONFLICT (nama_kelas) DO NOTHING;

-- 4. Tambahkan Foreign Key `class_id` di Tabel `students`
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);

-- 5. Migrasikan Data Siswa Eksisting (Hubungkan String `kelas` ke `class_id` yang sesuai)
UPDATE students s
SET class_id = c.id
FROM classes c
WHERE s.kelas = c.nama_kelas AND s.class_id IS NULL;

-- 6. Update View Dashboard Siswa agar Otomatis Menyertakan `class_id` & Nama Kelas
CREATE OR REPLACE VIEW v_student_dashboard_summary AS
SELECT
  s.id AS student_id,
  s.nis,
  s.nama,
  s.class_id,
  COALESCE(c.nama_kelas, s.kelas) AS kelas,
  s.peminatan,
  s.foto_url,
  s.is_active,
  COALESCE(att.persentase_kehadiran, 100.0) AS persentase_kehadiran,
  COALESCE(debt.total_tunggakan, 0) AS total_tunggakan,
  COALESCE(grd.rata_nilai, 'A') AS predikat_rata_nilai,
  COALESCE(bor.active_borrowings_count, 0) AS active_borrowings_count
FROM students s
LEFT JOIN classes c ON c.id = s.class_id
LEFT JOIN (
  SELECT
    student_id,
    ROUND(
      (COUNT(CASE WHEN status = 'hadir' THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0)::NUMERIC) * 100, 1
    ) AS persentase_kehadiran
  FROM attendance
  GROUP BY student_id
) att ON att.student_id = s.id
LEFT JOIN (
  SELECT
    student_id,
    SUM(amount) AS total_tunggakan
  FROM debt_records
  WHERE status = 'unpaid'
  GROUP BY student_id
) debt ON debt.student_id = s.id
LEFT JOIN (
  SELECT
    student_id,
    MODE() WITHIN GROUP (ORDER BY nilai) AS rata_nilai
  FROM grades
  WHERE status = 'graded'
  GROUP BY student_id
) grd ON grd.student_id = s.id
LEFT JOIN (
  SELECT
    student_id,
    COUNT(*) AS active_borrowings_count
  FROM borrowings
  WHERE status IN ('borrowed', 'pending')
  GROUP BY student_id
) bor ON bor.student_id = s.id;
