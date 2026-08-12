-- ==========================================
-- 006_contest_film_works_tables.sql
-- Tabel Karya Film, Status Lomba, dan Win Rate
-- ==========================================

-- Film works / productions table
CREATE TABLE IF NOT EXISTS film_works (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judul TEXT NOT NULL,
  durasi_menit NUMERIC(5,1),
  genre TEXT CHECK (genre IN ('short_film', 'dokumenter', 'animasi', 'iklan', 'klip_musik', 'eksperimental', 'lainnya')),
  sinopsis TEXT,
  tahun_produksi INTEGER NOT NULL,
  thumbnail_url TEXT,
  video_url TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'produksi', 'pasca_produksi', 'selesai', 'dilombakan')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction: film_works ↔ students (crew roles)
CREATE TABLE IF NOT EXISTS film_crew (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  film_id UUID NOT NULL REFERENCES film_works(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  CONSTRAINT uq_film_crew UNIQUE (film_id, student_id)
);

-- Junction: film_works ↔ contests
CREATE TABLE IF NOT EXISTS contest_films (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  film_id UUID NOT NULL REFERENCES film_works(id) ON DELETE CASCADE,
  CONSTRAINT uq_contest_film UNIQUE (contest_id, film_id)
);

-- Extend contests: add trophy/achievement fields if not present
ALTER TABLE contests
  ADD COLUMN IF NOT EXISTS juara TEXT,           -- e.g. 'Juara 1', 'Juara 2', 'Favorit', NULL
  ADD COLUMN IF NOT EXISTS kategori_penghargaan TEXT, -- e.g. 'Sinematografi Terbaik'
  ADD COLUMN IF NOT EXISTS piala_url TEXT,
  ADD COLUMN IF NOT EXISTS catatan TEXT;

-- Win Rate View: per tahun & per level
CREATE OR REPLACE VIEW v_contest_win_rate AS
SELECT
  EXTRACT(YEAR FROM tanggal)::INTEGER AS tahun,
  level,
  COUNT(*) AS total_lomba,
  COUNT(CASE WHEN status = 'selesai' THEN 1 END) AS total_selesai,
  COUNT(CASE WHEN juara IS NOT NULL AND status = 'selesai' THEN 1 END) AS total_menang,
  ROUND(
    COUNT(CASE WHEN juara IS NOT NULL AND status = 'selesai' THEN 1 END)::NUMERIC /
    NULLIF(COUNT(CASE WHEN status = 'selesai' THEN 1 END), 0) * 100
  , 1) AS win_rate_persen
FROM contests
GROUP BY tahun, level
ORDER BY tahun DESC, level;

-- Seed: film works
INSERT INTO film_works (id, judul, durasi_menit, genre, sinopsis, tahun_produksi, status) VALUES
  ('77777777-0000-0000-0000-000000000001', 'Bayangan Masa',      12.5, 'short_film',  'Kisah seorang remaja yang menemukan buku harian kakeknya yang mengubah pandangannya tentang keberanian.', 2026, 'dilombakan'),
  ('77777777-0000-0000-0000-000000000002', 'Dokumentasi HUT Sekolah', 8.0, 'dokumenter', 'Rekaman momen terbaik perayaan HUT ke-25 SMKN 1 Sinegasi dengan 300 peserta.', 2026, 'selesai'),
  ('77777777-0000-0000-0000-000000000003', 'Garis Waktu',        15.0, 'short_film',  'Film pendek drama tentang persahabatan yang teruji di penghujung masa sekolah.', 2025, 'selesai')
ON CONFLICT (id) DO NOTHING;

-- Update contest hasil/juara
UPDATE contests SET
  juara = 'Juara 2',
  kategori_penghargaan = 'Sinematografi Terbaik',
  catatan = 'Dinilai oleh dewan juri dari IKJ dan Kemendikbud'
WHERE id = '66666666-0000-0000-0000-000000000002';

-- Seed contest_films
INSERT INTO contest_films (contest_id, film_id) VALUES
  ('66666666-0000-0000-0000-000000000002', '77777777-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- Seed film crew
INSERT INTO film_crew (film_id, student_id, role) VALUES
  ('77777777-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'Director of Photography'),
  ('77777777-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002', 'Editor & Color Grader'),
  ('77777777-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000003', 'Penulis Naskah / Sutradara'),
  ('77777777-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000004', 'Camera Operator'),
  ('77777777-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000001', 'DOP & Lighting')
ON CONFLICT DO NOTHING;
