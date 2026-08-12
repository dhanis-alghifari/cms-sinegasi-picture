# Ekspor Data

Ekspor data ke PDF/CSV dengan batasan sesuai peran pengguna.

## Spesifikasi

### Tujuan
Memungkinkan pengguna mengekspor data (laporan kas, absensi, nilai, alat, peminjaman, atau tugas lomba) ke file PDF/CSV sesuai peran, agar mudah diarsipkan atau dibagikan.

### Selesai bila
- Pengguna dapat membuka menu Ekspor, memilih jenis data, format PDF/CSV, serta rentang waktu (jika relevan), lalu mengunduh file.
- File hasil ekspor berisi data yang sama dengan yang terlihat di aplikasi dan dapat dibuka dengan benar di pembaca PDF atau aplikasi spreadsheet.
- Hak akses ekspor mengikuti peran: siswa hanya bisa mengekspor data miliknya sendiri; staf hanya bisa mengekspor modul sesuai matriks peran (misalnya bendahara mengekspor kas, sekretaris mengekspor absensi/nilai).
- Saat mengekspor CSV, sel yang diawali karakter rumus (=, +, -, @) diberi tanda kutip tunggal di depannya sehingga aman dibuka di Excel/Spreadsheet.
- Jika data kosong atau pengguna tidak berhak, muncul pesan yang jelas tanpa membuat aplikasi error.

## Task

### 1. Buat halaman ekspor data dengan form pilihan

### 2. Implementasikan ekspor CSV dengan proteksi formula

### 3. Buat generator PDF dari data tiruan

### 4. Terapkan batasan peran dan notifikasi error

### 5. Buat endpoint API ekspor dengan otorisasi peran

### 6. Buat sanitasi CSV untuk cegah formula injection

### 7. Buat generator PDF server untuk ekspor data

### 8. Buat penanganan error akses dan data kosong
