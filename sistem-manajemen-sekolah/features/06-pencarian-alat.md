# Pencarian Alat

Cari alat dengan kata kunci atau filter kategori.

## Sub-fitur: Cari Nama Alat

Temukan alat berdasarkan nama atau kata kunci meskipun ejaan tidak persis.

## Sub-fitur: Filter Kategori

Saring alat berdasarkan jenis atau kategori.

## Sub-fitur: Detail Alat

Lihat informasi lengkap alat, termasuk status terkini dan riwayat.

## Sub-fitur: Pindai QR Alat

Cari alat dengan memindai kode QR pada label alat untuk langsung melihat detail dan statusnya.

### Tujuan
Memungkinkan pengguna menemukan alat cukup dengan memindai kode QR pada label alat, lalu langsung melihat detail dan status alat tanpa mengetik.

### Selesai bila
- Pengguna dapat membuka halaman pemindai, mengaktifkan kamera, dan memindai kode QR alat; sistem langsung menampilkan detail alat yang cocok.
- Jika kode QR tidak valid/alat tidak ditemukan, muncul pesan error yang jelas dan pengguna bisa memindai ulang.
- Detail alat yang tampil mencakup nama alat, status terkini, dan foto alat.
- Pemindaian berjalan lancar di mode mobile PWA maupun desktop yang mendukung kamera, dengan permintaan izin kamera yang mudah dipahami.

## Task

### 1. Buat halaman pemindai QR dengan mock data

### 2. Tampilkan detail alat dari hasil pindai

### 3. Buat pesan error dan ulangi pemindaian

### 4. Buat tabel alat dan migrasi Supabase

### 5. Buat endpoint API lookup kode QR

### 6. Sediakan seed data alat untuk pengujian
