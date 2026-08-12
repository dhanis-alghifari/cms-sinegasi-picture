# PRD — Project Requirements Document

## 1. Overview

Aplikasi ini adalah **Cinematography & Media Monitoring Dashboard**, sebuah dashboard manajemen kelas ekstrakurikuler sinematografi/media berbasis **Progressive Web App (PWA)** yang menyatukan pencatatan **uang kas & utang**, **absensi siswa**, **nilai**, **peminjaman alat**, **distribusi tugas lomba**, **notifikasi**, dan **audit trail** dalam satu tempat. Saat ini ketiga hal tersebut biasanya dicatat terpisah atau manual, sehingga rawan salah catat, data hilang, dan sulit dicek ulang. Proses monitoring alat juga lambat karena harus mengecek satu per satu, dan alat yang telat dikembalikan atau rusak sulit dilacak.

Tujuan utama: memberi pengurus kelas/guru satu sistem yang rapi, cepat, transparan, dan aman untuk mengelola 11 modul inti:
1. **User Management** — kelola siklus hidup akun pengguna, termasuk first-login password enforcement, admin-assisted password reset, dan status akun nonaktif untuk alumni/anggota keluar.
2. **Student Attendance Management** — catat kehadiran harian (hadir/izin/sakit/alpha) dan lihat rekap bulanan.
3. **Cash & Debt Management** — catat uang kas masuk/keluar, pantau saldo, dan kelola iuran/tunggakan siswa secara transparan.
4. **Student Grade Recaps** — kelola nilai siswa dan riwayat penilaian (skala A-E), dengan status graded/ungraded.
5. **Equipment Catalog & Condition Monitoring** — kelola katalog alat, status kondisi fisik, ketersediaan (termasuk status maintenance), dan foto alat.
6. **Equipment Borrowing & Approval Workflows** — peminjaman alat via QR/fuzzy search dengan alur persetujuan.
7. **Equipment Returns & Split-Item Check-Ins** — pengembalian per item dengan pencatatan kondisi.
8. **Contest Tracking & Work Distribution** — kelola lomba dan distribusi tugas anggota.
9. **Personal Student Dashboard** — siswa dapat melihat data pribadi (absensi, kas, nilai, peminjaman, dan tugas lomba).
10. **Data Export System** — ekspor data ke PDF/CSV dengan batasan sesuai peran.
11. **Notification Center & Immutable Audit Trail** — notifikasi push/in-app dan jejak audit yang tidak bisa diubah.

Diferensiasi utama: **Semua tercatat rapi, transparan, dan dapat diaudit** — data kas, kehadiran, nilai, alat, dan tugas tersimpan terpusat, bisa dicari kapan saja, dan setiap perubahan wajib disertai alasan (*zero silent edits*). Sistem menerapkan **Zero-Trust Security**, **Strict RBAC**, dan **Immutable Audit Logs**.

Aplikasi ini dirancang menggunakan **Decoupled Architecture** dengan folder `/backend` (Fastify API) dan `/frontend` (React Vite SPA) yang terpisah.

Kriteria sukses pertama (first-win): pengguna berhasil **menginput uang kas dan memantau saldo kas** dengan cepat tanpa kesalahan hitung. Target performa API < 20ms melalui **Parameterized Raw SQL** tanpa ORM.

## 2. Requirements

Persyaratan utama proyek:

- **Input & monitoring uang kas (In/Out)** — Bendahara dapat menginput nominal dan nama siswa dengan cepat tanpa hambatan administratif. **Mekanisme input kas tetap menggunakan alur yang sudah berjalan tanpa perubahan.**
- **Efisiensi Bendahara** — Saat input kas masuk, Bendahara tidak diwajibkan mengunggah foto bukti agar proses pencatatan di lapangan bisa dilakukan dengan cepat.
- **Auto-billing dan tunggakan** — sistem dapat membuat tagihan iuran mingguan otomatis, dengan pengaturan rentang tanggal libur semester.
- **Pengaturan Iuran Wajib** — Guru dan Bendahara dapat mengatur nominal iuran wajib (minimal 500).
- **Manajemen Hutang Otomatis** — Jika input pembayaran kas masuk kurang dari nominal iuran wajib, sistem otomatis mencatat selisihnya sebagai tunggakan.
- **Arus Kas Transparan (Pengeluaran)** — Setiap input pengeluaran wajib melalui form dua tahap: 1) Nominal, 2) Keterangan/Nama barang detail untuk pertanggungjawaban.
- **Validasi Saldo & Nominal** — Sistem menolak input jika nominal <= 0. Pengeluaran tidak boleh menyebabkan saldo negatif.
- **Sistem Sanggahan (Dispute) dengan Bukti** — Siswa dapat menyanggah transaksi kas masuk. **Sanggahan wajib disertai unggahan foto bukti pembayaran** (fisik/transfer) dari sisi siswa untuk memvalidasi klaim. Sanggahan dibatasi maksimal 1 kali per transaksi.
- **Input absensi siswa** — tandai hadir/sakit/izin/alpha per hari dengan autolock 48 jam.
- **Koreksi pasca-lock oleh guru** — mekanisme adjustment entry / change_reason wajib disertakan, bukan overwrite diam-diam.
- **Peminjaman alat** — pinjam via scan QR atau fuzzy search dengan approval eksklusif oleh Guru.
- **Monitoring alat** — pantau kondisi fisik dan status ketersediaan secara terpisah. Wajib upload minimal 3 foto kondisi saat input alat baru.
- **Pencarian alat** — cari alat dengan kata kunci atau scan QR.
- **Manajemen nilai (Universal Grading System)** — Eksklusif untuk Teacher; mencakup input nilai dengan skala A, B, C, D, E.
- **Contest tracking & work distribution** — distribusi tugas anggota via junction table dan pembaruan progres spesifik.
- **Autentikasi multi-pengguna & RBAC** — login, manajemen pengguna, 8 tingkatan akses dengan matriks akses ketat.
- **Notifikasi & audit trail** — kirim notifikasi push/in-app dan catat semua perubahan dalam audit log immutable. **Zero Silent Edits** ditegakkan secara absolut.
- **Responsive & offline-tolerant** — aplikasi PWA, layout beradaptasi otomatis antara desktop CMS dan mobile app.

## 3. Core Features

### Fase 1 — Dashboard Utama
Halaman pertama setelah login yang menampilkan:
- **Ringkasan Kas** — saldo kas terakhir dan transaksi terbaru.
- **Ringkasan Absensi** — jumlah siswa hadir hari ini.
- **Status Alat** — alat yang dipinjam, rusak, atau maintenance.
- **Personal Student Dashboard** — ringkasan pribadi: detail kehadiran, riwayat kas, total tunggakan, nilai, peminjaman, dan tugas lomba.

### Fase 2 — Uang Kas & Manajemen Utang
- **Pengaturan Iuran Wajib (Global Setting)** — Menu Bendahara/Guru mengatur nominal mingguan.
- **Fast-Entry Kas Masuk (Mekanisme Tetap)** — **Fitur Input Kas Bendahara tetap menggunakan mekanisme yang sudah berjalan tanpa perubahan.** Bendahara cukup memilih nama siswa dan nominal. Sistem memprioritaskan kecepatan input tanpa kewajiban upload gambar bagi Bendahara.
- **Input Transaksi & Auto-Debt** — Jika bayar < nominal wajib, sistem mencatat hutang secara otomatis.
- **Input Transaksi Pengeluaran (Dua Tahap)**:
    1. **Tahap 1**: Pengguna menginput **Jumlah Nominal**. Sistem validasi apakah saldo mencukupi.
    2. **Tahap 2**: Pengguna wajib menginput **Keterangan Detail** (beli apa/untuk apa).
- **Saldo Tidak Boleh Negatif**: Sistem menolak transaksi pengeluaran jika saldo tidak mencukupi.
- **Cross-Verification & Dispute System (Fokus Pengembangan)**:
    - Siswa mendapat notifikasi saat transaksi dicatat.
    - **Wajib Bukti Sanggahan**: Siswa yang ingin melakukan sanggahan (dispute) **WAJIB** mengunggah foto bukti pembayaran (foto uang fisik atau screenshot transfer) pada saat formulir sanggahan diisi.
    - **Single Sanggahan**: Siswa hanya diperbolehkan melakukan sanggahan maksimal **1 kali** per transaksi untuk mencegah spamming data.
- **Flexible Weekly Auto-Billing** — Berjalan setiap Senin 00:00 dengan pengecekan jadwal libur.

### Fase 2 — Absensi Siswa & Data Siswa
- **Manajemen Data Siswa** — Input Nama, NIS, Kelas, Peminatan, No HP, dan Foto Profil.
- **Input Kehadiran** — Tandai status per hari. Proteksi `uq_attendance_student_date`.
- **Koreksi Guru Pasca-Lock** — Perubahan setelah 48 jam wajib menyertakan `change_reason`.

### Fase 2 — Peminjaman Alat
- **Pinjam via QR** — Scan atau fuzzy search.
- **Approval Workflow** — Pengajuan oleh Leader/Vice/EqTeam. Persetujuan eksklusif oleh Guru.
- **Pengembalian per Item (Split-Item Check-Ins)** — Mendukung pengembalian sebagian alat dalam satu paket.

### Fase 3 — Monitoring Alat
- **Input / Daftar Alat** — Wajib 3 foto kondisi awal.
- **Dual-Status System** — Memisahkan `physical_condition` dan `availability_status`.

### Fase 3 — Manajemen Nilai Siswa (Universal Grading)
- **Bulk Assignment & Grading** — Guru menginput tugas, kategori, dan skala A-E.

### Fase 3 — Contest Tracking & Work Distribution
- **Manajemen Lomba** — Nama lomba unik per periode.
- **Work Distribution** — Penugasan anggota dengan peran spesifik dan bukti gambar hasil akhir.

### Fase 4 — Autentikasi & 8 Tingkatan Akses
- **Strict RBAC** — Validasi peran di level API Fastify.
- **First-Login Enforcement** — Wajib ganti password saat login pertama kali.

## 4. User Flow

1. **Masuk Aplikasi**: Login -> Cek `is_first_login` -> Ganti password -> Dashboard.
2. **Pencatatan Pemasukan (Kas Masuk)**: Menu Kas -> Pilih Siswa -> Input Nominal -> Simpan (**Alur tetap seperti sebelumnya, cepat & tanpa foto**). Jika nominal < tarif wajib, sisa masuk ke `debt_records`.
3. **Pencatatan Pengeluaran**: Menu Kas -> Pilih Pengeluaran -> **Tahap 1**: Input Nominal -> **Tahap 2**: Input Keterangan -> Simpan.
4. **Sanggahan Siswa**: Buka detail kas -> Klik Sanggah (hanya 1x) -> **Upload Foto Bukti Sanggahan (WAJIB)** -> Masukkan alasan -> Status Sanggahan: Pending.
5. **Pinjam Alat**: Leader scan QR -> Ajukan -> Guru Approve -> Status: Dipinjam.
6. **Monitoring Audit**: Admin melacak perubahan saldo kas dan alasan perubahannya melalui `activity_logs`.

## 5. Architecture & UI/UX Design

- **Arsitektur Decoupled**: `/frontend` (React Vite SPA) dan `/backend` (Fastify API). Fetch API murni, TanStack Query, Zustand, dan Tailwind CSS + Shadcn/UI.
- **Header Audit**: Frontend wajib mengirim header **`x-change-reason`** pada setiap request mutasi.
- **Security**: Zero-Trust, Strict RBAC, dan Database RLS diaktifkan.
- **Adaptive UI**: Tampilan desktop CMS; Bottom Navigation untuk Mobile PWA.

## 6. Database Schema (Key Tables)

```sql
-- ==========================================
-- 1. EXTENSIONS & TIPE DATA CUSTOM
-- ==========================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

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
    CREATE TYPE assignment_category AS ENUM ('class_task', 'crew_film', 'event_participation', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE grade_value AS ENUM ('A', 'B', 'C', 'D', 'E');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ==========================================
-- 2. TABEL PENGGUNA & SISWA
-- ==========================================
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

-- ==========================================
-- 3. MANAJEMEN ALAT & PEMINJAMAN
-- ==========================================
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
  student_id UUID NOT NULL REFERENCES students(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'borrowed', 'returned', 'partial')),
  borrowed_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS borrowing_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrowing_id UUID NOT NULL REFERENCES borrowings(id) ON DELETE CASCADE,
  equipment_id UUID NOT NULL REFERENCES equipment(id),
  status TEXT NOT NULL DEFAULT 'borrowed' CHECK (status IN ('borrowed', 'returned')),
  returned_condition TEXT CHECK (returned_condition IN ('baik', 'rusak', 'hilang')),
  returned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_borrowing_item UNIQUE (borrowing_id, equipment_id)
);

-- ==========================================
-- 4. KEUANGAN, HUTANG & VALIDASI KAS
-- ==========================================
CREATE TABLE IF NOT EXISTS billing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nominal_iuran_wajib INT NOT NULL CHECK (nominal_iuran_wajib >= 500),
  holiday_start_date DATE,
  holiday_end_date DATE,
  skip_week BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS cash_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  tipe TEXT NOT NULL CHECK (tipe IN ('masuk', 'keluar')),
  jumlah INT NOT NULL CHECK (jumlah > 0),
  keterangan TEXT, 
  foto_bukti_url TEXT, -- Opsional bagi Bendahara (input tetap seperti sebelumnya)
  tanggal DATE DEFAULT CURRENT_DATE,
  idempotency_key TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger untuk validasi kas (wajib keterangan keluar & cek saldo)
CREATE OR REPLACE FUNCTION validate_cash_transaction()
RETURNS TRIGGER AS $$
DECLARE
    current_balance INT;
BEGIN
    IF NEW.tipe = 'keluar' THEN
        IF NEW.keterangan IS NULL OR TRIM(NEW.keterangan) = '' THEN
            RAISE EXCEPTION 'Untuk pengeluaran, rincian pembelian (keterangan) wajib diisi.';
        END IF;

        SELECT COALESCE(SUM(CASE WHEN tipe = 'masuk' THEN jumlah ELSE -jumlah END), 0)
        INTO current_balance FROM cash_transactions;

        IF current_balance < NEW.jumlah THEN
            RAISE EXCEPTION 'Saldo kas tidak mencukupi untuk melakukan pengeluaran ini.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_cash_flow
BEFORE INSERT ON cash_transactions
FOR EACH ROW EXECUTE FUNCTION validate_cash_transaction();

CREATE TABLE IF NOT EXISTS debt_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id),
  amount INT NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid')),
  source_transaction_id UUID REFERENCES cash_transactions(id),
  settled_transaction_id UUID REFERENCES cash_transactions(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cash_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES cash_transactions(id),
  reason TEXT NOT NULL,
  bukti_sanggahan_url TEXT NOT NULL, -- WAJIB diunggah oleh Siswa (Fokus Revisi)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_single_dispute_per_transaction UNIQUE (transaction_id)
);

-- ==========================================
-- 5. ABSENSI & NILAI (Universal Grading)
-- ==========================================
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  tanggal DATE NOT NULL,
  status TEXT CHECK (status IN ('hadir', 'sakit', 'izin', 'alpha')),
  keterangan TEXT,
  is_locked BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  idempotency_key TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_attendance_student_date UNIQUE (student_id, tanggal)
);

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

-- ==========================================
-- 6. CONTEST TRACKING & NOTIFIKASI
-- ==========================================
CREATE TABLE IF NOT EXISTS contests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_festival TEXT NOT NULL,
  tanggal_lomba DATE NOT NULL,
  status TEXT DEFAULT 'progres',
  bukti_foto_url TEXT,
  hasil_juara TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contest_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  role_in_contest TEXT NOT NULL,
  CONSTRAINT uq_contest_member UNIQUE (contest_id, student_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 7. AUDIT TRAIL (IMMUTABLE LOGS)
-- ==========================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  aksi TEXT NOT NULL, 
  tabel TEXT NOT NULL,
  record_id UUID NOT NULL,
  data_lama JSONB,
  data_baru JSONB,
  change_reason TEXT NOT NULL, 
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 7. Key Safeguard Features & Edge-Case Handling

1. **Zero Silent Edits**: Database membatalkan transaksi jika `app.current_user_id` atau `app.change_reason` kosong.
2. **Fast-Inbound Cash (Legacy Flow)**: Bendahara dapat mencatat iuran dengan mekanisme cepat yang sudah ada tanpa syarat foto, memudahkan operasional harian di lapangan.
3. **Mandatory Student Dispute Proof**: Siswa wajib melampirkan `bukti_sanggahan_url` saat melakukan sanggahan. Tanpa upload foto bukti, sistem menolak sanggahan di level database.
4. **Single Dispute Enforcement**: Constraint `uq_single_dispute_per_transaction` memastikan siswa hanya bisa menyanggah satu transaksi sebanyak satu kali, mencegah spamming data.
5. **Idempotency Safeguard**: Pengamanan data ganda via `idempotency_key` pada kas dan absensi.
6. **Proteksi Saldo Negatif**: Trigger database melakukan perhitungan saldo real-time untuk mencegah pengeluaran berlebih dari dana yang tersedia.
7. **Transparansi Pengeluaran Bertahap**: UI memaksa alur input nominal (Tahap 1) dan deskripsi detail pertanggungjawaban (Tahap 2).
8. **Immutable Audit Trail**: Tabel `activity_logs` tidak bisa di-update atau di-delete oleh pengguna manapun.
9. **Zero-Trust API Access**: Validasi logika bisnis di Fastify didukung header audit dari React SPA untuk setiap mutasi.
10. **Universal Grading Consistency**: Jika kategori `other` dipilih pada tugas, keterangan tambahan tidak boleh kosong.
11. **R2 Atomic Operations**: Cleanup otomatis file jika transaksi DB gagal selama proses unggah foto (alat/dispute/lomba).
12. **Automated Overdue Task**: Notifikasi otomatis untuk pengembalian alat berdasarkan `due_at`.