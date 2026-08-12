-- ==========================================
-- 001_student_dashboard_tables.sql
-- Migrasi Tabel Dashboard Siswa di Supabase / Postgres
-- ==========================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Custom Enums
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM (
      'teacher', 'leader', 'vice_leader', 'treasurer', 'secretary',
      'equipment_team', 'contest_team', 'member'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE physical_condition AS ENUM (
      'bagus', 'sedikit_kerusakan', 'rusak', 'rusak_besar', 'sedang_diperbaiki', 'hilang'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE availability_status AS ENUM ('tersedia', 'dipinjam', 'maintenance');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE contest_status AS ENUM ('progres', 'selesai');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE assignment_category AS ENUM ('class_task', 'crew_film', 'event_participation', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE grade_value AS ENUM ('A', 'B', 'C', 'D', 'E');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nama TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'member',
  is_first_login BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Students Master Table
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  nis TEXT UNIQUE NOT NULL,
  nama TEXT NOT NULL,
  kelas TEXT NOT NULL,
  peminatan TEXT CHECK (peminatan IN ('kamera', 'editing', 'naskah')),
  no_telepon TEXT,
  foto_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_students_nis_trgm ON students USING gin (nis gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_students_nama_trgm ON students USING gin (nama gin_trgm_ops);

-- 3. Student Dashboard Specific Summaries & Attendance
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  tanggal DATE NOT NULL,
  status TEXT CHECK (status IN ('hadir', 'sakit', 'izin', 'alpha')),
  keterangan TEXT,
  is_locked BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  idempotency_key TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_attendance_student_date UNIQUE (student_id, tanggal)
);

-- 4. Assignments & Universal Grades
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category assignment_category NOT NULL,
  keterangan_kategori TEXT,
  due_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  nilai grade_value,
  status TEXT NOT NULL DEFAULT 'ungraded' CHECK (status IN ('graded', 'ungraded')),
  keterangan TEXT,
  graded_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_student_assignment UNIQUE (student_id, assignment_id)
);

-- 5. Student Borrowings
CREATE TABLE IF NOT EXISTS equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_alat TEXT NOT NULL,
  kode_qr TEXT UNIQUE NOT NULL,
  physical_condition physical_condition DEFAULT 'bagus',
  availability_status availability_status DEFAULT 'tersedia',
  fotos TEXT[] NOT NULL CHECK (array_length(fotos, 1) >= 3),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS borrowings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'borrowed', 'returned', 'partial')),
  borrowed_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Student Dashboard View (Materialized/View Helper for Student Summaries)
CREATE OR REPLACE VIEW v_student_dashboard_summary AS
SELECT
  s.id AS student_id,
  s.nis,
  s.nama,
  s.kelas,
  s.peminatan,
  s.foto_url,
  s.is_active,
  COALESCE(att.persentase_kehadiran, 100.0) AS persentase_kehadiran,
  COALESCE(debt.total_tunggakan, 0) AS total_tunggakan,
  COALESCE(grd.rata_nilai, 'A') AS predikat_rata_nilai,
  COALESCE(bor.active_borrowings_count, 0) AS active_borrowings_count
FROM students s
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
