# Jalur rilis hotfix foto siswa

## Status dan batas izin

PR ini menambah **jalur yang dapat direview**, bukan menjalankan migrasi atau
deployment production. Tidak membuat approval, menyalakan READY, memindahkan
credential, membuat backup, atau menandai restore berhasil secara otomatis.
Jangan menganggap upload production sudah pulih hanya karena PR/CI hijau.

Scope hanya menambah
`public.update_student_profile_audited_atomic(uuid,text,text,text,text,text,uuid,text)`.
SQL migration 090 dan mirror Supabase tidak diubah. Checksum SQL tetap:

`432bfd1fa8894f7aa554eeabfcab98923563ae30737b26232b5e631d35096613`

Tidak ada replay baseline/history, perubahan tabel/data bisnis, role baru,
penonaktifan audit/RLS, atau akses fungsi untuk anon/authenticated.

### Delta backup yang telah disetujui

Gate dapat memakai evidence **format 4** (`reconciled-backup-role-v1`) sebelum
hotfix dan **format 5** (`reconciled-backup-role-student-photo-v1`) sesudahnya,
dengan `backupRolePolicy=sinegasi-backup-readonly-v1`. Format 2/3 tetap menolak
delta role; tidak ada fallback otomatis bila hash berbeda.

Policy read-only memverifikasi `sinegasi_backup`: LOGIN, INHERIT, BYPASSRLS,
connection limit 1, hanya setting `default_transaction_read_only=on`, tanpa
SUPERUSER/CREATEDB/CREATEROLE/REPLICATION atau setting per-database. Tepat dua
membership beserta grantor dan opsi ADMIN/INHERIT/SET harus cocok: `pg_read_all_data`
ke `sinegasi_backup` dari `postgres`, serta administrasi role backup oleh `postgres`
dari `supabase_admin`. Metadata tambahan, membership lain, atau grantor berbeda
ditolak. Tidak ada GRANT/REVOKE/ALTER ROLE yang dijalankan gate ini.

Hanya setelah validasi tersebut, satu role dan dua entry security dipisahkan
untuk pembandingan dengan checkpoint historis. Hash observasi/receipt tetap
mencakup catalog aktual beserta role backup, bukan hash yang telah dipisahkan.
Semua objek/ACL lainnya tetap harus cocok byte-exact; checkpoint tidak ditulis
ulang. Read-only default bukan pencabutan kemampuan `SET`: pembatasan akses baca
tetap berasal dari privileges role. Akses baca luas/BYPASSRLS adalah risiko role
backup yang sudah dipilih, bukan permission baru dari hotfix.

## Urutan operator

| Tahap | Yang dilakukan | Bukti selesai |
| --- | --- | --- |
| 1. Review | Review PR, merge lewat required CI, catat exact current main | CI push main backend/frontend sukses |
| 2. Rehearsal | Uji SQL di PostgreSQL 17 dummy, bukan DEV/production; uji rollback dan guard CI | Receipt rehearsal baru dan cleanup terverifikasi |
| 3. Pemulihan sebelum migrasi | Backup terenkripsi baru, restore public di tempat terpisah, salinan ciphertext, cek kunci independen | Evidence baseline format 2/4, maksimal 2 jam; observasi maksimal 30 menit |
| 4. Approval migrasi | Owner/reviewer meninjau exact SQL, release, receipt dan window | Approval migrasi privat baru; checksum byte exact |
| 5. Migrasi | Jalankan source CLI dari clean exact main pada Mac | Receipt commit privat; belum deploy backend |
| 6. Pemulihan sesudah migrasi | Backup/restore baru yang sudah mencakup fungsi baru; observasi catalog aktual | Evidence deployment format 3/5 dengan receipt migrasi |
| 7. Rilis backend | Build, review artifact, approval deployment baru, dispatch deploy terpisah | Gate CI/runtime dan health lulus |
| 8. Penerimaan | Uji upload lewat record/akun dummy yang disetujui, reload dan periksa audit | Foto tersimpan dan tidak ada error baru |

Backup cron berstatus sehat atau sekadar daftar isi archive **bukan** bukti
restore untuk rilis. Evidence pemulihan tetap mengikuti kontrak di
[gate production](../../ops/production-gate/README.md). Backup database bukan
backup seluruh file media R2. Data managed Auth/Storage yang tidak kosong
tetap menghentikan jalur ini sampai review recovery managed terpisah.

### 1. Perintah aman untuk melihat rencana — Mac

Dari folder `backend`:

```sh
ENV_FILE_LOADING=disabled node --import tsx src/scripts/studentPhotoProductionCli.ts plan
```

Harapan: `databaseAccessed=false`, `productionChanged=false`,
`approvalCreated=false`. Perintah ini tidak membaca password/Keychain.

### 2. Rehearsal dan bukti yang harus nyata

Generator yang sudah ada:

```sh
ENV_FILE_LOADING=disabled node --import tsx src/scripts/studentProfileAuditRehearsal.ts --emit-sql
```

Outputnya **SQL dummy**, bukan perintah untuk SQL Editor production/DEV.
Jalankan hanya di database disposable yang diwajibkan guard fixture. Gunakan
PostgreSQL 17 terpin, tanpa secret aplikasi, tanpa port publik, resource dibatasi,
dan verifikasi cleanup. Jangan menghilangkan guard agar cocok dengan target lain.

Receipt rehearsal privat harus canonical JSON (tanpa newline/field tambahan):

| Field | Nilai yang dibuktikan |
| --- | --- |
| `status` | `STUDENT_PROFILE_AUDIT_REHEARSAL_OK` dari eksekusi nyata |
| `releaseSha`, `sqlSha256` | Exact main yang direview dan checksum SQL di atas |
| `guardQualityRunId` | CI push main sukses yang juga menguji runner/gate baru |
| `postgresMajor` | `17` |
| `verifiedAt` | ISO UTC millisecond, maksimal 2 jam |
| `cleanupVerified` | `true`, setelah benar-benar diperiksa |
| `productionChanged`, `devDatabaseChanged` | Keduanya `false` |
| `checks` | Tepat enam pemeriksaan berikut, tanpa duplikat |

`legacyFailureReproduced`, `auditedUpdatePassed`, `invalidActorReasonRefused`,
`auditFailureRollsBack`, `contextRestored`, `publicExecuteDenied`.

Receipt ini attestation operator berdasarkan bukti; checksum bukan tanda tangan
dan tidak membuktikan tes telah dijalankan. Hasil unit test sintetis bukan receipt
provider/restore/rehearsal production yang boleh disalin menjadi approval.
Unit test runner memodelkan transaksi; tidak menggantikan rehearsal end-to-end
runner pada database disposable lengkap untuk exact release sebelum aktivasi.

Pemeriksaan security catalog historis memakai tipe PostgreSQL `name`, sehingga
signature panjang terpotong ke 63 byte. Adapter mempertahankan hash checkpoint
lama dan hanya memisahkan satu entry exact milik RPC baru setelah seluruh
metadata/body/ACL-nya diverifikasi. Entry hilang atau collision ganda ditolak;
nama fungsi lain dan checkpoint tidak diubah.

### 3. Approval migrasi terpisah

Approval privat memiliki tepat field berikut:

`format=1`, `operation=add-student-photo-audit-rpc-v1`, `project`,
`releaseSha`, `sqlSha256`, `baselineEvidenceSha256`, `rehearsalSha256`,
`qualityRunId`, `approvedBy`, `windowStart`, `windowEnd`,
`maintenanceWindowConfirmed=true`, `noOtherWriters=true`,
`databaseRollbackCompatible=true`, `noDeploymentAuthorized=true`.

Window ISO UTC millisecond maksimal 45 menit. Approval mengikat exact bytes
evidence baseline format 2 dan rehearsal; bukan izin deploy backend.
Solo-owner harus eksplisit sesuai policy environment; bukan reviewer independen.
Runner Mac ini hanya menerima mode solo-owner yang telah dipilih eksplisit.
Mode independent-review ditolak: nama/checksum file lokal tidak membuktikan
persetujuan reviewer independen. Jangan mengubah mode untuk melewati penolakan;
mode itu membutuhkan jalur eksekusi/review terproteksi tersendiri.

Simpan dokumen dan receipt di direktori privat owner `0700`, file `0600`.
Jangan post ke GitHub/chat: credential, isi backup, data siswa, atau evidence/
approval operasional lengkap. Tidak ada contoh dokumen approved siap-pakai
karena nilai, waktu, dan pemeriksaannya harus berasal dari pelaksanaan nyata.

### 4. Pengaman aktivasi dan perintah apply

Di GitHub: repository → **Settings → Environments → production → Variables**.
Variabel baru `PRODUCTION_STUDENT_PHOTO_MIGRATION_READY` defaultnya tidak ada/
false. Hanya setelah bukti dan window direview, operator boleh mengaktifkannya
sementara. Ini tidak mengaktifkan `PRODUCTION_DEPLOYMENT_READY` dan tidak
menghapus required reviewer, main-only, atau admin-bypass protection.

Source CLI hanya berjalan pada Mac, dari clean exact main yang sama dengan CI.
Tidak menggunakan compiled `dist` lama. Koneksi memakai file privat yang telah
diizinkan sebelumnya: tepat `postgresUrl` dan `ca`, session pooler port 5432,
target production terpin, TLS hostname/CA diverifikasi. Bila file belum tersedia,
**berhenti untuk keputusan custody tersendiri**; jangan otomatis menyalin
credential admin dari VPS atau mengambil Keychain.

CLI `apply` mewajibkan seluruh flag berikut; **jangan paste placeholder sebagai
perintah jadi**:

`--approval`, `--confirm-approval`, `--baseline`, `--confirm-baseline`,
`--rehearsal`, `--snapshot`, `--release-sha`, `--connection`, `--receipt`,
`--confirm-project`.

Snapshot harus file repository `ops/production-schema.snapshot.json`.
Checksum berasal dari byte file privat aktual, bukan nilai contoh atau bukti lama.
Receipt tujuan harus baru; file existing tidak ditimpa.

Runner memeriksa approval, freshness, current main, CI backend/frontend, actual
environment protection dan flag khusus sebelum koneksi; pemeriksaan diulang
sebelum commit. Dalam satu transaksi: lock terikat timeout, identity/PID PostgreSQL,
checkpoint complete, baseline penuh, fungsi belum ada, satu SQL terpin, dan
postcondition exact. SHARE lock dapat menahan penulisan aplikasi; gunakan window
sepi yang disetujui. Tidak ada janji zero downtime.

### 5. Cara membaca hasil dan kegagalan

- `STUDENT_PHOTO_MIGRATION_COMMITTED`: commit mendapat balasan dan receipt
  tersimpan/fsync. **Backend belum dideploy.**
- Approval/checksum/window/quality/READY gagal: tidak boleh dipaksa dengan flag
  bypass, edit timestamp, atau mengganti reviewer.
- `ALREADY_PRESENT_INSPECT_DO_NOT_RETRY`: fungsi sudah ada; bukan izin
  overwrite. Periksa metadata dan attempt/receipt privat.
- Drift baseline/ACL/fungsi lain: STOP. Jangan memperluas allowlist,
  memperbarui checkpoint historis, atau mengklaim perubahan lain sebagai hotfix.
- COMMIT/penyimpanan receipt tidak pasti: **jangan ulang apply**. Attempt privat
  dipertahankan, tidak otomatis ditimpa. Inspeksi read-only dan rekonsiliasi bukti
  diperlukan sebelum keputusan baru. SQL tidak otomatis diretry.

Setelah selesai, operator menonaktifkan flag migrasi khusus. Kode tidak memakai
hak tulis GitHub untuk mengganti variabel itu sendiri.

### 6. Evidence deployment sesudah migrasi

Format 2 tetap untuk baseline lama. Format 3 memakai mode
`reconciled-student-photo-v1` dan tambahan `studentPhotoChange` berisi receipt
migrasi. Seluruh field recovery/media/review/rehearsal lama tetap diwajibkan.
Field `observation.targetCatalogSha256` dan `schemaSecuritySha256` harus sama
dengan hash catalog pascamigrasi aktual.

Gate memverifikasi body, signature, seluruh atribut executable dan ACL exact dari
satu fungsi baru; barulah addition itu dipisahkan saat membandingkan **semua**
objek/ACL baseline dengan checkpoint lama. Fungsi lama dan checkpoint tidak
diubah. Mode lama tidak diam-diam menerima fungsi baru. Semua pemeriksaan runtime
deployment tetap read-only; build tidak otomatis deploy.

### 7. Rollback

Sebelum COMMIT gagal: transaksi di-ROLLBACK; tidak ada perubahan data bisnis.
Setelah COMMIT berhasil tetapi backend gagal: gunakan artifact backend lama yang
tepat lewat jalur rollback existing. Biarkan fungsi additive; jangan DROP saat
backend baru masih dapat memakainya. Backend lama tetap kompatibel, tetapi bug
upload lama dapat kembali. Restore seluruh database bukan rollback rutin hotfix.

## Bukti pengujian PR ini

Tes negatif mencakup checksum/body/ACL berubah, scope bertambah, evidence
kedaluwarsa, reviewer/policy salah, fungsi sudah ada, drift objek lain, pencabutan
readiness/window sebelum commit, dan COMMIT ambigu. Metadata fungsi DEV nyata
diperiksa read-only melalui validator yang sama. Tidak ada bukti ini yang
menyatakan migration runner sudah dieksekusi di production.

Rehearsal runner juga telah dijalankan pada PostgreSQL 17.11 disposable dengan
baseline lengkap dan authorization **sintetis khusus tes**: commit/metadata nyata,
rollback DDL saat readiness dicabut, data bisnis tidak berubah, gate lama menolak
addition, apply ulang ditolak, drift ACL lain ditolak, dan balasan COMMIT hilang
tidak diretry. Container dibersihkan; production/DEV/Caddy tetap sama. Hasil tes
ini bukan approval atau receipt recovery production.

Rujukan: [Supabase: fungsi database dan privileges](https://supabase.com/docs/guides/database/functions).
