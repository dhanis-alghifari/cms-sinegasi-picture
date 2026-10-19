# Perbaikan foto profil siswa — 19 Oktober 2026

## Status

Perbaikan disiapkan dan diuji, **belum diterapkan ke database atau backend
production**. Jangan menganggap upload production sudah pulih sebelum rilis
dan pemeriksaan sesudah rilis selesai.

## Penyebab yang terkonfirmasi

Pembaruan profil ikut menyinkronkan nama akun login yang terhubung. Trigger
audit akun menolak pembaruan karena transaksi database tidak menerima
identitas pelaku dan alasan perubahan. Akibatnya seluruh pembaruan, termasuk
foto, dibatalkan. Pesan browser `STUDENT_OPERATION_FAILED` tidak menunjukkan
penyebab internal tersebut. Pemeriksaan memakai metadata/error terpilah;
tidak menyalin foto, nomor telepon, nama, password, atau data siswa ke dokumen ini.

## Perubahan

- Backend meneruskan `actorId` dan alasan yang sudah divalidasi melalui **satu
  RPC**, bukan mengatur session pada permintaan terpisah ke connection pool.
- RPC baru `update_student_profile_audited_atomic` memeriksa akun pelaku aktif
  dan izin `students.manage`, kemudian memanggil RPC lama dengan konteks audit
  transaction-local. Trigger audit tetap berjalan; tidak ada bypass audit.
- RPC baru menggunakan `SECURITY INVOKER`, search path kosong, dan izin
  eksekusi hanya untuk `service_role`, bukan `anon`/`authenticated`/`PUBLIC`.
- RPC lama beserta signature/grants-nya tidak diubah. Database dapat diperbarui
  lebih dahulu tanpa memutus pemanggilan backend lama.
- Pembaruan parsial mempertahankan kolom yang tidak dikirim. Nilai kosong
  eksplisit tetap dapat menghapus foto/kolom opsional.
- Audit profil siswa pada lapisan API tetap dipertahankan. Perubahan ini
  memperbaiki konteks **audit trigger akun**; tidak menjadikan audit API
  terpisah tersebut satu transaksi dengan mutasi database.

## Berkas rilis

- Supabase: `supabase/migrations/20261019135428_student_profile_audit_context.sql`
- Mirror runner development: `backend/src/migrations/090_student_profile_audit_context.sql`
- Keduanya identik dan diuji parity. Jangan mengeksekusi keduanya sebagai dua
  migrasi terpisah pada database yang sama; pilih runner yang sesuai target.
- Jangan mengubah baseline/checksum migrasi historis atau menandai manifest
  draft lama sebagai approved untuk memaksa deployment.

SHA256 kedua berkas SQL:

`432bfd1fa8894f7aa554eeabfcab98923563ae30737b26232b5e631d35096613`

## Bukti uji PostgreSQL nyata

Uji dijalankan pada PostgreSQL 17.11, image cache terpin:

`postgres@sha256:3645570cccdfa447589da9f57dd740faa29b30938e861289a5574b6ca6b03826`

Container dummy memakai network `none`, tanpa host port, tanpa mount/secret
aplikasi, filesystem read-only dan data tmpfs, non-root, capability dibuang,
RAM 384 MiB/CPU 0,5. Nama database khusus serta penolakan database berisi tabel
aplikasi diperiksa sebelum fixture dibuat. Fungsi lama dan trigger audit
diambil langsung dari baseline repository, bukan mock yang selalu berhasil.

Hasil: `STUDENT_PROFILE_AUDIT_REHEARSAL_OK`.

| Pemeriksaan | Hasil |
| --- | --- |
| RPC lama + akun terhubung memicu error Zero Silent Edits | Terulang, perubahan rollback |
| RPC baru menyimpan profil/foto serta menyinkronkan nama akun | Lulus |
| Audit mencatat pelaku, alasan terpangkas spasi, source trigger | Lulus |
| Password hash pada payload audit tetap disamarkan | Lulus |
| Pelaku kosong/tidak ada/nonaktif/tanpa izin | Ditolak |
| Alasan kosong/terlalu pendek/terlalu panjang | Ditolak |
| Insert audit sengaja dibuat gagal | Profil dan akun rollback |
| Konteks audit sesudah sukses/gagal | Tidak bocor |
| Flag skip audit dari transaksi luar | Tidak membungkam trigger; nilai luar dipulihkan |
| Hapus foto dan profil tanpa akun login | Lulus |
| Akses RPC anon/authenticated; invoker bukan definer | Sesuai batas izin |
| Migrasi diterapkan dua kali pada fixture | Lulus |

Setelah uji, transaksi fixture di-rollback dan tabel fixture dipastikan tidak
ada. Container dummy sudah dihentikan/dihapus. Container API production, API
dev, dan Caddy mempertahankan ID serta status berjalan semula. Tidak ada
database production/dev atau data siswa nyata yang dimutasi oleh uji ini.

Ini bukan bukti deployment atau uji managed Supabase end-to-end. Unit/route
tests melengkapi uji database dengan gambar PNG sintetis valid, pemetaan
payload browser, validasi gambar, otorisasi, dan penolakan fallback RPC lama.

Checkpoint patch pada branch monitoring: 27 tes modul siswa/migrasi lulus;
backend lengkap 686 lulus/1 dilewati, OpenAPI 162 operasi dan build lulus.
Hotfix kemudian dipisahkan dari main tanpa fitur monitoring: backend lengkap
675 lulus/1 tes localhost PostgreSQL terpisah dilewati, typecheck/build dan
OpenAPI 161 operasi lulus. Sebanyak 22 tes guard/rollback rilis dan pemeriksaan
guardrail deployment lulus. Percobaan suite pertama gagal hanya karena sandbox
melarang socket loopback pada tes graceful shutdown; pengulangan dengan izin
socket lokal lulus. Hasil ini bukan quality CI pada exact main release SHA.

## Pemeriksaan lokal yang aman

Jalankan dari folder `backend` pada Mac:

```sh
ENV_FILE_LOADING=disabled node --import tsx --test src/modules/students/students.repository.test.ts src/modules/students/students.service.test.ts src/modules/students/students.routes.test.ts src/migrations/090_student_profile_audit_context.test.ts
ENV_FILE_LOADING=disabled npm run quality:check
```

Generator fixture `studentProfileAuditRehearsal.ts --emit-sql` hanya mengeluarkan
SQL sintetis untuk database dummy kosong. **Jangan menjalankannya pada
production/dev**, dan jangan mematikan guard database agar dapat dijalankan.

## Urutan pemasangan — masih memerlukan review/approval rilis

1. Pisahkan patch ini dari perubahan monitoring/dokumentasi yang belum dirilis;
   review kode dan SQL. Jangan membawa perubahan unrelated ke hotfix.
2. Rehearsal pada target staging yang disetujui; periksa advisor, grants, dan
   fungsi existing. Hasil dummy di atas bukan pengganti verifikasi platform.
3. Pastikan backup terenkripsi baru dan bukti restore yang sesuai masih valid.
   Siapkan approval migrasi **baru** sesuai exact SQL/checksum/target/release.
4. Terapkan hanya migrasi baru sebagai satu transaksi melalui jalur yang
   disetujui. Jangan replay seluruh migrasi historis/baseline reconciliation.
5. Verifikasi function/grants berikut, tanpa mengambil data siswa.
6. Promosikan hotfix melalui main + quality CI dan workflow production yang
   ada, menggunakan exact SHA/image digest serta approval deployment baru.
   Workflow build tidak otomatis men-deploy; jangan bypass gate-nya.
7. Uji melalui akun/record pengujian yang disetujui: pilih PNG/JPG/WebP valid,
   isi alasan perubahan, simpan, muat ulang, dan cek foto serta audit. Jangan
   mengubah profil siswa nyata hanya untuk pengujian otomatis.
8. Periksa error setelah rilis berdasarkan waktu/request ID, tanpa menyalin
   body request/base64 atau credential. Bila gagal, hentikan percobaan berulang
   dan periksa tahap yang gagal; jangan menonaktifkan trigger/RLS/TLS.

Query metadata read-only setelah migrasi:

```sql
SELECT p.proname, p.prosecdef, p.proconfig,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_execute
FROM pg_catalog.pg_proc AS p
WHERE p.oid = to_regprocedure(
  'public.update_student_profile_audited_atomic(uuid,text,text,text,text,text,uuid,text)'
);
```

Harapan: satu baris, `prosecdef=false`, search path kosong,
`anon_execute=false`, `authenticated_execute=false`, `service_execute=true`.
Tidak ada baris berarti fungsi belum tersedia, bukan sukses.

## Rollback aman

Jika backend baru bermasalah, kembalikan ke artifact backend lama yang tepat
melalui workflow rollback yang ada. RPC baru bersifat additive dan dapat
dibiarkan; jangan menghapus fungsi saat backend baru masih memakainya.
Kembali ke backend lama juga berarti bug foto lama dapat kembali muncul.
Tidak ada data yang dihapus/backfill oleh migrasi ini; rollback bukan alasan
untuk merestore seluruh database atau menghilangkan audit.

Rujukan: [Supabase database functions dan pembatasan EXECUTE](https://supabase.com/docs/guides/database/functions).
