# Users module

## Reset password (teacher-only)

`POST /api/users/:id/reset-password` memakai alur berikut:

1. `authenticate` memvalidasi JWT dan `requireCapability('users.manage')`
   membatasi endpoint ke Guru.
2. Client mengirim `X-Change-Reason` (minimal 5 karakter) dan
   `X-Idempotency-Key` (8–128 karakter). Key wajib dibuat baru untuk setiap
   reset yang benar-benar diinginkan.
3. Service menghasilkan password sementara acak yang aman juga di development,
   lalu mengirim hash saja ke repository.
4. Repository production hanya memanggil RPC
   `public.reset_user_password_atomic`; tidak ada lagi `UPDATE users` langsung.
5. RPC mengunci target, memvalidasi aktor Guru aktif, menyimpan key operasi,
   menaikkan `auth_version`, mengaktifkan `is_first_login`, dan menulis tepat
   satu audit event tanpa password/hash.
6. Retry dengan key yang sama menghasilkan `409 RESET_OPERATION_REPLAY`; hal
   ini mencegah reset ganda ketika pengguna menekan ulang atau jaringan pulih.

Password plaintext hanya dikembalikan pada response sukses pertama dan tidak
masuk ke audit log, cache idempotency generik, localStorage, atau database.
Dialog frontend menahan penutupan saat request berjalan, menyediakan salin
manual/clipboard fallback, dan menampilkan password sekali.

## Update akun dan username

`PUT /api/users/:id` memakai `X-Change-Reason` dan tetap mempertahankan
`users.id` sebagai identitas stabil. Username boleh diganti oleh aktor dengan
capability `users.manage`; username baru dipakai pada login berikutnya dan
tidak mengubah relasi siswa, nilai, absensi, atau audit yang menggunakan UUID.

Pada deployment Supabase, repository memanggil
`public.update_user_account_atomic`, bukan `UPDATE users` langsung. RPC ini
mengunci target, memvalidasi capability dan aturan akun-siswa, mengatur
konteks audit trigger, lalu menulis satu event audit kanonik. Perubahan yang
tidak menghasilkan state baru dikembalikan sebagai no-op tanpa audit duplikat.

Siswa baru memakai `member` sebagai default dan dapat langsung diberi role
`leader`, `vice_leader`, `treasurer`, `secretary`, `equipment_team`, atau
`contest_team`. Role `teacher` hanya untuk akun yang tidak terhubung ke siswa.

Error penting: `DUPLICATE_USERNAME` (409), `USER_LINKED_STUDENT_ROLE` atau
`USER_LINKED_STUDENT_NAME` (422), `USER_INACTIVE_STUDENT` (409), dan
`USERS_SCHEMA_UNAVAILABLE` (503 ketika migration 041 atau 067 belum diterapkan).

## Error contract

Error endpoint menggunakan envelope `{ success: false, error, error_code,
message, request_id }`. Kode penting: `RESET_USER_NOT_FOUND` (404),
`RESET_ACTOR_FORBIDDEN` (403), `RESET_OPERATION_REPLAY` (409), dan
`RESET_REASON_INVALID`/`RESET_OPERATION_KEY_INVALID` (422).

Migration `040_admin_password_reset_atomic.sql` dan
`041_user_account_update_atomic.sql` wajib diterapkan setelah migration 039
dan `067_allow_student_committee_roles.sql` setelahnya sebelum endpoint
production digunakan. Migration 040 memperbaiki audit trigger
untuk seluruh perubahan users baru; audit historis immutable yang terlanjur
mengandung hash tidak ditulis ulang otomatis.
