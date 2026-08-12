# Notifikasi & Audit Trail

Menyatukan notifikasi push/in-app dan catatan audit yang tidak bisa diubah.

## Spesifikasi

### Tujuan
Menyatukan notifikasi push/in-app dan catatan audit yang tidak bisa diubah agar pengguna selalu tahu perkembangan penting dan setiap perubahan data dapat dilacak secara transparan.

### Selesai bila
- Pengguna menerima notifikasi in-app (dan push jika didukung) untuk transaksi kas, persetujuan peminjaman, alat telat, dan koreksi data; notifikasi yang belum dibaca tampil dengan jumlah di menu/badge.
- Daftar notifikasi dapat dibuka, ditandai sudah dibaca, dan menampilkan waktu serta pesan yang jelas.
- Setiap perubahan data (INSERT/UPDATE/DELETE) tercatat dalam log audit dan log tersebut tidak dapat diubah atau dihapus oleh siapa pun.
- Admin dapat membuka halaman Audit Trail untuk melihat riwayat aksi: siapa, tabel, record, data lama, data baru, alasan, dan waktu.
- Setiap perubahan/penghapusan data wajib diisi alasan minimal 5 karakter; sistem menolak jika alasan tidak diisi atau kurang dari ketentuan.

## Sub-fitur: Pusat Notifikasi

Menerima notifikasi push/in-app untuk transaksi kas, persetujuan peminjaman, alat telat, atau koreksi data.

### Tujuan
Memberi pengguna satu tempat untuk menerima dan melihat semua notifikasi penting dari sistem.

### Selesai bila
- Notifikasi muncul otomatis saat ada transaksi kas dicatat atas nama siswa, peminjaman perlu persetujuan, alat telat kembali, atau ada koreksi data; penerima notifikasi sesuai peran.
- Halaman Pusat Notifikasi menampilkan daftar notifikasi terbaru dengan judul, pesan, waktu, dan status sudah/belum dibaca; jumlah belum dibaca terlihat di menu.
- Pengguna dapat menandai notifikasi sebagai sudah dibaca (satu per satu atau semua).

## Sub-fitur: Jejak Audit Tak Terubah

Mencatat semua perubahan data dan melindungi catatan agar tidak bisa diubah atau dihapus.

### Tujuan
Merekam seluruh jejak perubahan data secara permanen dan melindunginya dari pengubahan atau penghapusan.

### Selesai bila
- Setiap operasi INSERT/UPDATE/DELETE pada tabel data utama otomatis tercatat ke log audit berisi user, aksi, tabel, record, data lama, data baru, dan waktu.
- Catatan log audit tidak dapat diubah atau dihapus oleh aplikasi maupun pengguna mana pun; halaman audit hanya bisa dibaca oleh Admin.
- Halaman Audit Trail menampilkan riwayat yang dapat dicari/difilter, dan setiap entri memperlihatkan detail perubahan lama vs baru.

## Sub-fitur: Zero Silent Edits via SQL Local Settings

Mewajibkan change_reason minimal 5 karakter yang dikirim via SET LOCAL app.change_reason dalam transaksi SQL agar tercatat akurat di log audit.

### Tujuan
Memastikan tidak ada perubahan data yang diam-diam: setiap ubah atau hapus harus disertai alasan yang jelas dan spesifik.

### Selesai bila
- Setiap form yang mengubah atau menghapus data (misal koreksi kas, absensi, nilai, peminjaman) memiliki kolom alasan wajib.
- Sistem menolak penyimpanan jika alasan kosong atau kurang dari 5 karakter, dan menampilkan pesan kesalahan yang jelas.
- Alasan yang diisi ikut tercatat di log audit dan dapat dilihat oleh Admin sebagai bagian dari riwayat perubahan.

## Sub-fitur: Pencegahan Submit Ganda

Mekanisme loading state dan penonaktifan tombol saat submit form untuk mencegah entri ganda akibat koneksi lambat.

### Tujuan
Mencegah pengguna mengirim data yang sama lebih dari sekali saat menyimpan form, terutama ketika koneksi lambat, dengan memberi umpan balik loading dan menonaktifkan tombol submit selama proses berlangsung.

### Selesai bila
- Setiap form yang menyimpan data (kas, absensi, siswa, alat, peminjaman, nilai, lomba, dll.) menampilkan indikator loading pada tombol simpan sejak diklik sampai respons selesai.
- Tombol simpan/kirim menjadi nonaktif (disabled) selama proses submit berlangsung, sehingga tidak bisa diklik berulang kali.
- Pengiriman ganda yang terjadi karena koneksi lambat atau percobaan ganda tidak menghasilkan duplikat data di sistem.
- Setelah submit selesai, tombol kembali normal; jika gagal, tampil pesan kesalahan dan pengguna bisa mencoba lagi.

## Sub-fitur: Immutable Log Protection

Perlindungan tingkat database menggunakan trigger untuk mencegah penghapusan atau perubahan pada tabel log audit.

### Tujuan
Fitur ini ada untuk menjaga catatan aktivitas (log audit) tetap utuh dan tidak bisa diubah atau dihapus, sehingga setiap perubahan data selalu bisa dilacak dan dipercaya.

### Selesai bila
- Catatan log audit yang sudah tercatat tidak dapat diubah isinya atau dihapus oleh siapa pun, termasuk admin.
- Sistem menolak setiap percobaan perubahan atau penghapusan log dan menampilkan pesan bahwa tindakan tersebut tidak diizinkan, sedangkan data asli tetap utuh.
- Seluruh riwayat aktivitas tetap bisa dilihat dari awal hingga akhir tanpa ada bagian yang hilang atau berubah.

## Sub-fitur: Konsistensi Atomik Media & DB

Mekanisme cleanup otomatis yang menghapus file di Cloudflare R2 jika transaksi database gagal, mencegah adanya file sampah (orphaned files).

### Tujuan
Saat pengguna mengunggah media (misalnya foto alat atau bukti lomba) lalu proses penyimpanan datanya gagal, sistem otomatis menghapus file yang sudah terunggah agar tidak ada file sampah yang tertinggal di penyimpanan.

### Selesai bila
- Setiap kali penyimpanan data gagal setelah media berhasil diunggah, media tersebut dihapus otomatis dan tidak dapat diakses lagi.
- Jika proses penyimpanan data berhasil, media tetap tersimpan dan bisa dilihat seperti biasa.
- Tidak ada file yang tertinggal/terbuang di penyimpanan meskipun terjadi kegagalan berulang, sehingga kapasitas penyimpanan tetap bersih.

## Task

### 1. Buat halaman pusat notifikasi dengan data tiruan

### 2. Buat halaman simulasi unggahan media

### 3. Buat halaman contoh form dengan loading

### 4. Buat halaman daftar log audit dengan data tiruan

### 5. Buat komponen tombol simpan reusable

### 6. Buat layanan penghapusan file R2

### 7. Tandai notifikasi sudah dibaca satu per satu dan semua

### 8. Simulasikan penolakan edit dan hapus pada UI log

### 9. Integrasikan cleanup saat transaksi DB gagal

### 10. Buat halaman audit trail dengan data tiruan

### 11. Buat hook manajemen status submit

### 12. Buat tabel audit_log dan migrasi di Supabase

### 13. Buat trigger proteksi update dan delete pada log

### 14. Buat komponen kolom alasan wajib minimal 5 karakter

### 15. Tambah log untuk cleanup media

### 16. Terapkan loading pada form kas, absensi, siswa

### 17. Rancang tabel notifikasi dan audit log

### 18. Terapkan loading ke semua form lainnya

### 19. Buat endpoint API untuk mengambil log audit

### 20. Tulis tes kegagalan berulang upload

### 21. Buat tabel idempotency key dan migrasi

### 22. Buat API notifikasi list, tandai baca, dan jumlah belum dibaca

### 23. Buat trigger audit otomatis untuk INSERT, UPDATE, DELETE

### 24. Buat middleware idempotency untuk API

### 25. Terapkan kebijakan anti ubah/hapus pada log audit

### 26. Terapkan middleware idempotency ke semua endpoint

### 27. Buat API audit trail dengan filter dan detail

### 28. Validasi alasan wajib minimal 5 karakter di server
