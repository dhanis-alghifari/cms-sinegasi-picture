# Autentikasi & Pengaturan

Masuk ke aplikasi dan kelola akun pengguna.

## Sub-fitur: Login

Masuk ke aplikasi dengan username dan password.

## Sub-fitur: Manajemen Pengguna

Kelola siklus hidup akun pengguna, termasuk aktivasi, nonaktif akun alumni, dan reset password oleh admin.

## Sub-fitur: Pengaturan Profil

Ubah password dan data diri pengguna.

## Sub-fitur: Wajib Ganti Password Pertama

Pengguna baru harus mengganti password bawaan sebelum bisa memakai fitur lain.

### Tujuan
Memastikan pengguna baru yang pertama kali login dengan password bawaan segera mengganti password tersebut sebelum bisa mengakses fitur apa pun, sehingga akun aman dan hanya pemiliknya yang mengetahui passwordnya.

### Selesai bila
- Pengguna yang login pertama kali dengan password bawaan langsung diarahkan ke layar wajib ganti password dan tidak bisa membuka menu/dashboard lain sebelum mengganti.
- Password baru harus diisi dua kali; jika tidak cocok atau tidak memenuhi syarat, muncul pesan kesalahan dan proses tidak bisa dilanjutkan.
- Setelah password berhasil diganti, pengguna otomatis masuk ke dashboard dan fitur-fitur lain dapat digunakan seperti biasa.
- Jika pengguna menutup/meninggalkan aplikasi di tengah proses ganti password, saat login kembali ia tetap diwajibkan mengganti password terlebih dahulu.

## Sub-fitur: Reset Password oleh Guru/Admin

Guru atau admin dapat mereset password akun siswa.

### Tujuan
Guru/Admin dapat mereset kata sandi akun siswa yang lupa atau terkunci agar siswa bisa masuk kembali, dengan tetap menjaga keamanan dan transparansi.

### Selesai bila
- Halaman manajemen pengguna menampilkan tombol "Reset Password" hanya untuk role Teacher/Admin, dan tidak untuk role lain.
- Saat tombol diklik, sistem meminta konfirmasi beserta alasan perubahan (minimal 5 karakter) sebelum password direset.
- Setelah reset, sistem menampilkan kata sandi sementara sekali saja; akun siswa otomatis berstatus wajib ganti password pada login berikutnya sehingga tidak bisa masuk ke menu lain sebelum mengganti.
- Aksi reset tercatat di audit trail (siapa, kapan, ke akun mana, dan alasan) dan tidak bisa diubah/dihapus.

## Sub-fitur: Kontrol Akses Berdasarkan Peran

Batasi akses menu sesuai peran pengguna dan tegakkan aturan di sisi server.

### Tujuan
Membatasi akses menu dan fitur sesuai peran pengguna, serta menegakkan aturan tersebut di sisi server agar pengguna hanya dapat melihat dan melakukan tindakan sesuai kewenangannya.

### Selesai bila
- Setiap pengguna yang masuk hanya melihat menu dan tombol sesuai perannya (misalnya siswa tidak melihat menu Manajemen Pengguna, Audit Log, atau Ekspor Data selain data miliknya).
- Akses langsung ke API di luar kewenangan peran ditolak oleh server dengan pesan error yang jelas (misalnya 'Anda tidak memiliki akses').
- Semua pemeriksaan peran dilakukan validasi di backend, bukan hanya sekadar menyembunyikan menu di antarmuka.
- Perubahan peran atau penonaktifan akun langsung memengaruhi akses: akun nonaktif tidak dapat login/mengakses data, dan hak akses baru berlaku tanpa perlu logout.
- Jika pengguna mencoba mengakses halaman/endpoint yang tidak diizinkan, mereka diarahkan ke halaman tidak punya akses atau pesan penolakan yang sesuai.

## Sub-fitur: Zero-Trust Security & RLS Defense-in-Depth

Keamanan terpusat di Fastify dengan RLS database aktif (deny-all) sebagai lapis kedua; akses database hanya via service account Fastify dengan bypass RLS.

### Tujuan
Memastikan seluruh akses ke data hanya melalui backend Fastify dengan JWT valid, sehingga tidak ada jalur langsung ke database dan permintaan tanpa otorisasi selalu ditolak.

### Selesai bila
- Setiap permintaan API tanpa token JWT valid ditolak dengan kode 401/403 dan tidak mengubah data apa pun.
- Token kedaluwarsa, salah tanda tangan, atau milik pengguna nonaktif juga ditolak sebelum proses bisnis dijalankan.
- Klien tidak bisa mengakses database secara langsung; semua operasi data hanya terjadi lewat Fastify, dan keamanan tidak bergantung pada RLS database.
- Endpoint dengan batasan peran hanya bisa diakses oleh peran yang berhak; percobaan akses dari peran lain ditolak di sisi server.

## Sub-fitur: Perlindungan Kolom Role

Trigger database mengunci kolom role pada tabel users agar tidak bisa diubah melalui update profil biasa untuk mencegah eskalasi peran.

### Tujuan
Mengunci kolom peran (role) pada data pengguna agar tidak dapat diubah melalui pembaruan profil biasa, sehingga pengguna tidak bisa menaikkan hak aksesnya sendiri.

### Selesai bila
- Saat pengguna mencoba mengubah peran melalui pembaruan profil biasa, sistem menolak perubahan tersebut dan menampilkan pesan bahwa peran tidak dapat diubah lewat jalur ini.
- Peran pengguna hanya dapat diubah melalui mekanisme khusus yang disediakan untuk pengelola aplikasi (misalnya admin), bukan melalui formulir profil.
- Tidak ada celah yang memungkinkan pengguna mengubah perannya sendiri, baik dari halaman profil maupun permintaan langsung ke sistem.
- Setiap percobaan perubahan peran yang tidak sah tercatat/ditolak tanpa mengubah data peran yang ada.

## Sub-fitur: Fastify Idempotency Layer

Mencegah entri ganda dengan menyimpan idempotency_key selama 10 detik untuk setiap mutasi data di level middleware.

### Tujuan
Mencegah data tercatat dua kali saat pengguna menekan tombol simpan berulang kali atau saat permintaan yang sama terkirim ganda, dengan mengingat tanda unik (idempotency key) setiap pengiriman selama 10 detik.

### Selesai bila
- Setiap permintaan penyimpanan data diwajibkan menyertakan idempotency key; permintaan tanpa key akan ditolak.
- Jika key yang sama dipakai lagi dalam 10 detik, sistem tidak menyimpan data baru dan mengembalikan respons yang sama seperti pengiriman pertama.
- Setelah lewat 10 detik, key yang sama dapat dipakai untuk transaksi baru dan tersimpan normal.
- Tidak ada duplikat baris data pada semua modul mutasi (kas, absensi, peminjaman, nilai, dll.) akibat klik ganda atau kirim ulang.

## Sub-fitur: Status Akun Nonaktif

Pengaturan status akun nonaktif untuk alumni atau anggota yang keluar agar siklus hidup pengguna terkelola dengan baik.

## Task

### 1. Buat halaman ganti password dengan validasi form

### 2. Buat layout aplikasi dengan sidebar dan area konten

### 3. Buat halaman profil dengan role read-only

### 4. Buat halaman daftar pengguna dengan tombol reset

### 5. Buat halaman dashboard keamanan API

### 6. Setup Fastify Security Gatekeeper & Raw SQL Foundation

Membangun pondasi backend Fastify yang terhubung ke Supabase/PostgreSQL menggunakan Raw SQL. Fokus pada pembuatan middleware autentikasi (JWT) yang mengekstrak role user, serta helper transaksi yang mendukung 'SET LOCAL app.change_reason' untuk audit log.

**Prompt:**

```
Buatlah boilerplate Fastify (Node.js/TypeScript) dengan spesifikasi:
1. Database: Gunakan library 'postgres' untuk koneksi Raw SQL ke PostgreSQL Supabase.
2. Auth & RBAC: 
   - Middleware untuk validasi JWT Supabase.
   - Decorator/Hook untuk cek 7 user_role (teacher, leader, dll).
3. Audit Log Helper: Buat wrapper transaksi SQL yang menjalankan 'SET LOCAL app.change_reason = ...' sebelum query utama agar ditangkap oleh trigger database.
4. Validation: Gunakan Fastify JSON Schema (TypeBox) untuk validasi input.
5. Error Handling: Global error handler untuk menangkap pesan error database (seperti unique constraint atau check constraint nominal < 500).

Endpoint pertama: POST /auth/login (verify password_hash) dan GET /profile (terproteksi).
```

### 7. Buat halaman demo idempotency dengan data tiruan

### 8. Tampilkan log permintaan dan status duplikat

### 9. Buat guard rute wajib ganti password

### 10. Sediakan state autentikasi tiruan berisi peran pengguna

### 11. Tampilkan pesan error saat role diubah di UI

### 12. Buat dialog konfirmasi reset dengan alasan

### 13. Buat state autentikasi JWT tiruan

### 14. Setup Database Schema di Supabase

Eksekusi skrip SQL final dari PRD v44 ke dalam Supabase Query Editor untuk membangun 17 tabel, tipe ENUM, trigger audit, dan proteksi RLS.

**Prompt:**

```
Siapkan lingkungan Supabase. Salin dan jalankan seluruh query SQL dari PRD Bagian 6 (Database Schema) terbaru. Pastikan tidak ada error pada pembuatan trigger log_activity dan tipe custom ENUM. Verifikasi bahwa tabel activity_logs sudah memiliki trigger protect_activity_logs yang mencegah penghapusan data.
```

### 15. Buat guard rute berbasis peran

### 16. Buat migrasi kolom must_change_password

### 17. Setup Backend & Audit Middleware

Inisialisasi project Fastify dengan TypeScript dan setup middleware untuk mendukung sistem Audit Trail 'Zero Silent Edits'.

**Prompt:**

```
Buat project Fastify baru dengan TypeScript. Install pg-promise atau Drizzle ORM. Buat middleware global yang menangkap user_id dari JWT dan change_reason dari header request, lalu jalankan perintah 'SET LOCAL app.current_user_id = ...' dan 'SET LOCAL app.change_reason = ...' di setiap awal transaksi database. Ini wajib agar trigger audit di DB tidak menolak (RAISE EXCEPTION) aksi penulisan data.
```

### 18. Render menu dan tombol sesuai peran dari state tiruan

### 19. Buat trigger database pengunci kolom role

### 20. Tampilkan hasil reset berupa password sementara

### 21. Buat generator dan pengatur idempotency key

### 22. Buat tabel audit trail reset password

### 23. Tolak perubahan role di API profil

### 24. Buat halaman 403 dan guard rute akses

### 25. Perbarui endpoint login untuk mengembalikan must_change_password

### 26. Siapkan Fastify dengan plugin JWT

### 27. Simulasikan kedaluwarsa key setelah 10 detik

### 28. Implementasi Boilerplate & API Interceptor

Implementasi struktur folder modular, Axios interceptor untuk Audit Trail, dan konfigurasi dasar TanStack Query & Zustand.

**Prompt:**

```
Buat struktur folder sesuai boilerplate: api/, features/, store/, layouts/. Implementasikan Axios interceptor yang secara otomatis menyertakan header 'x-change-reason' pada setiap request mutasi (POST/PUT/DELETE) untuk memenuhi syarat Zero Silent Edits di backend. Setup QueryClientProvider di App.tsx.
```

### 29. Backend Step 1: Init & Database Connector

Inisialisasi folder /backend dengan Fastify, TypeScript, dan library 'postgres' untuk koneksi Supabase.

**Prompt:**

```
Di folder /backend: 1. Inisialisasi npm & install fastify, typescript, @types/node, ts-node, dan library 'postgres'. 2. Buat file .env untuk DATABASE_URL Supabase. 3. Buat file src/lib/db.ts yang mengekspor instance sql dari library 'postgres' sebagai singleton koneksi. 4. Pastikan koneksi berhasil dengan melakukan query sederhana 'SELECT NOW()' saat server start.
```

### 30. Buat endpoint API ganti password

### 31. Buat tabel users dengan kolom role dan is_active

### 32. Buat endpoint API reset password guru/admin

### 33. Buat skema user dan peran Supabase

### 34. Buat middleware idempotency Fastify global

### 35. Buat endpoint admin untuk ubah role

### 36. Buat penyimpanan idempotency key TTL 10 detik

### 37. Backend Step 2: Zero-Silent-Edits Middleware

Implementasi middleware global untuk menyuntikkan Audit Trail metadata ke session database.

**Prompt:**

```
Di folder /backend: Buat middleware Fastify (addHook 'onRequest') yang menangkap header 'x-change-reason' dan 'x-user-id'. Setiap kali ada request mutasi data (POST/PUT/DELETE), middleware harus membungkus query dalam transaksi 'sql.begin' dan menjalankan 'SET LOCAL app.current_user_id = ...' serta 'SET LOCAL app.change_reason = ...' sebelum query bisnis dijalankan. Jika header kosong, kembalikan error 400 'Audit reason required'.
```

### 38. Buat middleware autentikasi dan muat user aktif

### 39. Catat log percobaan perubahan role tak sah

### 40. Buat middleware pemblokir akses wajib ganti password

### 41. Buat endpoint login penerbit JWT

### 42. Buat middleware verifikasi JWT global

### 43. Buat middleware otorisasi peran untuk endpoint

### 44. Integrasikan middleware ke semua route mutasi

### 45. Backend Step 3: Auth & JWT System

Setup sistem autentikasi JWT dan pengecekan role sesuai 8 tingkatan akses di PRD.

**Prompt:**

```
Di folder /backend: 1. Install @fastify/jwt. 2. Buat route POST /login yang memverifikasi username & password_hash dari tabel 'users'. 3. Generate JWT yang berisi user_id dan role (sesuai ENUM user_role). 4. Buat decorator 'authenticate' untuk memproteksi route dan decorator 'checkRole' yang membatasi akses berdasarkan array role yang diizinkan (misal: hanya 'treasurer' yang bisa akses kas).
```

### 46. Kembalikan respons asli untuk key duplikat

### 47. Buat middleware otorisasi peran RBAC

### 48. Terapkan pembatasan data per peran di semua endpoint

### 49. Tolak mutasi yang tidak punya idempotency key

### 50. Batasi akses database hanya lewat Fastify

### 51. Tolak login akun nonaktif dan berikan pesan 403
