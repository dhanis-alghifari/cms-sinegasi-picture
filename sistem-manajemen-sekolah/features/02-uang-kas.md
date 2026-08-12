# Uang Kas

Kelola pemasukan, pengeluaran, saldo kas, dan iuran/tunggakan siswa.

## Spesifikasi

Fitur pengelolaan kas yang mencakup:
1. Pengaturan Iuran Mingguan: Nominal iuran wajib otomatis.
2. Input Transaksi Masuk: 
   - Pembayaran iuran siswa (otomatis hitung hutang/debt jika kurang).
   - Pemasukan lain-lain.
3. Input Transaksi Keluar (Pengeluaran): 
   - Form input dua tahap: Nominal yang dibutuhkan dan Rincian/Nama Pengeluaran (untuk beli apa).
   - Validasi saldo: Menolak pengeluaran jika saldo kas tidak mencukupi.
4. History Arus Kas: Daftar transaksi masuk dan keluar yang transparan dengan filter periode.
5. Integrasi Audit: Setiap transaksi mencatat 'created_by' dan alasan perubahan di audit log.

## Sub-fitur: Input Transaksi Dua Tahap

Pencatatan pengeluaran wajib melalui dua tahap: (1) Nominal & Validasi Saldo, (2) Keterangan/Nama barang detail.

## Sub-fitur: Riwayat Transaksi

Lihat seluruh catatan transaksi yang pernah dibuat.

## Sub-fitur: Saldo & Laporan

Lihat saldo saat ini dan rekap kas per bulan.

## Sub-fitur: Auto-billing Iuran Mingguan

Sistem membuat tagihan iuran otomatis setiap Senin 00:00 dengan pengaturan rentang tanggal libur semester.

### Tujuan
Membebaskan bendahara dari pencatatan manual dengan membuat tagihan iuran mingguan otomatis setiap Senin, lengkap dengan pengaturan libur semester dan opsi melewati minggu tertentu.

### Selesai bila
- Setiap Senin pukul 00.00 waktu server, sistem otomatis membuat tagihan iuran untuk semua siswa aktif sesuai nominal yang telah ditentukan, tanpa perlu klik manual.
- Halaman pengaturan menampilkan nominal iuran aktif, status libur semester, dan status skip minggu; perubahan pengaturan langsung tersimpan dan langsung memengaruhi tagihan berikutnya.
- Saat toggle libur semester aktif, sistem berhenti membuat tagihan baru sampai toggle dimatikan.
- Saat skip week aktif untuk minggu berjalan, sistem melewati pembuatan tagihan pada minggu itu saja, tanpa menghapus jadwal minggu berikutnya.
- Tagihan otomatis tercatat di riwayat kas sebagai transaksi masuk berlabel jelas (misal "Iuran Mingguan"), dan sistem mencegah tagihan ganda untuk siswa yang sama pada minggu yang sama meskipun proses dijalankan ulang.

## Sub-fitur: Koreksi Kas Pasca-Lock

Koreksi catatan kas setelah 48 jam oleh Guru/Admin melalui entri penyesuaian baru, bukan mengubah transaksi asli, agar riwayat tetap transparan dan dapat diaudit.

### Tujuan
Koreksi kas pasca-lock memungkinkan pengurus/guru memperbaiki kesalahan catatan keuangan yang sudah lewat 48 jam tanpa mengubah transaksi asli, melainkan dengan membuat catatan penyesuaian baru yang transparan dan terekam di audit.

### Selesai bila
- Pengguna dengan akses (Teacher/Leader/Treasurer) dapat memilih transaksi kas yang sudah melewati 48 jam dan memicu koreksi.
- Sistem membuat transaksi penyesuaian baru (debit/kredit) yang terhubung ke transaksi asli, bukan mengubah data transaksi asli.
- Saldo kas dan status tunggakan siswa dihitung ulang dari seluruh riwayat transaksi sehingga mencerminkan hasil koreksi.
- Setiap koreksi wajib disertai alasan spesifik (minimal 5 karakter) dan tercatat dalam audit log immutable.
- Pengguna mendapat konfirmasi ringkas bahwa koreksi berhasil, termasuk nominal penyesuaian dan saldo terbaru.

## Sub-fitur: Sistem Sanggahan (Dispute) dengan Bukti

Siswa dapat menyanggah transaksi kas masuk dengan wajib mengunggah foto bukti pembayaran; dibatasi maksimal 1 kali per transaksi.

### Tujuan
Memberi tahu siswa secara langsung setiap kali ada transaksi kas yang dicatat atas namanya, dan menyediakan tombol sanggah sekali klik agar kesalahan pencatatan bisa segera diungkap dan ditindaklanjuti tanpa mengubah data asli.

### Selesai bila
- Siswa menerima notifikasi (di dalam aplikasi/push) otomatis saat transaksi kas baru dicatat atas namanya, berisi nominal, tanggal, dan keterangan transaksi.
- Pada notifikasi atau detail transaksi tersebut, siswa melihat tombol "Sanggah" yang hanya bisa diklik satu kali; setelah diklik, tombol berubah menjadi terkunci/"Sudah Disanggah".
- Sanggahan tersimpan dan terlihat oleh guru/pengurus pada daftar sanggahan, dan transaksi yang disanggah diberi tanda "disanggah" agar bisa diverifikasi tanpa menghapus atau mengubah catatan aslinya.

## Sub-fitur: Flexible Weekly Auto-Billing

Sistem otomatis setiap Senin pukul 00:00 membuat tagihan iuran mingguan berdasarkan nominal iuran wajib aktif, dengan toggle libur semester dan skip week.

### Tujuan
Sistem membuat tagihan iuran mingguan secara otomatis setiap Senin agar pengurus tidak perlu mencatat manual, dengan fleksibilitas menjeda saat libur semester atau melewati satu minggu tertentu.

### Selesai bila
- Setiap Senin pukul 00:00 waktu server, sistem membuat tagihan iuran mingguan untuk semua siswa aktif sesuai nominal yang dikonfigurasi, dan tagihan tersebut tampil di riwayat/tunggakan siswa.
- Toggle "Libur Semester" yang diaktifkan pengurus menghentikan pembuatan tagihan selama periode libur, dan nonaktif kembali saat libur selesai.
- Toggle "Skip Week" yang diaktifkan sebelum hari Senin menyebabkan satu siklus mingguan dilewati tanpa membuat tagihan; toggle kembali normal setelahnya.
- Proses otomatis berjalan sekali per siklus, tidak ada duplikasi tagihan walau pemicu berjalan lebih dari satu kali (misal karena timeout/retry).
- Pengurus dapat melihat status konfigurasi dan riwayat tagihan otomatis, termasuk kapan terakhir dibuat.

## Sub-fitur: Koreksi Adjustment Guru

Guru dapat mengoreksi kas setelah 48 jam melalui entry adjustment baru, bukan mengubah transaksi asli.

### Tujuan
Memberi Guru cara mengoreksi kesalahan catatan kas yang sudah lewat 48 jam dengan membuat entri penyesuaian baru, bukan mengubah transaksi asli, agar riwayat tetap jujur dan bisa diaudit.

### Selesai bila
- Guru bisa memilih transaksi kas lama dan membuat "entri penyesuaian" baru dari sana; transaksi asli tidak berubah.
- Form penyesuaian meminta arah (tambah/kurangi saldo), jumlah, keterangan, dan alasan perubahan minimal 5 karakter; alasan wajib diisi.
- Setelah disimpan, saldo kas dan riwayat langsung terbarui; transaksi asli tetap tampil seperti sebelumnya.
- Setiap penyesuaian tersimpan di catatan audit (siapa, kapan, sebelum/sesudah, alasan) dan siswa terkait mendapat notifikasi bila menyangkut namanya.

## Sub-fitur: Pengaturan Iuran Wajib

Atur nominal iuran mingguan oleh Guru atau Bendahara; nominal minimal 500 dan setiap perubahan tercatat di log audit.

### Tujuan
Fitur ini memungkinkan Guru atau Bendahara mengatur nominal iuran mingguan yang menjadi dasar tagihan kas siswa, dengan batas minimal 500 dan setiap perubahan tercatat di log audit.

### Selesai bila
- Guru atau Bendahara dapat membuka menu Pengaturan Iuran Wajib dan melihat nominal iuran aktif saat ini.
- Sistem menerima penyimpanan nominal baru hanya jika angka yang dimasukkan 500 atau lebih; jika di bawah 500, muncul pesan penolakan dan data tidak tersimpan.
- Setiap perubahan nominal berhasil disimpan dan langsung tercatat di log audit beserta waktu, pengubah, dan alasan perubahan.
- Nilai iuran terbaru langsung digunakan sebagai acuan perhitungan tagihan/tunggakan kas siswa.

## Sub-fitur: Pencegahan Saldo Negatif

Sistem menolak transaksi pengeluaran jika saldo tidak mencukupi, divalidasi di level backend sebelum transaksi.

## Sub-fitur: Verifikasi Kas Masuk & Dispute

Validasi klaim siswa melalui unggahan foto bukti pembayaran (fisik/transfer) untuk memproses sanggahan transaksi.

## Sub-fitur: Manajemen Hutang Otomatis

Sistem otomatis mencatat selisih pembayaran sebagai tunggakan jika nominal yang dibayar siswa kurang dari iuran wajib.

## Sub-fitur: Fast-Entry Kas Masuk

Bendahara dapat menginput pembayaran iuran dengan cepat tanpa kewajiban mengunggah foto bukti untuk efisiensi di lapangan.

## Task

### 1. Buat halaman koreksi adjustment dengan data tiruan

### 2. Buat halaman daftar transaksi kas yang dapat dikoreksi

### 3. Buat halaman pengaturan auto-billing dengan mock data

### 4. Buat halaman notifikasi transaksi siswa

### 5. Buat halaman pengaturan tagihan mingguan

### 6. Setup Skema Database Kas dan Audit

Membuat tabel untuk iuran, transaksi, pengaturan, dan audit log.

**Prompt:**

```
Buat skema database untuk fitur Uang Kas yang mencakup: 1) Tabel 'kas_settings' (nominal_iuran, status_libur, skip_week_next). 2) Tabel 'transactions' (type: masuk/keluar, category: iuran/lainnya, amount, student_id nullable, note, created_at, created_by). 3) Tabel 'adjustments' untuk koreksi (transaction_id_ref, amount_diff, reason). 4) Tabel 'audit_logs' untuk melacak setiap perubahan data. Pastikan ada constraint nominal iuran minimal 500 dan support idempotency key.
```

### 7. Buat halaman utama Pengaturan Iuran Wajib

### 8. Buat form penyesuaian dengan validasi alasan

### 9. Tambahkan form nominal dan toggle status

### 10. Buat form koreksi dengan alasan dan nominal penyesuaian

### 11. Implementasi toggle libur semester dan skip week

### 12. Implementasi Pengaturan Iuran Wajib

Membuat antarmuka dan API pengaturan iuran mingguan dengan validasi.

**Prompt:**

```
Implementasikan API dan UI untuk pengaturan iuran wajib. Guru/Bendahara dapat mengubah nominal (min. 500). Setiap perubahan harus mencatat 'created_by' dan alasan perubahan ke audit log. Sertakan toggle 'Libur Semester' dan 'Skip Week' pada halaman ini sesuai spec 'Flexible Weekly Auto-Billing'.
```

### 13. Tambah form nominal dan validasi minimal 500

### 14. Buat detail transaksi dan tombol sanggah

### 15. Tampilkan log audit perubahan iuran

### 16. Simulasikan simpan pengaturan dan notifikasi

### 17. Otomasi Tagihan Mingguan (Cron Job)

Sistem otomatis membuat tagihan setiap Senin pukul 00:00.

**Prompt:**

```
Buat job scheduler (cron) yang berjalan setiap Senin pukul 00:00. Job ini harus: 1) Mengecek status 'Libur Semester' dan 'Skip Week' (jika aktif, lewati dan reset skip_week). 2) Membuat tagihan iuran untuk semua siswa aktif berdasarkan nominal aktif. 3) Pastikan idempotensi agar tidak terjadi duplikasi tagihan di minggu yang sama. 4) Catat eksekusi di log riwayat tagihan otomatis.
```

### 18. Buat tampilan konfirmasi hasil koreksi dan saldo terbaru

### 19. Buat halaman daftar sanggahan guru

### 20. Buat tabel riwayat auto-billing dengan data tiruan

### 21. Simulasikan update saldo dan riwayat lokal

### 22. Input Transaksi Manual dan Auto-Debt

Form input transaksi masuk/keluar dengan validasi saldo dan hutang.

**Prompt:**

```
Buat form input transaksi masuk dan keluar. Untuk iuran siswa: jika bayar < nominal wajib, catat selisih sebagai hutang/tunggakan. Untuk pengeluaran: gunakan form dua tahap (nominal lalu rincian) dan validasi agar saldo tidak negatif. Simpan 'created_by' dan gunakan idempotency key untuk setiap submit.
```

### 23. Buat tabel pengaturan iuran dan migrasi

### 24. Buat migrasi tabel sanggahan dan notifikasi

### 25. Buat tabel setting iuran dan log audit

### 26. Buat skema tabel konfigurasi dan riwayat

### 27. Buat tabel penyesuaian kas dan migrasi database

### 28. Tampilkan audit trail dan notifikasi tiruan

### 29. Riwayat Arus Kas dan Filter

Menampilkan daftar transaksi yang transparan dengan filter periode.

**Prompt:**

```
Buat halaman riwayat kas yang menampilkan daftar semua transaksi (masuk/keluar). Tambahkan filter berdasarkan periode tanggal. Pastikan transaksi yang memiliki sanggahan atau hasil koreksi memiliki label/tanda khusus yang jelas.
```

### 30. Buat endpoint daftar transaksi siswa

### 31. Buat API endpoint untuk konfigurasi auto-billing

### 32. Buat migrasi tabel penyesuaian dan audit trail

### 33. Buat API baca dan simpan nominal iuran

### 34. Buat tabel tagihan mingguan unik

### 35. Buat API daftar transaksi yang memenuhi syarat koreksi

### 36. Sistem Koreksi Pasca-Lock (Adjustment)

Fitur koreksi transaksi setelah 48 jam melalui entri baru.

**Prompt:**

```
Implementasikan logika koreksi kas. Jika transaksi > 48 jam, user (Guru/Admin) tidak boleh ubah data asli, melainkan membuat 'Adjustment Entry'. Form wajib meminta alasan (min. 5 karakter). Adjustment ini harus mengupdate saldo total dan status tunggakan siswa terkait tanpa menghapus record lama. Catat ke audit log.
```

### 37. Catat log audit otomatis saat nominal disimpan

### 38. Buat API ambil transaksi dan simpan penyesuaian

### 39. Buat API endpoint untuk riwayat auto-billing

### 40. Buat endpoint sanggah transaksi dengan validasi unik

### 41. Buat API penyesuaian kas dengan validasi alasan

### 42. Buat endpoint API pengaturan tagihan

### 43. Implementasi job auto-billing mingguan yang idempoten

### 44. Buat layanan perhitungan ulang saldo dan tunggakan

### 45. Gunakan nominal iuran terbaru untuk hitung tagihan

### 46. Buat service generate tagihan mingguan

### 47. Buat endpoint daftar sanggahan untuk guru

### 48. Validasi alasan dan otorisasi guru di backend

### 49. Notifikasi dan Sanggahan Siswa

Sistem notifikasi transaksi ke siswa dan fitur sanggah sekali klik.

**Prompt:**

```
Implementasikan sistem notifikasi: setiap transaksi atas nama siswa akan memicu notifikasi ke siswa tersebut. Di detail transaksi/notifikasi, sediakan tombol 'Sanggah'. Atur logika agar tombol hanya bisa diklik sekali (idempotent). Jika disanggah, status transaksi berubah menjadi 'disanggah' dan muncul di dashboard guru untuk verifikasi.
```

### 50. Buat pencatatan audit log immutable untuk koreksi

### 51. Perbarui saldo kas setelah penyesuaian disimpan

### 52. Terapkan logika libur dan skip minggu

### 53. Buat notifikasi otomatis saat transaksi baru

### 54. Buat pencatatan transaksi kas otomatis

### 55. Kirim notifikasi siswa terkait penyesuaian

### 56. Buat cron job otomatis setiap Senin
