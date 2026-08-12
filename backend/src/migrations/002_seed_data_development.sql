-- ==========================================
-- 002_seed_data_development.sql
-- Data Contoh / Seed untuk Development & Frontend Testing
-- ==========================================

-- Seed Users (password_hash = plaintext for dev only)
INSERT INTO users (id, username, password_hash, nama, role, is_first_login, is_active) VALUES
  ('11111111-0000-0000-0000-000000000001', 'guru_pembina',    'guru123',    'Dra. Hj. Endang Rahayu, M.Pd', 'teacher',        false, true),
  ('11111111-0000-0000-0000-000000000002', 'ketua_budi',      'ketua123',   'Budi Santoso',                  'leader',         false, true),
  ('11111111-0000-0000-0000-000000000003', 'wakil_rina',      'wakil123',   'Rina Purnama',                  'vice_leader',    false, true),
  ('11111111-0000-0000-0000-000000000004', 'bendahara_dani',  'dani123',    'Ahmad Dani',                    'treasurer',      false, true),
  ('11111111-0000-0000-0000-000000000005', 'sekre_siti',      'siti123',    'Siti Aminah',                   'secretary',      false, true),
  ('11111111-0000-0000-0000-000000000006', 'eq_rizky',        'rizky123',   'Rizky Pratama',                 'equipment_team', true,  true),
  ('11111111-0000-0000-0000-000000000007', 'contest_maya',    'maya123',    'Maya Kusuma',                   'contest_team',   false, true),
  ('11111111-0000-0000-0000-000000000008', 'member_dewi',     'dewi123',    'Dewi Lestari',                  'member',         false, false)
ON CONFLICT (id) DO NOTHING;

-- Seed Students
INSERT INTO students (id, user_id, nis, nama, kelas, peminatan, no_telepon, is_active) VALUES
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', '20261001', 'Budi Santoso',   'XII DKV 1', 'kamera',  '081234567001', true),
  ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000005', '20261002', 'Siti Aminah',    'XII DKV 1', 'editing', '081234567002', true),
  ('22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000006', '20261003', 'Rizky Pratama',  'XII DKV 2', 'naskah',  '081234567003', true),
  ('22222222-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000007', '20261004', 'Maya Kusuma',    'XII DKV 2', 'kamera',  '081234567004', true),
  ('22222222-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000004', '20261005', 'Ahmad Dani',     'XI DKV 1',  'editing', '081234567005', true),
  ('22222222-0000-0000-0000-000000000006', '11111111-0000-0000-0000-000000000008', '20261006', 'Dewi Lestari',   'XI DKV 1',  'naskah',  '081234567006', false)
ON CONFLICT (id) DO NOTHING;

-- Seed Attendance (agustus 2026)
INSERT INTO attendance (id, student_id, tanggal, status, idempotency_key) VALUES
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000001', '2026-08-01', 'hadir',  'att-std1-2026-08-01'),
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000001', '2026-08-04', 'hadir',  'att-std1-2026-08-04'),
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000001', '2026-08-05', 'hadir',  'att-std1-2026-08-05'),
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000002', '2026-08-01', 'hadir',  'att-std2-2026-08-01'),
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000002', '2026-08-04', 'sakit',  'att-std2-2026-08-04'),
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000002', '2026-08-05', 'hadir',  'att-std2-2026-08-05'),
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000003', '2026-08-01', 'hadir',  'att-std3-2026-08-01'),
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000003', '2026-08-04', 'alpha',  'att-std3-2026-08-04'),
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000003', '2026-08-05', 'izin',   'att-std3-2026-08-05')
ON CONFLICT (idempotency_key) DO NOTHING;

-- Seed Assignments (Bulk Grading A-E per kategori)
INSERT INTO assignments (id, title, category, keterangan_kategori, due_date) VALUES
  ('33333333-0000-0000-0000-000000000001', 'Sinematografi Dasar & Lighting Lab',        'class_task',          NULL,                          '2026-07-25'),
  ('33333333-0000-0000-0000-000000000002', 'Produksi Short Film "Bayangan Masa"',        'crew_film',           NULL,                          '2026-08-01'),
  ('33333333-0000-0000-0000-000000000003', 'Dokumentasi Special Event HUT Sekolah',      'event_participation', NULL,                          '2026-07-15'),
  ('33333333-0000-0000-0000-000000000004', 'Workshop Color Grading DaVinci Resolve',     'other',               'Pelatihan Sertifikasi Eksternal', '2026-07-10')
ON CONFLICT (id) DO NOTHING;

-- Seed Grades (Nilai A-E per siswa per assignment)
INSERT INTO grades (id, student_id, assignment_id, nilai, status, keterangan, graded_by) VALUES
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'A', 'graded', 'Teknik lighting sangat baik dan presisi',  '11111111-0000-0000-0000-000000000001'),
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002', 'A', 'graded', 'DOP terbaik dalam produksi film ini',       '11111111-0000-0000-0000-000000000001'),
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000001', 'B', 'graded', 'Color grading baik, perlu konsistensi',     '11111111-0000-0000-0000-000000000001'),
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000002', 'B', 'graded', 'Rhythm editing dinamis dan menarik',        '11111111-0000-0000-0000-000000000001'),
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000003', '33333333-0000-0000-0000-000000000001', 'C', 'graded', 'Perlu perbaikan framing dan komposisi',     '11111111-0000-0000-0000-000000000001'),
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000004', '33333333-0000-0000-0000-000000000001', 'A', 'graded', 'Komposisi kreatif dan cinematik',           '11111111-0000-0000-0000-000000000001'),
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000005', '33333333-0000-0000-0000-000000000002', 'B', 'graded', 'Editing timeline rapi dan efisien',         '11111111-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- Seed Equipment (Katalog Alat, Wajib min 3 Foto)
INSERT INTO equipment (id, nama_alat, kode_qr, physical_condition, availability_status, fotos) VALUES
  ('44444444-0000-0000-0000-000000000001', 'Kamera Sony Alpha A7 III + Lensa FE 24-70mm GM', 'QR-CAM-SONY-001', 'bagus',            'dipinjam',  ARRAY['https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=150', 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=150', 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=150']),
  ('44444444-0000-0000-0000-000000000002', 'Lighting Godox SL-60W Continuous Daylight Kit',   'QR-LIGHT-GOD-002', 'sedikit_kerusakan', 'dipinjam', ARRAY['https://images.unsplash.com/photo-1527011046414-4781f1f94f8c?w=150', 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=150', 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=150']),
  ('44444444-0000-0000-0000-000000000003', 'Wireless Mic Saramonic Blink 500 B2',             'QR-MIC-SARA-003',  'bagus',            'tersedia',  ARRAY['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=150', 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=150', 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=150']),
  ('44444444-0000-0000-0000-000000000004', 'Gimbal Stabilizer DJI RS 3 Pro',                  'QR-GIMBAL-DJI-004', 'bagus',           'tersedia',  ARRAY['https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=150', 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=150', 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=150']),
  ('44444444-0000-0000-0000-000000000005', 'Tripod Libec TH-X Head Video Pro',                'QR-TRIPOD-LIB-005', 'bagus',           'maintenance', ARRAY['https://images.unsplash.com/photo-1527011046414-4781f1f94f8c?w=150', 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=150', 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=150'])
ON CONFLICT (id) DO NOTHING;

-- Seed Borrowings (Aktif + Telat)
INSERT INTO borrowings (id, student_id, status, borrowed_at, due_at, returned_at, approved_by) VALUES
  ('55555555-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'borrowed', '2026-08-01 08:00:00+07', '2026-08-08 17:00:00+07', NULL, '11111111-0000-0000-0000-000000000001'),
  ('55555555-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000003', 'borrowed', '2026-07-30 08:00:00+07', '2026-08-03 17:00:00+07', NULL, '11111111-0000-0000-0000-000000000001'),
  ('55555555-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000005', 'returned', '2026-07-20 08:00:00+07', '2026-07-27 17:00:00+07', '2026-07-26 14:30:00+07', '11111111-0000-0000-0000-000000000001'),
  ('55555555-0000-0000-0000-000000000004', '22222222-0000-0000-0000-000000000002', 'pending',  NULL,                    '2026-08-07 17:00:00+07', NULL, NULL)
ON CONFLICT (id) DO NOTHING;
