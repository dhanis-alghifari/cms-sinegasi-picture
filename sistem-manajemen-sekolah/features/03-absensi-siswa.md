# Absensi Siswa

Catat kehadiran siswa setiap hari dengan cepat.

## Sub-fitur: Input Kehadiran

Tandai siswa hadir, sakit, izin, atau alpha; cegah input ganda pada tanggal yang sama; entri terkunci otomatis setelah 48 jam.

## Sub-fitur: Daftar Hadir

Lihat rekap kehadiran berdasarkan tanggal.

## Sub-fitur: Rekap Bulanan

Lihat persentase kehadiran setiap siswa per bulan.

## Sub-fitur: Upload Foto Siswa

Unggah foto profil siswa dengan kompresi sisi klien ke Cloudflare R2 Private Bucket.

### Tujuan
Memberi pengurus kelas atau guru cara mengunggah dan memperbarui foto profil siswa agar siswa mudah dikenali saat absensi atau peminjaman.

### Selesai bila
- Pengguna dapat memilih file gambar dari HP/komputer untuk seorang siswa, lalu foto tersebut tampil sebagai profil siswa.
- Pengguna dapat mengganti foto siswa yang sudah ada; setelah diganti, foto baru yang tampil, bukan foto lama.
- Foto yang diunggah tetap muncul setelah halaman dibuka ulang, tersimpan permanen di Cloudflare R2, dan data foto tersimpan di database.

## Sub-fitur: Nonaktifkan Siswa

Nonaktifkan siswa yang tidak aktif tanpa menghapus datanya, agar riwayat absensi, kas, nilai, dan peminjaman tetap tersimpan.

### Tujuan
Memberi pengurus/guru cara menonaktifkan siswa yang tidak aktif tanpa menghapus datanya, agar riwayat absensi dan peminjaman siswa tersebut tetap tersimpan dan laporan tetap akurat.

### Selesai bila
- Pengurus dapat menandai seorang siswa sebagai nonaktif dari halaman daftar/detail siswa.
- Siswa yang dinonaktifkan tidak lagi muncul di daftar siswa aktif, form absensi harian, atau daftar peminjam saat membuat peminjaman baru.
- Seluruh riwayat absensi dan peminjaman siswa yang dinonaktifkan tetap tersimpan dan masih bisa dilihat di laporan/rekap.
- Pengurus dapat mengaktifkan kembali siswa yang sudah dinonaktifkan, dan siswa tersebut langsung muncul kembali di daftar aktif.
- Tampilan daftar siswa memberi tanda jelas (mis. label "Nonaktif") untuk siswa yang sudah dinonaktifkan.

## Sub-fitur: Koreksi Guru Pasca-Lock

Guru atau admin dapat mengoreksi absensi setelah 48 jam melalui mekanisme adjustment entry dengan change_reason, bukan overwrite diam-diam.

### Tujuan
Memberi guru/admin cara mengoreksi absensi siswa yang sudah lewat 48 jam secara transparan, dengan alasan yang merekam status lama dan status baru.

### Selesai bila
- Hanya pengguna dengan peran Teacher/Admin yang dapat membuka menu koreksi absensi pasca-lock; pengguna lain tidak melihat akses ini.
- Guru/admin memilih siswa dan tanggal terkunci, lalu mengubah status (hadir/sakit/izin/alpha); form menampilkan status lama dan status baru beserta kolom alasan wajib (minimal 5 karakter) yang berisi status lama dan baru.
- Setelah disimpan, data absensi menampilkan status baru, sedangkan riwayat audit mencatat perubahan (pengguna, waktu, status lama, status baru, alasan) dan catatan absensi asli tetap tersimpan.

## Sub-fitur: Manajemen Data Siswa

Kelola data master siswa secara terpusat (khusus Guru dan Sekretaris), termasuk pendaftaran individual dan profil lengkap.

### Tujuan
Mengelola data master siswa secara terpusat agar data siswa lengkap, akurat, dan mudah diakses untuk mendukung absensi, kas, nilai, peminjaman alat, dan penugasan lomba.

### Selesai bila
- Pengguna dapat melihat daftar siswa terpusat dan membuka halaman detail/profil setiap siswa.
- Data siswa baru dapat ditambahkan melalui form pendaftaran individual yang mencakup semua field penting.
- Setiap siswa memiliki profil lengkap yang menampilkan informasi pribadi dan foto profil.
- Data siswa yang tidak aktif dapat dinonaktifkan tanpa menghapus riwayatnya.

## Sub-fitur: Profil Siswa Hirarkis

Menampilkan profil siswa dengan akses bertingkat: ketua/wakil/sekretaris/bendahara hanya melihat data dasar, sedangkan guru melihat tab nilai, absensi, dan riwayat aktivitas.

### Tujuan
Agar pengurus dan guru dapat melihat informasi siswa sesuai perannya: pengurus hanya melihat data dasar, sedangkan guru dapat memeriksa riwayat nilai, absensi, dan aktivitas siswa untuk memantau perkembangan dan kredibilitas data.

### Selesai bila
- Halaman profil siswa menampilkan data dasar (nama, NIS, kelas, peminatan, nomor telepon, dan foto profil) untuk pengguna dengan peran ketua/wakil/sekretaris/bendahara.
- Pengguna dengan peran guru melihat data dasar plus tiga tab: "Nilai", "Absensi", dan "Aktivitas".
- Tab Nilai menampilkan riwayat penilaian siswa; Tab Absensi menampilkan rekap kehadiran bulanan dan persentase; Tab Aktivitas menampilkan log aktivitas siswa di aplikasi.
- Pengguna tanpa hak akses (misalnya anggota biasa) tidak dapat membuka halaman profil siswa dan mendapat pesan penolakan akses.
- Informasi yang tampil sesuai data terbaru yang tersimpan di sistem.

## Sub-fitur: Validasi NIS Unik

Validasi saat pendaftaran siswa baru untuk memastikan Nomor Induk Siswa tidak duplikat di dalam sistem.

### Tujuan
Memastikan Nomor Induk Siswa (NIS) yang dimasukkan saat pendaftaran siswa baru tidak boleh sama dengan NIS siswa lain yang sudah terdaftar, agar data siswa bersih dari duplikat.

### Selesai bila
- Saat mengisi form pendaftaran siswa, jika NIS sudah dipakai siswa lain (aktif maupun nonaktif), sistem menampilkan pesan error yang jelas dan menolak penyimpanan.
- Pengecekan NIS dilakukan otomatis saat pengguna selesai mengetik NIS (tanpa harus menunggu tombol simpan) dan juga diperiksa kembali saat data dikirim ke server.
- NIS dengan huruf besar/kecil dianggap sama (misalnya "abc" dan "ABC" dianggap duplikat).
- Hanya data siswa baru yang gagal disimpan karena NIS duplikat; data siswa lain tidak terpengaruh.

## Sub-fitur: Koreksi Pasca-Lock oleh Guru

Guru/admin dapat mengoreksi absensi dan kas setelah 48 jam melalui mekanisme adjustment entry dengan change_reason.

### Tujuan
Memberi guru/admin cara memperbaiki kesalahan pencatatan absensi dan kas yang sudah lewat batas 48 jam tanpa mengubah catatan asli, dengan tetap mewajibkan alasan agar transparan dan dapat diaudit.

### Selesai bila
- Pada data absensi dan transaksi kas yang berusia lebih dari 48 jam, guru/admin dapat memilih opsi "Koreksi" dan sistem meminta alasan tertulis (minimal 5 karakter) sebelum tersimpan.
- Data asli tidak pernah diubah/dihapus; koreksi tersimpan sebagai catatan penyesuaian terpisah, dan riwayat menampilkan data lama, data baru, pengoreksi, waktu, serta alasan.
- Jika alasan kosong atau kurang dari 5 karakter, sistem menolak penyimpanan dan menampilkan pesan kesalahan.
- Fitur ini hanya tersedia untuk peran Guru/Admin; pengguna dengan peran lain tidak melihat opsi koreksi.

## Task

### 1. Buat halaman daftar siswa dengan data tiruan

### 2. Buat halaman utama koreksi absensi

### 3. Buat layout profil siswa dengan data tiruan

### 4. Buat halaman daftar siswa dengan data tiruan

### 5. Buat halaman form pendaftaran dengan data tiruan

### 6. Buat halaman daftar siswa dengan tombol unggah

### 7. Buat halaman koreksi dengan data tiruan

### 8. Buat form koreksi status dengan validasi alasan

### 9. Buat komponen pilih file dan pratinjau

### 10. Terapkan kontrol akses peran dan tab guru

### 11. Buat halaman form pendaftaran siswa dengan validasi

### 12. Tambahkan validasi NIS duplikat real-time

### 13. Tambahkan aksi nonaktif dan aktifkan siswa

### 14. Tampilkan tombol Koreksi untuk data terkunci

### 15. Simulasikan penyimpanan koreksi dan perbarui daftar

### 16. Buat halaman profil siswa dengan aksi nonaktifkan

### 17. Buat halaman detail siswa dengan mock

### 18. Buat modal koreksi dengan validasi alasan

### 19. Isi tab Nilai dengan data tiruan

### 20. Terapkan state foto baru pada kartu siswa

### 21. Buat migrasi indeks unik NIS case-insensitive

### 22. Terapkan kontrol akses menu berdasarkan peran

### 23. Buat riwayat penyesuaian dan atur akses

### 24. Saring siswa aktif pada form absensi

### 25. Buat skema tabel siswa dan migrasi Supabase

### 26. Buat endpoint cek ketersediaan NIS

### 27. Buat migrasi kolom photo_url tabel siswa

### 28. Isi tab Absensi dengan rekap bulanan tiruan

### 29. Saring siswa aktif pada daftar peminjam

### 30. Buat service Cloudflare R2 untuk upload

### 31. Isi tab Aktivitas dengan log tiruan

### 32. Buat validasi NIS saat simpan data siswa

### 33. Buat API upload foto profil siswa

### 34. Buat tabel koreksi absensi dan riwayat audit

### 35. Buat tabel adjustment_entries dan migrasi

### 36. Buat API tambah siswa dengan NIS unik

### 37. Buat endpoint upload foto siswa

### 38. Buat migrasi tabel nilai absensi aktivitas

### 39. Buat API koreksi dan riwayat dengan otorisasi

### 40. Tambahkan kolom is_active pada tabel siswa

### 41. Buat endpoint GET daftar absensi terkunci

### 42. Buat API ambil daftar dan detail siswa

### 43. Buat endpoint profil siswa dengan otorisasi

### 44. Buat endpoint POST submit koreksi dengan transaksi

### 45. Perbarui endpoint siswa dengan photo_url

### 46. Buat endpoint API untuk ubah status siswa

### 47. Saring siswa aktif pada API absensi

### 48. Buat endpoint GET riwayat audit koreksi

### 49. Buat endpoint nilai siswa khusus guru

### 50. Buat API nonaktifkan siswa

### 51. Buat endpoint rekap absensi dan persentase

### 52. Saring siswa aktif pada API peminjaman

### 53. Buat endpoint log aktivitas siswa guru
