# Peminjaman Alat

Pinjam dan kembalikan alat dengan mudah, termasuk via QR.

## Sub-fitur: Pinjam via QR

Scan QR pada alat untuk meminjam secara cepat; jika QR tidak terbaca, pengguna dapat mencari alat sebagai cadangan.

## Sub-fitur: Peminjaman Manual

Pilih alat dari daftar jika tidak bisa scan.

## Sub-fitur: Pengembalian per Item

Kembalikan alat satu per satu dari satu transaksi; alat yang baik tersedia kembali, alat rusak/hilang dicatat dan terkunci.

## Sub-fitur: Riwayat Peminjaman

Lihat daftar peminjaman yang sedang berjalan, menunggu persetujuan, dan selesai.

## Sub-fitur: Alur Persetujuan Peminjaman

Pengajuan pinjam eksklusif oleh Leader, Vice, dan Equipment Team; persetujuan akhir dilakukan eksklusif hanya oleh Guru.

### Tujuan
Siswa dapat mengajukan peminjaman alat dan guru/ketua atau petugas alat yang berwenang dapat menyetujui atau menolaknya, dengan status awal "Menunggu", agar peminjaman alat terkontrol dan transparan.

### Selesai bila
- Siswa dapat mengajukan peminjaman alat, dan pengajuan langsung tampil dengan status "Menunggu" di daftar peminjaman.
- Pengguna yang berwenang (guru/ketua/petugas alat) dapat melihat daftar pengajuan yang menunggu beserta detail peminjam, alat, tanggal pinjam, dan tanggal jatuh tempo.
- Pengguna yang berwenang dapat menyetujui atau menolak pengajuan; penolakan wajib disertai alasan singkat.
- Setelah disetujui, status peminjaman berubah menjadi "Berjalan" dan alat berstatus "Dipinjam"; setelah ditolak, status menjadi "Ditolak" dan alat tetap tersedia.
- Siswa peminjam mendapat pemberitahuan di aplikasi mengenai hasil persetujuan atau penolakan.
- Tampilan aplikasi menyediakan tombol aksi yang jelas (Setujui/Tolak) dan status pengajuan yang mudah dibedakan secara visual.

## Sub-fitur: Peringatan Telat Kembali

Tampilkan tanda merah berdenyut pada peminjaman yang melewati tanggal jatuh tempo.

### Tujuan
Menandai peminjaman yang melewati jatuh tempo dengan tanda merah berdenyut agar pengurus segera menindaklanjuti keterlambatan.

### Selesai bila
- Peminjaman yang tanggal jatuh temponya sudah lewat (menurut waktu server) mendapat badge/label merah berdenyut bertuliskan "Telat".
- Badge muncul di daftar peminjaman aktif dan detail peminjaman tanpa perlu mengubah data.
- Badge hilang secara otomatis ketika peminjaman tidak lagi telat (misal sudah dikembalikan atau jatuh tempo diperbarui).
- Status peminjaman tetap akurat meskipun halaman dibuka dari perangkat yang waktu lokalnya berbeda.

## Sub-fitur: Kontrol Konkurensi

Mencegah dua siswa meminjam alat yang sama secara bersamaan dengan mengunci data peminjaman.

### Tujuan
Mencegah dua siswa meminjam alat yang sama secara bersamaan sehingga alat tidak bisa diklaim ganda.

### Selesai bila
- Saat dua siswa mengajukan peminjaman alat yang sama hampir bersamaan, hanya satu pengajuan yang berhasil; pengajuan lainnya ditolak dengan pesan bahwa alat sedang tidak tersedia.
- Setelah pengajuan disetujui, alat otomatis berstatus 'dipinjam' dan tidak muncul sebagai alat tersedia untuk diajukan siswa lain sampai dikembalikan.
- Sistem mencegah peminjaman alat yang sama dengan periode yang tumpang tindih, dan catatan peminjaman tidak pernah duplikat.

## Sub-fitur: Approval Inbox

Pusat persetujuan peminjaman dan verifikasi pengembalian alat untuk Guru/Admin; setiap keputusan setujui/tolak wajib disertai alasan dan tercatat di audit.

### Tujuan
Menjadi pusat notifikasi dan persetujuan bagi Guru, Admin, dan Tim Alat untuk menyetujui/menolak permintaan peminjaman serta memverifikasi klaim pengembalian alat, dengan setiap keputusan tercatat lengkap.

### Selesai bila
- Guru, Admin, dan Tim Alat memiliki halaman Approval Inbox yang menampilkan semua item berstatus Pending Approval dalam dua kelompok: 'Peminjaman Baru' dan 'Klaim Pengembalian'.
- Setiap item menampilkan nama peminjam, alat yang diajukan, tanggal pinjam/jatuh tempo (atau tanggal kembali), dan status saat ini.
- Tersedia tombol Approve dan Reject langsung di baris item; keduanya meminta alasan perubahan minimal 5 karakter sebelum diproses.
- Status alat berubah otomatis setelah Approve: peminjaman → 'Dipinjam', pengembalian → 'Tersedia'; Reject tidak mengubah status alat.
- Riwayat keputusan (siapa, kapan, approve/reject, alasan) tercatat di audit log yang tidak dapat diubah/dihapus.

## Sub-fitur: Histori Approval

Menampilkan riwayat keputusan peminjaman (siapa, kapan, status, alasan) yang bersumber dari activity_logs.

### Tujuan
Memungkinkan pengguna melihat riwayat lengkap keputusan persetujuan/penolakan peminjaman alat (siapa, kapan, status, alasan) yang bersumber dari activity_logs, agar transparan dan dapat dipertanggungjawabkan.

### Selesai bila
- Di halaman detail peminjaman terdapat bagian "Riwayat Approval" yang menampilkan semua keputusan untuk peminjaman tersebut.
- Setiap entri riwayat menampilkan nama pengapprove, waktu keputusan, status keputusan (Approve/Reject), dan change_reason (alasan) yang diambil dari activity_logs.
- Riwayat hanya dapat dibaca dan tidak dapat diubah/dihapus oleh pengguna mana pun.
- Jika belum ada riwayat keputusan, ditampilkan pesan "Belum ada riwayat approval."

## Sub-fitur: Pemeriksaan Keterlambatan Otomatis

Tugas terjadwal memeriksa peminjaman yang melewati jatuh tempo, mengirim notifikasi push kepada peminjam dan pengurus, serta mencatatnya di log audit dengan alasan 'SYSTEM:OVERDUE_CHECK'.

### Tujuan
Menjamin setiap peminjaman alat yang melewati jatuh tempo segera diketahui dengan pemeriksaan otomatis terjadwal, pengiriman notifikasi kepada peminjam dan pengurus, serta pencatatan permanen di audit log.

### Selesai bila
- Sistem secara otomatis dan berkala memeriksa seluruh peminjaman, lalu menemukan peminjaman yang melewati tanggal jatuh tempo.
- Peminjam dan pengurus (minimal guru/ketua) menerima notifikasi untuk setiap peminjaman yang terlambat.
- Seluruh hasil pemeriksaan dan pengiriman notifikasi tercatat di log audit dengan alasan `SYSTEM:OVERDUE_CHECK` dan tidak dapat diubah/dihapus.
- Tidak ada peminjaman telat yang terlewat, dan pemeriksaan berjalan tanpa perlu tindakan manual.

## Sub-fitur: Notifikasi Overdue Otomatis

Background worker yang mengirim notifikasi push otomatis kepada peminjam dan ketua saat alat melewati batas waktu kembali.

### Tujuan
Sistem secara otomatis mendeteksi peminjaman alat yang melewati batas waktu kembali dan mengirim notifikasi kepada peminjam serta ketua agar keterlambatan segera ditindaklanjuti.

### Selesai bila
- Peminjaman yang melewati batas waktu kembali terdeteksi secara otomatis melalui pemeriksaan berkala tanpa perlu membuka aplikasi.
- Peminjam dan ketua menerima notifikasi yang mencantumkan nama alat, tanggal jatuh tempo, dan lama keterlambatan.
- Tidak ada notifikasi terkirim untuk peminjaman yang masih dalam batas waktu atau sudah dikembalikan.
- Notifikasi keterlambatan yang terkirim tercatat dalam riwayat aktivitas sehingga dapat ditelusuri.

## Sub-fitur: Background Worker Overdue Otomatis

Sistem background worker yang berjalan otomatis sesuai waktu server untuk mengecek keterlambatan, mengirim notifikasi, dan mencatat log sistem.

### Tujuan
Sistem ini menjaga alat yang dipinjam tidak telat dikembalikan tanpa harus dicek manual, dengan memantau waktu server secara otomatis, mengingatkan peminjam/penanggung jawab, dan meninggalkan jejak sistem.

### Selesai bila
- Sistem berjalan otomatis pada waktu yang ditentukan server dan memeriksa semua peminjaman aktif.
- Setiap peminjaman yang melewati batas waktu pengembalian terdeteksi dan pengguna terkait (peminjam dan/atau ketua) menerima notifikasi keterlambatan.
- Setiap pemeriksaan dan pengiriman notifikasi tercatat dalam log sistem yang tidak bisa diubah, dengan alasan 'SYSTEM:OVERDUE_CHECK'.

## Sub-fitur: Peminjaman via QR & Fuzzy Search

Memungkinkan peminjaman cepat melalui scan QR atau pencarian manual menggunakan pg_trgm fuzzy search sebagai fallback.

## Sub-fitur: Monitoring Alat & Foto Kondisi

Pantau kondisi fisik dan ketersediaan alat secara terpisah; wajib upload minimal 3 foto kondisi saat input alat baru.

## Sub-fitur: Persetujuan Eksklusif Guru

Alur persetujuan peminjaman alat di mana pengajuan dilakukan oleh tim alat/leader namun persetujuan akhir wajib oleh Guru.

## Sub-fitur: Pengembalian Alat per Item

Mendukung pengembalian sebagian alat dalam satu paket transaksi dengan pencatatan kondisi masing-masing item.

## Task

### 1. Buat halaman riwayat notifikasi dengan data tiruan

### 2. Bangun halaman monitoring keterlambatan

### 3. Buat daftar peminjaman aktif dengan data tiruan

### 4. Buat tampilan Riwayat Approval di halaman peminjaman

### 5. Buat dashboard pemantauan overdue dengan data tiruan

### 6. Bangun halaman Approval Inbox dengan data tiruan

### 7. Buat halaman daftar peminjaman dengan data tiruan

### 8. Buat halaman daftar alat dan form pinjam

### 9. Simulasikan status alat dan penolakan pinjam

### 10. Buat formulir pengajuan peminjaman alat

### 11. Buat komponen log audit dengan data tiruan

### 12. Buat tabel notifikasi keterlambatan di Supabase

### 13. Buat komponen badge Telat merah berdenyut

### 14. Tambahkan empty state dan mode baca-saja

### 15. Implementasi aksi approve/reject dengan modal alasan

### 16. Tampilkan detail log dan filter notifikasi overdue

### 17. Tampilkan badge Telat pada daftar peminjaman

### 18. Buat tabel log_sistem dan migrasi

### 19. Buat tabel peminjaman dengan constraint anti-overlap

### 20. Buat komponen status notifikasi pengirim

### 21. Buat fungsi query riwayat approval dari activity_logs

### 22. Buat query deteksi peminjaman terlambat

### 23. Buat panel detail pengajuan untuk petugas

### 24. Buat komponen notifikasi real-time dengan badge

### 25. Buat fungsi database untuk peminjaman atomik

### 26. Buat modal konfirmasi setujui atau tolak

### 27. Buat service deteksi peminjaman terlambat

### 28. Tambahkan quick action approve/reject pada notifikasi

### 29. Buat route API riwayat approval

### 30. Tampilkan badge Telat pada detail peminjaman

### 31. Buat worker kirim notifikasi overdue berkala

### 32. Buat tabel log audit dan migrasi

### 33. Buat fungsi perhitungan telat memakai waktu server

### 34. Buat API endpoint pengajuan peminjaman

### 35. Buat indikator status dan notifikasi hasil

### 36. Buat skema DB approval, notifikasi, audit log

### 37. Cegah notifikasi duplikat untuk peminjaman sama

### 38. Buat service pemeriksaan peminjaman terlambat

### 39. Buat worker terjadwal jalankan overdue check

### 40. Buat endpoint daftar approval inbox per kelompok

### 41. Buat tabel peminjaman dan migrasi Supabase

### 42. Buat API endpoint riwayat notifikasi

### 43. Buat service pengiriman notifikasi push

### 44. Buat API endpoint persetujuan dan pengembalian

### 45. Terapkan status telat pada API peminjaman

### 46. Kirim notifikasi keterlambatan ke pengguna

### 47. Buat API pengajuan peminjaman oleh siswa

### 48. Catat hasil pemeriksaan ke log audit

### 49. Buat endpoint approve/reject dengan transaksi status

### 50. Buat API endpoint daftar alat tersedia

### 51. Catat log sistem hasil overdue check

### 52. Buat API daftar dan detail pengajuan

### 53. Buat penjadwalan otomatis pemeriksaan

### 54. Buat publish notifikasi real-time dan endpoint notifikasi

### 55. Buat endpoint audit log immutable

### 56. Buat API setujui atau tolak peminjaman

### 57. Buat notifikasi in-app hasil peminjaman
