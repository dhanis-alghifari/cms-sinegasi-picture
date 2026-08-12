# Dashboard Utama

Halaman pertama setelah login yang menampilkan ringkasan kas, absensi, status alat, dashboard pribadi siswa, notifikasi, dan tombol cepat.

## Sub-fitur: Ringkasan Kas

Menampilkan saldo kas terakhir dan transaksi terbaru.

## Sub-fitur: Ringkasan Absensi

Menampilkan jumlah siswa hadir, sakit, izin, dan alpha hari ini.

## Sub-fitur: Status Alat

Menampilkan alat yang sedang dipinjam, rusak, atau dalam pemeliharaan (maintenance).

## Sub-fitur: Tombol Cepat

Tombol langsung ke input kas, absensi, peminjaman, atau tugas lomba sesuai batasan peran.

## Sub-fitur: Dashboard Pribadi Siswa

Menampilkan ringkasan pribadi siswa: detail kehadiran mingguan, riwayat pembayaran kas, total tunggakan iuran, riwayat nilai tugas pribadi, peminjaman aktif, dan tugas lomba yang diberikan.

### Tujuan
Memberi siswa satu tampilan ringkas yang memadukan data pribadinya (kehadiran, tunggakan kas, nilai terakhir, peminjaman aktif, dan tugas lomba) agar ia bisa memantau statusnya tanpa membuka tiap modul.

### Selesai bila
- Dashboard pribadi hanya menampilkan data milik siswa yang sedang login.
- Ada kartu Ringkasan Kehadiran berisi rekap bulan berjalan (hadir/sakit/izin/alpha) dan persentase kehadiran.
- Ada kartu Tunggakan Kas berisi total iuran belum lunas dan status pembayaran terakhir.
- Ada kartu Nilai Terakhir berisi nilai/predikat terbaru, keterangan, dan tanggal penilaian.
- Ada kartu Peminjaman Aktif berisi daftar alat yang sedang dipinjam beserta jatuh tempo, dan kartu Tugas Lomba berisi tugas yang diberikan beserta status progres.

## Sub-fitur: Notifikasi

Menampilkan daftar notifikasi terbaru, termasuk peringatan alat telat kembali.

### Tujuan
Fitur ini memberi pengguna satu tempat untuk melihat pemberitahuan terbaru yang relevan, termasuk peringatan alat yang telat dikembalikan, agar tidak ada info penting yang terlewat.

### Selesai bila
- Halaman Notifikasi menampilkan daftar notifikasi terbaru ke terlama, dengan judul, pesan, dan waktu (menggunakan waktu server).
- Setiap notifikasi dapat ditandai sudah dibaca; jumlah notifikasi belum dibaca terlihat jelas (misal badge di menu).
- Peringatan alat telat kembali muncul otomatis di daftar notifikasi untuk pengguna terkait dan memuat nama alat serta tanggal jatuh tempo.
- Notifikasi yang baru masuk muncul di daftar tanpa perlu refresh manual (atau ada indikator pemuatan terbaru yang jelas).
- Tampilan daftar kosong (atau tidak ada notifikasi) memberi pesan yang jelas, bukan halaman error.

## Sub-fitur: Ringkasan Distribusi Nilai

Menampilkan ringkasan jumlah siswa dengan nilai A/B/C/D/E per kategori kegiatan di halaman utama untuk Guru/Admin.

### Tujuan
Memberi Guru/Admin gambaran cepat sebaran nilai siswa (A–E) per kategori kegiatan langsung di dashboard utama.

### Selesai bila
- Di dashboard utama Guru/Admin muncul ringkasan jumlah siswa untuk masing-masing nilai A, B, C, D, dan E.
- Ringkasan dapat dikelompokkan per kategori kegiatan (Kelas, Crew Film, Event, Lainnya) atau menampilkan seluruh kategori sekaligus.
- Angka yang ditampilkan sesuai data nilai terbaru dan langsung diperbarui tanpa refresh manual saat ada perubahan penilaian.
- Tampilan ringkas dan mudah dibaca (misalnya kartu atau grafik kecil) di halaman utama.

## Task

### 1. Buat layout dashboard ringkasan distribusi nilai (mock)

### 2. Buat halaman daftar notifikasi dengan data tiruan

### 3. Buat halaman dashboard pribadi dengan data tiruan

### 4. Buat kartu ringkasan kehadiran dengan data tiruan

### 5. Buat komponen kartu distribusi nilai A-E

### 6. Buat badge belum dibaca dan tandai dibaca

### 7. Buat keadaan kosong halaman notifikasi

### 8. Buat filter kategori kegiatan pada ringkasan

### 9. Buat kartu tunggakan kas dengan data tiruan

### 10. Simulasikan pembaruan data real-time pada ringkasan

### 11. Buat kartu nilai terakhir dengan data tiruan

### 12. Buat indikator pemuatan notifikasi terbaru

### 13. Buat tabel notifikasi dan migrasi Supabase

### 14. Buat kartu peminjaman aktif dan tugas lomba

### 15. Buat migrasi tabel nilai siswa di Supabase

### 16. Rapikan responsivitas dan empty state dashboard

### 17. Buat API ringkasan nilai per kategori

### 18. Buat API notifikasi pengguna terurut waktu server

### 19. Buat migrasi tabel dashboard siswa di Supabase

### 20. Buat endpoint tandai dibaca dan jumlah unread

### 21. Aktifkan realtime Supabase untuk tabel nilai

### 22. Buat endpoint ringkasan dashboard per siswa

### 23. Buat pemicu otomatis notifikasi alat telat kembali

### 24. Terapkan autentikasi dan otorisasi data siswa

### 25. Sediakan polling atau realtime notifikasi baru

### 26. Seed data contoh untuk pengembangan frontend
