# Manajemen Nilai Siswa

Input nilai eksklusif oleh Guru (Admin) dengan skala A-E, mencakup kategori Tugas Kelas, Produksi Film, Event, dan Lainnya.

## Spesifikasi

### Tujuan
Sistem untuk mengelola nilai siswa dalam kegiatan ekstrakurikuler: mencatat nilai, memantau riwayat penilaian, dan memastikan koreksi nilai dilakukan secara transparan dengan alasan yang tercatat.

### Selesai bila
- Guru/sekretaris dapat menginput nilai per siswa lengkap dengan predikat/keterangan dan tersimpan di sistem.
- Setiap siswa memiliki riwayat penilaian yang bisa dilihat, termasuk tanggal, penginput, dan nilai lama.
- Daftar siswa menampilkan status Graded/Ungraded sehingga mudah diketahui siapa yang belum dinilai.
- Nilai otomatis terkunci setelah 48 jam; koreksi hanya bisa dilakukan guru/admin dengan alasan minimal 5 karakter yang tercatat di log.

## Sub-fitur: Input Nilai Siswa

Input nilai siswa dan keterangan secara bulk eksklusif hanya untuk peran Teacher (Admin).

### Tujuan
Memungkinkan guru/sekretaris mencatat nilai siswa secara cepat dan tersimpan rapi.

### Selesai bila
- Tersedia form input nilai yang memilih siswa, memasukkan nilai/predikat dan keterangan opsional.
- Setelah disimpan, nilai muncul di riwayat siswa.
- Form tidak bisa dikirim kosong; siswa yang sudah dinilai pada periode yang sama tidak bisa diinput ganda.

## Sub-fitur: Riwayat Penilaian

Lihat riwayat nilai per siswa.

### Tujuan
Menampilkan seluruh riwayat nilai seorang siswa agar perkembangan nilainya mudah dipantau.

### Selesai bila
- Ada halaman/daftar riwayat per siswa yang menampilkan nilai, predikat/keterangan, tanggal penilaian, dan penginput.
- Riwayat diurutkan dari terbaru ke terlama.
- Pengguna dengan akses dapat membuka riwayat dari daftar siswa atau detail siswa.

## Sub-fitur: Status Graded/Ungraded

Tampilkan siswa yang sudah dinilai dan yang belum dinilai.

### Tujuan
Memberi informasi visual siswa mana yang sudah dinilai dan mana yang belum untuk mempermudah pemeriksaan kelengkapan penilaian.

### Selesai bila
- Pada daftar siswa, setiap siswa diberi label jelas "Graded" atau "Ungraded".
- Label diperbarui otomatis setelah guru menginput atau menghapus nilai.
- Tersedia filter/indikator untuk melihat hanya siswa yang belum dinilai.

## Sub-fitur: Kunci Nilai 48 Jam

Nilai terkunci setelah 48 jam; koreksi hanya oleh guru/admin dengan alasan yang tercatat.

### Tujuan
Mencegah perubahan nilai tanpa jejak: nilai terkunci setelah 48 jam, dan koreksi hanya bisa dilakukan oleh guru/admin dengan alasan yang tercatat.

### Selesai bila
- Nilai yang berusia lebih dari 48 jam tidak bisa diedit/dihapus oleh pengguna biasa.
- Guru/admin tetap dapat mengubah nilai lewat mekanisme koreksi dengan alasan (change_reason) minimal 5 karakter.
- Setiap koreksi tercatat di log audit beserta nilai lama, nilai baru, pengoreksi, dan alasannya.

## Sub-fitur: Input Nilai Massal (Bulk Grading)

Guru/Admin memilih banyak siswa sekaligus, mengisi nilai dengan skala A-E, dan dapat membuka form yang sama untuk menambah siswa atau mengubah nilai secara massal; semua aksi tercatat di audit tanpa pengumuman otomatis ke siswa.

### Tujuan
Memudahkan Guru/Admin memberikan nilai skala A–E kepada banyak siswa sekaligus dalam satu form, serta memperbarui nilai massal tanpa mengganggu siswa lewat notifikasi.

### Selesai bila
- Guru/Admin dapat membuka form Bulk Grading, memilih banyak siswa sekaligus, dan mengisi nilai A/B/C/D/E untuk tiap siswa dalam satu halaman.
- Saat input pertama, Guru/Admin wajib mengisi Nama Tugas/Event; siswa terpilih tampil berdampingan (nama di kiri, input nilai di kanan).
- Form tugas yang sama dapat dibuka kembali untuk menambah siswa baru atau mengubah nilai siswa yang sudah ada secara massal dalam satu aksi.
- Setiap penyimpanan dicatat di audit trail (siapa, kapan, nilai lama-baru) dengan change_reason minimal 5 karakter.
- Tidak ada pengumuman/notifikasi otomatis ke dashboard siswa atas aksi grading ini.

## Sub-fitur: Kategori Assignment & Pemetaan Portofolio

Tabel assignments memiliki kategori crew_film, class_task, event_participation, dan other (wajib keterangan) yang terpetakan langsung ke portofolio kompetensi siswa.

### Tujuan
Memberi label kategori pada setiap penilaian/tugas siswa (Kelas, Crew Film, Event) agar kompetensi siswa di profilnya bisa dikelompokkan dan dilihat dengan jelas.

### Selesai bila
- Saat guru membuat assignment/mengisi nilai, tersedia pilihan kategori yang wajib diisi: **Kelas**, **Crew Film**, atau **Event**.
- Assignment yang sudah disimpan dapat difilter/dikelompokkan berdasarkan kategori tersebut di halaman rekap nilai.
- Profil siswa menampilkan riwayat nilai assignment yang sudah dikelompokkan per kategori (Kelas, Crew Film, Event), bukan hanya daftar nilai tanpa label.
- Setiap assignment yang tampil di profil tetap mencantumkan nama tugas/event dan kategorinya.

## Sub-fitur: Kolom Keterangan Kategori

Kolom opsional pada tabel assignments yang wajib diisi saat kategori yang dipilih adalah 'Lainnya' (other), agar konteks penilaian di luar kategori baku tercatat.

### Tujuan
Menambahkan kolom keterangan kategori pada assignment agar konteks penilaian di luar kategori baku (Kelas, Crew Film, Event) tetap tercatat jelas dan dapat dipertanggungjawabkan.

### Selesai bila
- Saat memilih kategori "Lainnya" pada form assignment, kolom "Keterangan Kategori" tampil sebagai isian wajib dan form tidak dapat disimpan jika kosong.
- Saat memilih kategori selain "Lainnya", kolom "Keterangan Kategori" bersifat opsional (boleh dikosongkan).
- Keterangan yang diisi tersimpan pada data assignment dan tampil pada rekap/detail penilaian.

## Sub-fitur: Pemetaan Penilaian ke Profil Siswa

Setiap input nilai bulk grading langsung terhubung ke profil siswa sebagai portofolio penilaian sesuai kategori tugas, crew film, event, atau lainnya.

### Tujuan
Menghubungkan setiap nilai yang dimasukkan guru/Admin melalui form Bulk Assignment & Grading ke profil siswa sebagai portofolio penilaian yang terkelompok berdasarkan kategori (Kelas, Crew Film, Event, Lainnya).

### Selesai bila
- Setiap nilai yang diinput/diubah lewat Bulk Assignment & Grading langsung muncul di profil siswa pada tab nilai sesuai kategorinya tanpa perlu input ulang.
- Kategori "Lainnya" meminta keterangan tambahan sebelum nilai bisa disimpan; kategori lain tidak wajib keterangan.
- Guru/Admin dapat melihat portofolio nilai per siswa yang memuat nama tugas/event, kategori, nilai (A–E), dan tanggal penilaian.
- Rekap nilai di halaman Rekapitulasi Nilai selalu mencerminkan perubahan terbaru dari form Bulk Assignment & Grading (real-time).
- Setiap penambahan/perubahan nilai tercatat di audit trail dengan alasan perubahan, tanpa bisa diubah/dihapus diam-diam.

## Sub-fitur: Rekapitulasi Nilai & Filter Kategori

Menampilkan rekap real-time perolehan nilai (A-E) siswa dengan filter kategori (tugas kelas, crew film, event, lainnya) dan ringkasan distribusi nilai di dashboard utama.

### Tujuan
Menampilkan rekap nilai siswa secara real-time dengan filter kategori kegiatan dan ringkasan distribusi nilai di dashboard utama, agar guru dapat memantau kompetensi siswa per kategori (tugas kelas, crew film, event, lainnya) tanpa harus membuka halaman terpisah.

### Selesai bila
- Halaman Rekapitulasi Nilai menampilkan daftar rinci penilaian yang mencakup nama siswa, kategori kegiatan, nama tugas/event, nilai (A–E), dan tanggal penilaian.
- Tersedia filter dinamis berdasarkan kategori assignment (tugas kelas, crew film, event, lainnya) serta pencarian per siswa berdasarkan nama/NIS.
- Data rekap langsung terbarui setelah guru melakukan input atau perubahan nilai melalui Bulk Assignment & Grading, tanpa perlu refresh manual.
- Dashboard utama untuk peran Guru/Admin menampilkan ringkasan distribusi nilai (jumlah siswa yang memperoleh A, B, C, D, E) per kategori kegiatan, sebagai gambaran cepat.
- Halaman rekap bersifat read-only; tidak ada tombol tambah/ubah/ubah nilai di halaman tersebut, dan semua perubahan hanya dilakukan melalui form Bulk Assignment & Grading.

## Sub-fitur: Rekapitulasi Nilai

Menampilkan rekap nilai siswa dari seluruh tugas/penilaian secara langsung, bisa disaring berdasarkan kategori dan siswa, serta menampilkan frekuensi nilai A-E.

### Tujuan
Memberi guru/admin satu halaman rekap nilai seluruh siswa dari semua jenis penilaian (kelas, crew film, event, lainnya) secara langsung dan real-time, lengkap dengan penyaringan kategori/siswa serta ringkasan frekuensi nilai A–E.

### Selesai bila
- Halaman "Rekapitulasi Nilai" dapat dibuka guru/admin dan menampilkan tabel berisi nama siswa, kategori kegiatan, nama tugas/event, nilai (A–E), dan tanggal penilaian; data langsung mencerminkan input nilai terbaru tanpa refresh manual.
- Terdapat filter kategori dengan pilihan "Semua Kategori", "Kelas", "Crew Film", "Event", dan "Lainnya"; memilih salah satu langsung menyaring tabel.
- Terdapat kolom pencarian siswa (nama/NIS) yang memfilter tabel ke siswa tertentu.
- Tersedia ringkasan frekuensi yang menampilkan jumlah nilai A, B, C, D, E per siswa sesuai filter kategori/siswa yang aktif.
- Seluruh tampilan bersifat read-only: tidak ada tombol tambah/ubah/hapus, dan perubahan hanya dapat dilakukan lewat form Bulk Assignment & Grading.

## Sub-fitur: Validasi Keterangan Kategori

Mewajibkan pengisian keterangan jika kategori 'Lainnya' dipilih pada saat pemberian nilai.

## Sub-fitur: Universal Grading System

Sistem penilaian eksklusif untuk Teacher dengan skala A-E yang dipetakan ke kategori: Tugas Kelas, Produksi Film (Crewing), Event, dan Lainnya.

## Task

### 1. Buat halaman rekap nilai read-only

### 2. Buat halaman form assignment dengan mock data

### 3. Buat halaman Bulk Grading dengan data tiruan

### 4. Buat halaman Rekapitulasi Nilai read-only

### 5. Buat halaman rekap nilai dengan filter kategori

### 6. Buat halaman profil siswa dengan tab nilai

### 7. Buat halaman daftar siswa dengan data tiruan

### 8. Buat form assignment dengan pilihan kategori wajib

### 9. Buat komponen form input nilai siswa

### 10. Buat pemilihan banyak siswa dan tambah ke form

### 11. Tambahkan filter kategori dan pencarian siswa

### 12. Buat kolom Keterangan Kategori kondisional dan wajib

### 13. Buat form Bulk Grading dengan kategori

### 14. Tambah filter kategori dan pencarian siswa

### 15. Buat ringkasan distribusi nilai di dashboard

### 16. Tampilkan riwayat assignment per kategori di profil siswa

### 17. Buat halaman riwayat penilaian per siswa

### 18. Buat ringkasan frekuensi nilai per siswa

### 19. Buat input nilai A-E dengan validasi pada form

### 20. Tampilkan Keterangan Kategori di detail rekap mock

### 21. Buat store nilai portofolio siswa (mock)

### 22. Sinkronkan form dan profil ke store nilai

### 23. Tambah label dan filter status Graded/Ungraded

### 24. Buat skema dan migrasi Supabase rekap nilai

### 25. Buat migrasi kolom kategori assignment

### 26. Simulasikan pembaruan data real-time

### 27. Buat kolom keterangan_kategori di tabel assignments

### 28. Implementasikan mode buka-ulang untuk ubah nilai massal

### 29. Terapkan validasi server untuk kategori Lainnya

### 30. Rancang tabel skema grading dan audit trail

### 31. Buat simulasi kunci nilai dan form koreksi

### 32. Buat API assignment dengan filter kategori

### 33. Buat endpoint API rekap dengan filter

### 34. Buat halaman rekap nilai real-time

### 35. Buat endpoint API rekap nilai dengan filter

### 36. Buat tabel nilai siswa di Supabase

### 37. Update API assignment untuk menyimpan keterangan_kategori

### 38. Buat API simpan dan perbarui nilai massal

### 39. Buat skema tabel nilai dan migrasi Supabase

### 40. Aktifkan realtime Supabase untuk tabel nilai

### 41. Terapkan validasi kategori wajib di backend assignment

### 42. Buat endpoint ringkasan distribusi nilai

### 43. Catat audit trail dengan alasan perubahan valid

### 44. Aktifkan realtime Supabase untuk rekap

### 45. Sertakan keterangan_kategori pada respons assignment

### 46. Buat tabel audit trail nilai

### 47. Buat endpoint API input nilai dengan cek duplikat

### 48. Buat API bulk grading dengan audit trail

### 49. Buat endpoint API riwayat penilaian siswa

### 50. Buat API portofolio nilai per siswa

### 51. Buat endpoint daftar siswa dengan status penilaian

### 52. Buat API rekap nilai

### 53. Implementasi aturan kunci 48 jam dan koreksi

### 54. Buat log audit koreksi nilai
