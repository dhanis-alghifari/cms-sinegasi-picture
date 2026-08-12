# Monitoring Alat

Kelola katalog alat, pantau status kondisi, riwayat, dan peringatan alat secara menyeluruh.

## Sub-fitur: Status Alat Dual-System

Memisahkan pemantauan kondisi fisik (bagus/rusak) dan status ketersediaan (tersedia/dipinjam/maintenance).

## Sub-fitur: Riwayat Per Alat

Lihat riwayat peminjaman dan perawatan tiap alat.

## Sub-fitur: Peringatan

Dapat notifikasi jika alat telat dikembalikan.

## Sub-fitur: Wajib Foto Kondisi Alat

Mewajibkan unggah minimal 3 foto kondisi alat (depan, samping, atas/belakang) ke Cloudflare R2 sebelum data alat baru dapat disimpan, dan menampilkan foto pada detail alat.

### Tujuan
Fitur ini memungkinkan pengguna mengunggah atau mengganti foto alat, lalu menampilkannya di detail alat.

### Selesai bila
- Pengguna bisa mengunggah gambar dari halaman detail alat dan foto langsung tersimpan.
- Foto yang diunggah tersimpan di Cloudflare R2 dan URL-nya tercatat di data alat.
- Jika alat sudah punya foto, pengguna bisa menggantinya dengan foto baru.
- Setelah berhasil, foto terbaru tampil di detail alat; jika gagal, muncul pesan kesalahan yang jelas.

## Sub-fitur: Laporkan Masalah Alat

Laporkan ketidaksesuaian kondisi alat (misalnya tidak ditemukan atau rusak) agar statusnya diperbarui menjadi rusak/hilang atau dicatat untuk tindak lanjut.

### Tujuan
Memberi pengurus/guru cara cepat melaporkan ketidaksesuaian kondisi fisik alat (rusak, tidak ditemukan, atau masalah lain) sehingga status alat dapat diperbarui secara akurat dan masalah tercatat untuk ditindaklanjuti.

### Selesai bila
- Pada halaman detail/daftar alat tersedia aksi "Laporkan Masalah" yang dapat diakses pengguna.
- Form laporan menampilkan pilihan jenis masalah (Rusak, Tidak ditemukan, Lainnya) dan kolom keterangan; pengguna wajib memilih salah satu jenis dan dapat menyimpan laporan.
- Setelah laporan disimpan, alat yang dilaporkan "Rusak" berubah statusnya menjadi "Rusak" di monitoring; laporan "Tidak ditemukan" atau "Lainnya" tetap tersimpan sebagai catatan tindak lanjut tanpa menghapus alat.
- Laporan yang sudah dibuat muncul di riwayat alat (lengkap dengan jenis masalah, keterangan, dan tanggal) agar mudah dicek dan ditindaklanjuti.

## Sub-fitur: Kelola Katalog Alat

Tambah atau ubah data alat pada katalog, wajib unggah minimal 3 foto kondisi alat dari berbagai sudut sebelum disimpan.

### Tujuan
Memberi cara bagi pengurus alat untuk menambah dan mengubah data alat (nama, kategori, status, dan foto) sehingga inventaris alat selalu akurat dan mudah dipantau.

### Selesai bila
- Pengguna dapat membuka halaman katalog alat yang memuat daftar semua alat beserta nama, kategori, status, dan foto.
- Pengguna dapat menambah alat baru melalui formulir dengan nama, kategori, status, dan foto; alat baru langsung muncul di daftar.
- Pengguna dapat mengubah nama, kategori, status, atau foto alat yang sudah ada, dan perubahan langsung tersimpan serta tampil di daftar.
- Setiap alat menampilkan status terkini (misalnya tersedia, dipinjam, rusak, atau hilang) secara jelas, dan perubahan status mudah dikenali.

## Sub-fitur: Cetak QR Code

Menu untuk mencetak label QR Code setiap alat dalam format PDF siap cetak untuk identifikasi inventaris.

### Tujuan
Memudahkan pengurus/guru mencetak label QR Code untuk setiap alat yang terdaftar sebagai identifikasi inventaris, sehingga pemindaian QR untuk peminjaman cepat dapat dilakukan.

### Selesai bila
- Pengguna dapat membuka menu Cetak QR Code dan melihat daftar seluruh alat terdaftar beserta kode QR unik masing-masing.
- Pengguna dapat memilih satu, beberapa, atau semua alat, lalu membuat PDF siap cetak yang memuat label QR Code dengan informasi alat (misalnya nama alat).
- PDF hasil cetak dapat diunduh/dibuka, dan setiap QR Code pada label dapat dipindai untuk masuk ke alur peminjaman alat.

## Sub-fitur: Keunikan Nama Alat

Sistem menolak input alat baru jika nama alat sudah terdaftar (case-insensitive) untuk menghindari duplikasi aset.

### Tujuan
Sistem menolak pendaftaran alat baru yang namanya sudah dipakai, sehingga tidak ada dua alat dengan nama sama (termasuk beda huruf besar/kecil) dan inventaris tetap rapi.

### Selesai bila
- Saat pengguna mencoba menambah alat baru dengan nama yang sama persis dengan alat yang sudah ada, sistem menolak dan menampilkan pesan 'Nama alat sudah terdaftar'.
- Penolakan juga terjadi jika hanya berbeda kapitalisasi (misalnya 'Sony A6400' vs 'sony a6400').
- Alat dengan nama yang belum pernah dipakai tetap bisa disimpan seperti biasa.

## Sub-fitur: Status Alat Detail

Pantau kondisi fisik alat dengan status spesifik: bagus, sedikit kerusakan, rusak, rusak besar, sedang diperbaiki, hilang, tersedia, atau dipinjam.

### Tujuan
Pantau kondisi fisik setiap alat secara akurat melalui delapan status yang jelas agar kerusakan, perbaikan, atau kehilangan alat cepat terlihat dan ditindaklanjuti.

### Selesai bila
- Setiap alat memiliki satu status dari delapan pilihan: bagus, sedikit kerusakan, rusak, rusak besar, sedang diperbaiki, hilang, tersedia, atau dipinjam.
- Detail alat menampilkan status terkini dengan label visual yang mudah dibedakan (misalnya lencana berwarna) sehingga pengguna langsung tahu kondisi alat.
- Pengguna dengan hak akses (Guru/Tim Alat) dapat mengubah status alat dan wajib mengisi alasan perubahan (minimal 5 karakter); setiap perubahan tercatat di riwayat alat.
- Sistem menolak penyimpanan status di luar delapan pilihan yang ditentukan.
- Daftar alat memungkinkan penyaringan/identifikasi cepat alat yang tersedia, dipinjam, rusak, atau hilang.

## Sub-fitur: Secure Media Hosting

Penyimpanan foto alat dan bukti lomba di Cloudflare R2 dengan akses terbatas melalui Signed URLs yang divalidasi oleh Fastify.

### Tujuan
Menyimpan semua foto alat dan bukti lomba di tempat yang aman sehingga hanya pengguna yang berhak dapat melihatnya lewat tautan sementara.

### Selesai bila
- Foto yang diunggah berhasil tampil di halaman detail alat atau lomba setelah disimpan.
- Setiap tautan foto hanya berlaku beberapa menit dan tidak bisa dipakai lagi setelah kedaluwarsa.
- Membuka tautan foto tanpa login atau tanpa hak akses akan menampilkan pesan "Akses ditolak atau tautan sudah kedaluwarsa", bukan memperlihatkan foto.
- Mengubah-ubah alamat tautan foto tidak akan membuka foto milik orang lain; tautan yang tidak sah selalu ditolak.

## Task

### 1. Buat halaman detail alat dengan tombol Laporkan Masalah

### 2. Tampilkan galeri foto dummy di detail alat

### 3. Buat halaman tambah alat dengan data tiruan

### 4. Buat halaman daftar alat dengan QR Code

### 5. Buat halaman detail alat dengan data tiruan

### 6. Buat halaman daftar alat dengan data tiruan

### 7. Buat halaman katalog alat dengan data tiruan

### 8. Buat form laporan masalah dengan jenis dan keterangan

### 9. Buat halaman detail alat dengan status terkini

### 10. Tambah komponen unggah foto dengan preview

### 11. Implementasi validasi nama alat duplikat case-insensitive

### 12. Buat formulir tambah alat dengan data tiruan

### 13. Tampilkan galeri foto dummy di detail lomba

### 14. Implementasi seleksi satu, beberapa, atau semua alat

### 15. Buat form unggah foto dengan pratinjau lokal

### 16. Terapkan state laporan dan ubah status alat

### 17. Buat form ubah status dengan alasan wajib

### 18. Tambahkan alur ganti foto pada detail alat

### 19. Buat formulir ubah alat dengan data tiruan

### 20. Buat unduhan PDF label QR alat terpilih

### 21. Buat unique index case-insensitive pada nama alat

### 22. Buat migrasi kolom photo_url tabel alat

### 23. Tampilkan pesan akses ditolak pada tautan kedaluwarsa

### 24. Tampilkan status alat dan ubah status dengan data tiruan

### 25. Buat riwayat perubahan status di detail alat

### 26. Tampilkan riwayat laporan pada halaman detail alat

### 27. Setup koneksi Supabase di backend Node.js

### 28. Buat API tambah alat dengan penolakan duplikat

### 29. Buat endpoint unggah gambar ke R2

### 30. Tambahkan aksi Laporkan Masalah pada daftar alat

### 31. Buat tabel alat dan migrasi Supabase

### 32. Buat API endpoint daftar alat dari Supabase

### 33. Buat skema tabel alat, status, dan riwayat

### 34. Buat modul layanan foto dengan mock data

### 35. Buat skema dan migrasi tabel foto

### 36. Buat API CRUD alat di backend

### 37. Buat API update URL foto alat

### 38. Buat tabel laporan_masalah dan migrasi Supabase

### 39. Buat API daftar alat dengan filter status

### 40. Buat API detail alat dan riwayat

### 41. Buat endpoint unggah foto ke Cloudflare R2

### 42. Buat endpoint API untuk mengirim laporan masalah

### 43. Buat endpoint API untuk mengambil riwayat laporan alat

### 44. Buat API ubah status dengan validasi dan otorisasi

### 45. Buat endpoint signed URL dengan otorisasi

### 46. Buat rute akses foto validasi signed URL
