# Contest Tracking & Work Distribution

Kelola lomba, distribusi tugas anggota, dan pembaruan progres pengiriman karya film/media secara spesifik dikelola oleh Contest Team.

## Spesifikasi

### Tujuan
Satu tempat untuk mencatat lomba dan membagi tugas kepada anggota beserta tenggat waktunya, sehingga pengurus dapat memantau progres tiap tugas dan anggota tahu apa yang harus dikerjakan.

### Selesai bila
- Pengguna dengan peran yang diizinkan (Teacher/Leader/Contest Team) dapat membuat lomba berisi nama, tanggal, dan deskripsi, lalu melihatnya dalam daftar lomba.
- Dari halaman detail lomba, pengguna dapat membagi pekerjaan menjadi tugas-tugas dengan tenggat waktu dan menunjuk anggota yang bertanggung jawab.
- Setiap tugas memiliki status penyelesaian yang dapat diperbarui, dan halaman lomba menampilkan ringkasan progres.
- Anggota yang ditugaskan dapat melihat tugas yang diberikan kepadanya dari akunnya masing-masing.

## Sub-fitur: Buat Lomba

Catat nama lomba, tanggal, dan deskripsi perlombaan.

### Tujuan
Mencatat lomba baru dengan informasi nama, tanggal, dan deskripsi agar seluruh kegiatan lomba terdokumentasi di satu tempat.

### Selesai bila
- Tersedia menu Buat Lomba dengan formulir yang menerima nama lomba (wajib), tanggal, dan deskripsi, lalu data tersimpan dan muncul di daftar lomba.
- Daftar lomba menampilkan nama, tanggal, dan deskripsi singkat; setiap lomba dapat dibuka untuk melihat detail.
- Nama lomba dan tanggal tidak boleh kosong, dan muncul pesan jelas jika ada yang belum diisi.

## Sub-fitur: Distribusi Tugas

Bagi pekerjaan ke anggota, misal kameraman, editor, atau desainer, dengan tenggat waktu.

### Tujuan
Membagi pekerjaan dalam lomba menjadi tugas-tugas yang jelas, lengkap dengan tenggat waktu dan anggota yang bertanggung jawab.

### Selesai bila
- Pada detail lomba tersedia formulir tambah tugas berisi nama tugas, deskripsi, tenggat, dan pilihan anggota penanggung jawab.
- Satu tugas dapat diberikan ke lebih dari satu anggota, dan daftar tugas menampilkan nama penanggung jawab beserta tenggatnya.
- Tugas yang sudah dibuat dapat diedit atau dihapus hanya oleh pengguna berhak, dan perubahannya langsung terlihat di daftar.

## Sub-fitur: Pantau Progres

Lihat status tugas dan status pengiriman karya: Proses Submit, Sudah Terkirim, Menunggu Pengumuman, Selesai.

### Tujuan
Memantau sejauh mana tiap tugas lomba dikerjakan dan siapa yang bertanggung jawab, sehingga hambatan bisa cepat diketahui.

### Selesai bila
- Halaman detail lomba menampilkan setiap tugas dengan status pengerjaan (misal: belum, sedang dikerjakan, selesai) dan nama anggota penanggung jawab.
- Pengguna berhak dapat mengubah status tugas dari daftar, dan ringkasan progres menampilkan jumlah tugas selesai dibanding total tugas.
- Anggota yang ditugaskan dapat melihat daftar tugas miliknya dan memperbarui status pengerjaannya dari dashboard pribadi.

## Sub-fitur: Input Jumlah Karya

Tentukan jumlah karya yang akan dikirim ke sebuah lomba.

### Tujuan
Fitur ini memungkinkan pengurus menentukan berapa banyak karya yang akan dikirim ke sebuah lomba, sehingga jumlah karya yang direncanakan tercatat dan menjadi dasar pengelolaan karya selanjutnya.

### Selesai bila
- Pada halaman pembuatan/penyuntingan lomba tersedia kolom "Jumlah Karya" yang menerima angka bulat positif.
- Sistem menolak input 0, negatif, atau bukan angka, dengan menampilkan pesan kesalahan yang jelas di dekat kolom.
- Jumlah karya yang dimasukkan tersimpan bersama data lomba dan ditampilkan pada detail lomba setelah disimpan.

## Sub-fitur: Input Detail Karya

Tentukan jenis dan judul untuk setiap karya yang diperlombakan.

### Tujuan
Memudahkan pengurus lomba menentukan jenis dan judul untuk setiap karya yang diperlombakan, sehingga setiap karya terdokumentasi dengan jelas.

### Selesai bila
- Dari halaman lomba, pengguna dapat membuka form 'Detail Karya' untuk mengisi data per karya.
- Untuk setiap karya, tersedia pilihan jenis karya (contoh: Film Pendek, Foto, Animasi) dan kolom judul yang wajib diisi.
- Data jenis dan judul tersimpan; daftar karya pada lomba menampilkan kedua informasi tersebut.
- Karya yang belum lengkap detailnya tampak jelas (misal label 'Belum lengkap'), dan pengguna dapat mengedit detail kapan saja.

## Sub-fitur: Hasil Akhir & Bukti Gambar

Input hasil akhir lomba dengan kewajiban unggah bukti gambar (sertifikat/piala) untuk status Selesai; sistem menolak status Selesai jika bukti tidak ada.

### Tujuan
Memungkinkan pengurus lomba mencatat keterangan hasil akhir pada karya yang berstatus Selesai, agar hasil lomba terdokumentasi dan bisa direkap.

### Selesai bila
- Pengguna dapat membuka detail karya yang berstatus "Selesai" dan melihat kolom untuk mengisi hasil akhir.
- Hasil akhir dapat diisi berupa teks bebas (misalnya "Juara 1", "Harapan", atau "Tidak Juara") lalu disimpan.
- Hasil akhir yang sudah disimpan muncul di detail lomba dan di rekap festival, dan dapat diperbarui dengan alasan singkat.
- Perubahan hasil akhir tercatat di riwayat audit dan tidak bisa dihapus diam-diam.

## Sub-fitur: Dashboard Laporan Prestasi

Ringkasan statistik prestasi: total karya dikirim, karya juara, tidak juara, dan persentase keberhasilan.

### Tujuan
Memberikan ringkasan statistik prestasi yang cepat dan jelas — total karya dikirim, karya juara, karya tidak juara, dan persentase keberhasilan — agar pengurus/guru mudah memantau hasil perlombaan.

### Selesai bila
- Dashboard Laporan Prestasi menampilkan empat angka utama: total karya dikirim, total karya juara, total karya tidak juara, dan persentase keberhasilan.
- Angka-angka tersebut mengikuti filter periode (bulan berjalan, tahun berjalan, atau rentang tanggal kustom) dan dihitung dari data kontes yang tersimpan, bukan diinput manual.
- Jika belum ada karya berstatus selesai, persentase ditampilkan dengan aman (misalnya "0%" atau "—") tanpa error.
- Tampilan ringkasan mudah dibaca dan responsif saat dibuka di HP maupun desktop.

## Sub-fitur: Filter Periodik

Saring laporan prestasi berdasarkan bulan berjalan, tahun berjalan, atau rentang tanggal kustom.

### Tujuan
Memberi pengguna cara cepat menyaring laporan prestasi lomba berdasarkan periode (bulan berjalan, tahun berjalan, atau rentang tanggal kustom) agar data yang dilihat dan diekspor sesuai rentang waktu yang diinginkan.

### Selesai bila
- Di halaman laporan prestasi tersedia kontrol filter periode dengan tiga pilihan: "Bulan Berjalan", "Tahun Berjalan", dan "Rentang Kustom"; saat "Rentang Kustom" dipilih, muncul field tanggal mulai dan tanggal selesai.
- Semua angka pada dashboard laporan (total karya dikirim, karya juara, karya tidak juara, dan win rate) serta tabel rekap festival berubah mengikuti periode aktif, dan label periode aktif ditampilkan jelas di atas laporan.
- Tombol ekspor PDF/CSV menggunakan periode yang sedang aktif dan mencantumkan periode tersebut pada header laporan; perhitungan status "Sudah Terkirim" dan "Selesai" mengikuti filter aktif.
- Filter dapat diubah tanpa memuat ulang halaman, dan pilihan periode tetap terlihat setelah laporan diperbarui.

## Sub-fitur: Rekap Festival

Menampilkan tabel per lomba/festival berisi jumlah karya dikirim, status tiap karya, hasil akhir, keterangan, dan gambar bukti untuk karya berstatus Selesai; festival tanpa hasil tetap tampil dengan status Belum Ada Hasil.

### Tujuan
Menampilkan rekap detail setiap lomba/festival dalam satu tabel sehingga pengguna dapat melihat jumlah karya yang dikirim, status masing-masing karya, hasil akhir, dan keterangan, termasuk festival yang belum ada hasil.

### Selesai bila
- Tabel rekap festival menampilkan satu baris per lomba/festival dengan kolom: nama lomba, jumlah karya dikirim, status setiap karya, hasil akhir, dan keterangan bebas.
- Untuk setiap karya, status ditampilkan (misalnya Proses Submit, Sudah Terkirim, Menunggu Pengumuman, Selesai); hasil akhir (misalnya Juara 1/2/3, Harapan, Tidak Juara) hanya tampil untuk karya berstatus Selesai.
- Festival/lomba yang belum memiliki hasil akhir tetap muncul dengan label "Belum Ada Hasil" dan tidak disembunyikan.
- Jumlah karya dan status yang ditampilkan selalu dihitung ulang dari data lomba yang tersimpan, bukan diketik manual.

## Sub-fitur: Ekspor Laporan Lomba

Unduh rekapitulasi prestasi lomba ke PDF/CSV sesuai filter, dengan header laporan (periode dan nama sekolah) dan pencegahan CSV Injection.

### Tujuan
Memungkinkan pengguna mengunduh rekapitulasi prestasi lomba dalam format PDF/CSV sesuai filter periode yang dipilih, lengkap dengan header laporan dan aman dari injeksi CSV.

### Selesai bila
- Pengguna dapat memilih periode (bulan berjalan, tahun berjalan, atau rentang tanggal kustom) lalu menekan tombol unduh; file yang dihasilkan memuat data sesuai filter.
- File PDF/CSV menampilkan header laporan berisi periode dan nama sekolah, serta tabel rekap per lomba/festival (nama lomba, jumlah karya, status karya, hasil akhir, keterangan).
- Pada file CSV, sel yang diawali karakter formula (=, +, -, @) otomatis diberi tanda kutip tunggal agar tidak dieksekusi sebagai formula oleh spreadsheet.
- Hak unduh mengikuti peran: siswa hanya dapat mengekspor data miliknya sendiri; staf mengikuti matriks akses yang berlaku.

## Sub-fitur: Dashboard Progres Karya

Menampilkan jumlah karya pada tiap tahapan Proses Submit, Sudah Terkirim, Menunggu Pengumuman, dan Selesai, dihitung otomatis dari data lomba.

### Tujuan
Menampilkan ringkasan jumlah karya film pada setiap tahapan proses (Proses Submit, Sudah Terkirim, Menunggu Pengumuman, dan Selesai) yang dihitung otomatis dari data lomba yang tersimpan, sehingga pengguna bisa memantau progres pengiriman karya sekilas.

### Selesai bila
- Halaman Dashboard Progres Karya menampilkan empat indikator/kartu berlabel "Proses Submit", "Sudah Terkirim", "Menunggu Pengumuman", dan "Selesai", masing-masing berisi jumlah karya film yang sesuai dengan status tersebut.
- Jumlah pada setiap tahap dihitung langsung dari data festival/lomba yang tersimpan, bukan diinput manual, dan otomatis terbarui saat data lomba ditambahkan atau diubah.
- Jika belum ada data karya, seluruh indikator menampilkan angka 0 (nol).

## Sub-fitur: Rekap Kemenangan & Kekalahan

Menampilkan daftar lomba yang menang dan yang tidak juara, lengkap dengan nama lomba, lokasi, nama karya, hasil akhir, serta gambar bukti.

### Tujuan
Menampilkan rekap lomba yang menang dan yang tidak juara dalam dua daftar terpisah, lengkap dengan nama lomba, lokasi, nama karya, hasil akhir, dan gambar bukti, agar pengguna mudah melihat prestasi dan evaluasi.

### Selesai bila
- Halaman menampilkan dua daftar terpisah: "Kemenangan" dan "Tidak Juara/Kalah".
- Setiap entri menampilkan nama lomba/festival, lokasi, nama karya, jenis/kategori karya, hasil akhir, dan gambar bukti (jika ada).
- Lomba yang belum selesai tidak muncul di daftar "Tidak Juara/Kalah".
- Hanya data yang sesuai hak akses pengguna yang dapat dilihat; siswa hanya melihat datanya sendiri.

## Sub-fitur: Verifikasi Lomba & Audit Log

Guru/Admin memeriksa data lomba 'Selesai', memverifikasi bukti gambar, dan melacak riwayat perubahan melalui audit log yang tidak bisa diubah.

### Tujuan
Memberi Guru/Admin menu khusus untuk memeriksa data festival/lomba yang sudah berstatus Selesai, memverifikasi keabsahan gambar bukti, dan melihat riwayat audit perubahan agar hasil yang dilaporkan dapat dipercaya.

### Selesai bila
- Guru/Admin dapat membuka daftar festival/lomba berstatus Selesai yang membutuhkan verifikasi, lengkap dengan detail data dan gambar bukti yang diunggah.
- Guru/Admin dapat menilai setiap bukti sebagai Valid atau Tidak Valid beserta catatan/alasan, dan hasil penilaian tersebut tersimpan dan terlihat di data.
- Guru/Admin dapat melihat riwayat audit pada data tersebut: siapa yang menginput/mengubah, kapan, data lama vs data baru, dan alasan perubahan.
- Menu verifikasi hanya tampil dan dapat diakses oleh role Teacher/Admin; role lain tidak melihat menu ini.

## Sub-fitur: Safeguards Anti-Cheat

Proteksi integritas data lomba dengan pembatasan hak hapus guru, kunci data selesai, wajib unggah bukti gambar, dan validasi sisi server.

### Tujuan
Melindungi integritas data lomba dari kecurangan dengan memberlakukan aturan ketat: hanya Teacher/Admin yang dapat menghapus, data berstatus Selesai hanya bisa dihapus oleh Teacher/Admin, wajib unggah bukti gambar, dan semua aturan ditegakkan di sisi server.

### Selesai bila
- Hanya pengguna dengan peran Teacher/Admin yang dapat menghapus data lomba, karya film, atau hasil akhir; pengguna lain tidak melihat opsi hapus dan permintaan hapus dari peran lain ditolak sistem dengan pesan penolakan.
- Data lomba/karya yang berstatus "Selesai" hanya dapat dihapus oleh Teacher/Admin; jika peran lain mencoba, sistem menolak dan mencatat percobaannya di riwayat audit.
- Saat status karya diubah menjadi "Sudah Terkirim" atau "Selesai", pengguna wajib mengunggah gambar bukti (foto/screenshot/sertifikat/surat hasil) sebelum perubahan disimpan; untuk status "Selesai", bukti wajib ada baik karya menang maupun kalah. Tanpa bukti, tombol simpan tidak aktif dan permintaan penyimpanan ditolak.
- Setiap perubahan pada data lomba (hasil akhir, status, keterangan, dll.) mengharuskan pengguna mengisi alasan perubahan minimal 5 karakter yang spesifik; alasan tersimpan di riwayat audit yang tidak dapat diubah.
- Aturan di atas tetap berlaku meskipun pengguna mencoba mengubah data lewat jalur langsung di luar antarmuka aplikasi; sistem tetap memeriksa dan menolak pelanggaran.

## Sub-fitur: Dashboard Progres Karya Pipeline

Visualisasi pipeline status karya film secara real-time dari tahapan Proses Submit hingga Selesai.

### Tujuan
Memberi pengurus/guru visualisasi langsung jumlah karya film pada tiap tahap perlombaan (Proses Submit, Sudah Terkirim, Menunggu Pengumuman, Selesai) agar progres pengiriman mudah dipantau tanpa hitung manual.

### Selesai bila
- Halaman menampilkan pipeline 4 tahap dengan jumlah karya film real-time di setiap tahap, dihitung dari data festival/lomba yang tersimpan (bukan input manual).
- Angka pada pipeline otomatis berubah saat status karya diperbarui, misalnya karya dipindah dari "Proses Submit" ke "Sudah Terkirim".
- Setiap tahap menampilkan label jelas, jumlah karya, dan total keseluruhan karya terlihat.

## Sub-fitur: Keunikan Nama Festival

Nama festival/lomba tidak boleh sama dalam satu periode tahun ajaran (case-insensitive) untuk mencegah redundansi data.

### Tujuan
Mencegah nama festival/lomba yang sama (dianggap sama meski penulisan hurufnya berbeda, misalnya 'Lomba Film' dan 'lomba film') dalam periode tahun ajaran yang sama, agar data kontes tidak redundan dan mudah dibedakan.

### Selesai bila
- Saat pengguna menambah atau mengubah nama festival, sistem otomatis memeriksa apakah sudah ada festival lain dengan nama yang sama pada periode tahun ajaran yang sama; jika ya, penyimpanan ditolak.
- Muncul pesan kesalahan yang jelas di formulir (misalnya 'Nama festival sudah digunakan pada periode ini') dan data tidak tersimpan.
- Nama festival yang sama di periode tahun ajaran berbeda tetap dapat disimpan.

## Sub-fitur: Lock on Finish

Data lomba yang sudah berstatus Selesai tidak dapat dihapus oleh siswa; hanya Guru yang memiliki akses hapus.

### Tujuan
Mencegah data lomba yang sudah berstatus Selesai terhapus oleh siswa, sehingga hasil akhir tetap terjaga dan hanya dapat dihapus oleh Guru.

### Selesai bila
- Siswa/member yang bukan Guru tidak dapat menghapus lomba berstatus Selesai, baik tombol hapus tidak tersedia maupun permintaan hapus ditolak sistem.
- Guru tetap bisa menghapus lomba berstatus Selesai melalui antarmuka.
- Setiap penghapusan oleh Guru dicatat di audit trail dan wajib mengisi alasan (change_reason) sebelum aksi berhasil.
- Data lomba berstatus selain Selesai tetap mengikuti aturan hapus yang ada sebelumnya.

## Sub-fitur: Pantau Status Pipeline

Pantau tahapan karya melalui pipeline: Proses Submit, Sudah Terkirim, Menunggu Pengumuman, dan Selesai secara real-time.

### Tujuan
Memberi pengguna (terutama Contest Team dan Guru) satu tampilan untuk memantau posisi tiap karya/lomba pada pipeline pengerjaan secara real-time, dari Proses Submit hingga Selesai.

### Selesai bila
- Di halaman Pantau Status Pipeline, setiap karya/lomba ditampilkan dengan salah satu status: Proses Submit, Sudah Terkirim, Menunggu Pengumuman, atau Selesai, beserta jumlah karya pada tiap tahap.
- Status berubah sesuai aksi pengguna (misal karya dikirim atau pengumuman selesai) tanpa perlu memuat ulang halaman, dan waktu perubahan status terlihat.
- Pengguna dapat memfilter/melihat pipeline per lomba atau periode, dan karya yang sudah Selesai ditandai jelas (misal label menang/kalah) beserta bukti gambar.
- Tampilan pipeline memakai label dan warna yang konsisten untuk keempat tahap, serta mudah dibaca di layar HP.

## Sub-fitur: Mandatory Image Proof

Sistem menolak perubahan status menjadi Selesai jika bukti gambar (sertifikat/foto piala) tidak tersedia dalam payload.

### Tujuan
Memastikan setiap lomba yang diselesaikan memiliki bukti visual (sertifikat/foto piala) agar hasil akhir dapat diverifikasi.

### Selesai bila
- Saat pengguna mengubah status lomba menjadi "Selesai" (menang/kalah), sistem menolak penyimpanan jika belum ada bukti gambar yang diunggah, dan menampilkan pesan bahwa bukti gambar wajib diisi.
- Tombol simpan pada form perubahan status menjadi "Selesai" baru aktif setelah pengguna berhasil mengunggah minimal satu bukti gambar.
- Setelah status "Selesai" tersimpan, halaman detail lomba menampilkan bukti gambar tersebut bersama informasi status.

## Sub-fitur: Status Pipeline Lomba

Pantau status pengiriman karya melalui pipeline: Proses Submit, Sudah Terkirim, Menunggu Pengumuman, dan Selesai.

### Tujuan
Fitur ini memungkinkan pengurus lomba memantau dan memperbarui posisi pengiriman karya pada setiap lomba melalui alur status yang jelas: Proses Submit, Sudah Terkirim, Menunggu Pengumuman, dan Selesai.

### Selesai bila
- Pengguna dapat melihat status terkini sebuah lomba beserta keempat tahapan pipeline dalam urutan yang benar.
- Status lomba dapat diperbarui mengikuti alur tersebut, dan perubahannya langsung tersimpan serta tampil di daftar/detail lomba.
- Tampilan pipeline menunjukkan status aktif secara visual (misalnya warna/penanda berbeda) sehingga mudah membedakan lomba yang masih berjalan vs sudah selesai.
- Setiap lomba hanya memiliki satu status aktif pada satu waktu, dan perubahan status dicatat dengan alasan sesuai kebijakan transparansi data.

## Sub-fitur: Daftar Karya & Detail

Tentukan jenis dan judul untuk setiap karya yang diperlombakan guna dokumentasi yang jelas per item.

### Tujuan
Mendokumentasikan setiap karya yang dilombakan dengan menentukan jenis dan judul, agar setiap item tercatat jelas dan mudah ditelusuri.

### Selesai bila
- Pengguna dapat menambahkan sebuah karya baru dengan mengisi jenis karya (misalnya film pendek, dokumenter, fotografi) dan judul karya.
- Daftar karya menampilkan seluruh karya yang sudah dicatat lengkap dengan jenis dan judulnya.
- Setiap karya dapat diklik untuk melihat detail informasi karya tersebut.
- Karya yang sudah dicatat dapat diubah atau dihapus oleh pengguna yang memiliki hak akses, dengan setiap perubahan tercatat dalam audit trail.

## Sub-fitur: Distribusi Tugas & Anggota

Penugasan anggota ke lomba dengan peran spesifik melalui junction table contest_members dan unggah bukti hasil akhir.

## Sub-fitur: Detail Karya Lomba

Pendataan setiap karya dalam lomba mencakup judul, jenis karya, dan status progres (Proses Submit, Terkirim, Menunggu Pengumuman, Selesai).

## Task

### 1. Buat halaman utama pantau status pipeline

### 2. Buat layout Dashboard Progres Karya

### 3. Buat halaman rekap dengan dua daftar

### 4. Buat halaman verifikasi utama dengan data tiruan

### 5. Buat halaman dashboard pipeline dengan data tiruan

### 6. Buat halaman daftar lomba dengan data tiruan dan peran pengguna

### 7. Buat halaman daftar lomba dengan status dan peran pengguna tiruan

### 8. Buat halaman input hasil akhir karya Selesai

### 9. Buat halaman laporan prestasi dengan data tiruan

### 10. Buat halaman Rekap Festival dengan data tiruan

### 11. Buat halaman utama manajemen festival

### 12. Buat halaman utama daftar karya dengan data tiruan

### 13. Buat halaman form lomba dengan data tiruan

### 14. Bangun halaman daftar karya dengan data tiruan

### 15. Buat halaman daftar lomba dengan data tiruan

### 16. Bangun halaman daftar lomba dengan pipeline

### 17. Buat halaman dashboard prestasi dengan data tiruan

### 18. Buat halaman detail lomba dengan data tiruan

### 19. Buat halaman ekspor laporan lomba

### 20. Buat modal alasan penghapusan (change_reason) untuk guru

### 21. Buat formulir tambah karya dengan validasi

### 22. Buat utilitas unduh CSV dengan sanitasi

### 23. Buat komponen label status dan kartu karya

### 24. Buat helper hitung statistik karya

### 25. Buat komponen kartu hasil lomba

### 26. Buat komponen StageCard untuk menampilkan tahap dan jumlah

### 27. Terapkan validasi jumlah karya di form lomba

### 28. Buat form ubah status menjadi Selesai

### 29. Buat komponen detail bukti dan form validasi

### 30. Buat form detail karya dengan validasi wajib

### 31. Terapkan visibilitas tombol hapus berdasarkan peran

### 32. Buat komponen filter periode dengan state lokal

### 33. Tampilkan hasil akhir di detail lomba

### 34. Rancang komponen visual pipeline status

### 35. Buat halaman detail lomba dengan data tiruan

### 36. Implementasikan kontrol filter periode dengan opsi kustom

### 37. Buat komponen tabel rekap festival

### 38. Buat form tambah dan ubah festival

### 39. Buat migrasi tabel audit_trail untuk catatan penghapusan

### 40. Buat komponen unggah bukti gambar dengan pratinjau

### 41. Simulasikan perubahan status real-time lokal

### 42. Terapkan filter data laporan berdasarkan periode aktif

### 43. Tambahkan badge status untuk setiap karya

### 44. Buat halaman detail karya dari daftar

### 45. Tampilkan jumlah karya di detail lomba (mock)

### 46. Buat tabel karya di Supabase

### 47. Buat form tambah lomba dengan mock lokal

### 48. Tampilkan persentase aman saat data kosong

### 49. Buat cetak laporan PDF dari data tiruan

### 50. Buat service statistik dengan fallback mock

### 51. Filter lomba belum selesai dari daftar kalah

### 52. Buat panel riwayat audit pada halaman verifikasi

### 53. Buat form ubah status dengan unggah bukti dan alasan wajib

### 54. Buat hook usePipelineStats dengan data tiruan

### 55. Implementasikan cek duplikat case-insensitive di frontend

### 56. Tampilkan hasil akhir di rekap festival

### 57. Terapkan form perubahan status dengan alasan

### 58. Buat endpoint data rekap lomba terfilter

### 59. Tulis migrasi tabel lomba dan riwayat status

### 60. Buat styling responsif untuk mobile dan desktop

### 61. Nonaktifkan tombol simpan sampai bukti gambar ada

### 62. Buat form tambah tugas di detail lomba

### 63. Buat API list dan update detail karya

### 64. Tambahkan kolom jumlah_karya pada tabel lomba

### 65. Tambahkan kolom hasil akhir dan label Belum Ada Hasil

### 66. Terapkan aturan hapus lomba di endpoint: kunci status Selesai dan peran guru

### 67. Tampilkan pesan kesalahan pada formulir

### 68. Buat aksi edit dan hapus dengan konfirmasi

### 69. Tambahkan ekspor PDF/CSV dengan periode aktif

### 70. Tambah modal edit hasil akhir dengan alasan

### 71. Tampilkan riwayat audit perubahan pada halaman detail

### 72. Tambahkan filter lomba dan periode

### 73. Terapkan logika role untuk menu verifikasi

### 74. Tambah empty state untuk daftar kosong

### 75. Buat tabel karya film dengan status pipeline di Supabase

### 76. Buat tabel karya di Supabase

### 77. Buat endpoint laporan prestasi dengan filter periode

### 78. Hitung jumlah karya dari data karya

### 79. Perbarui API lomba untuk simpan dan ambil jumlah_karya

### 80. Buat aksi edit hapus dan status tugas

### 81. Buat migrasi tabel kontes di Supabase

### 82. Terapkan otorisasi peran pada data ekspor

### 83. Buat API endpoint statistik progres

### 84. Buat skema tabel lomba dan migrasi

### 85. Buat tabel verifikasi_bukti dan audit_log di Supabase

### 86. Buat tabel riwayat audit dan migrasi Supabase

### 87. Buat endpoint API untuk statistik pipeline per status dan total

### 88. Buat skema dan migrasi tabel festival

### 89. Buat tabel hasil akhir dan migrasi Supabase

### 90. Simpan audit log saat guru menghapus lomba Selesai

### 91. Tampilkan detail karya selesai dengan bukti gambar

### 92. Tampilkan peringatan wajib bukti gambar saat simpan

### 93. Sediakan API untuk daftar lomba dan status

### 94. Tampilkan audit trail perubahan pada detail karya

### 95. Sediakan API untuk update status lomba

### 96. Buat endpoint API simpan hasil akhir

### 97. Buat unique constraint nama per periode

### 98. Aktifkan Realtime Supabase untuk update status karya

### 99. Siapkan bucket Supabase untuk bukti dan aturan akses

### 100. Buat API daftar lomba selesai untuk verifikasi

### 101. Buat API rekap kemenangan dan kekalahan

### 102. Buat endpoint unduh CSV laporan lomba

### 103. Buat API endpoint statistik laporan prestasi

### 104. Buat dashboard tugas milik anggota

### 105. Buat skema tabel festival dan karya di Supabase

### 106. Sesuaikan perhitungan status dan agregasi laporan backend

### 107. Buat tabel karya dan audit trail di Supabase

### 108. Buat skema database dan migrasi Supabase

### 109. Tampilkan daftar bukti gambar di halaman detail

### 110. Buat endpoint API perbarui hasil akhir

### 111. Buat skema tabel lomba dan migrasi

### 112. Buat API detail lomba dan audit log

### 113. Buat API list pipeline dengan filter

### 114. Buat endpoint API untuk rekap festival

### 115. Buat endpoint CRUD untuk karya

### 116. Terapkan autentikasi dan kepemilikan data

### 117. Buat tabel lomba, bukti gambar, dan migrasi

### 118. Terapkan validasi hapus sisi server dengan catatan audit

### 119. Buat endpoint unduh PDF laporan lomba

### 120. Implementasikan query agregasi dan filter periode

### 121. Buat endpoint API simpan dan validasi festival

### 122. Buat API daftar hasil akhir rekap

### 123. Terapkan validasi server dan error handling

### 124. Buat API simpan hasil verifikasi bukti

### 125. Buat endpoint unggah gambar bukti lomba

### 126. Tangani pembagian nol dan pembulatan persentase

### 127. Buat skema tugas dan relasi penanggung jawab

### 128. Buat API update status karya

### 129. Terapkan agregasi status dan hasil akhir di endpoint

### 130. Buat endpoint pencatatan audit trail dengan auth

### 131. Terapkan validasi pembaruan data sisi server (alasan & bukti)

### 132. Terapkan otorisasi role Teacher/Admin pada endpoint verifikasi

### 133. Buat endpoint ubah status dengan validasi gambar

### 134. Buat API CRUD untuk lomba

### 135. Aktifkan realtime subscription Supabase

### 136. Buat log audit hasil akhir tanpa hapus

### 137. Buat endpoint detail lomba dengan bukti gambar

### 138. Buat API CRUD untuk tugas lomba

### 139. Catat perubahan data lomba ke audit log

### 140. Buat API tugas milik pengguna

### 141. Terapkan otorisasi peran pada API
