# Konfigurasi production — setup terbatas tanpa deploy, 13 Oktober 2026

Panduan ini bukan approval tambahan, receipt media, atau izin deploy.
Pada inspeksi setup awal tidak ada `.env`, Keychain, password custody, isi DB,
object R2 atau nilai secret dibaca; yang dibaca hanya metadata/pengaturan provider, source konfigurasi dan
metadata GitHub. Setelah pengguna menyetujui target bucket dan project Direct
Upload kosong, satu project Pages PROD dibuat. Setelah persetujuan CORS terpisah,
hanya policy CORS upload pada bucket PROD dipasang. Tidak ada konfigurasi runtime,
isi object, DB, public access, DNS atau secret diubah, dan tidak ada push baru.

**Status terbaru (custody, bukan deploy):** `r2.env` dan `backend.env` sudah
dibuat privat di VPS setelah izin masing-masing; receipt backend pada
`2026-10-13T16:42:16.985Z` mengakui satu transfer, key Supabase/R2 dan JWT
aplikasi baru. Backend/domain/frontend belum diaktifkan; `.env` DEV tidak diubah.
Bagian inspeksi awal di bawah adalah bukti historis, bukan status secret saat ini.

**14 Oktober — patch lokal saja:** [hardening proxy/network](proxy-network-hardening.md)
menghapus trust hop-only, memerlukan exact peer IP bila trust aktif, memisahkan
bridge PROD dari DEV/Caddy, dan menaikkan approval deployment ke format 3.
Tidak ada `.env`, VPS, DNS/Pages/Tunnel, Keychain, DB, subscription/visibility
GitHub, push atau deploy diubah pada tahap patch. Repo tetap private; workflow
existing tidak diberi bypass. Domain/proxy belum menjadi runtime aktif.

## Bukti saat inspeksi setup awal

| Target | Hasil |
| --- | --- |
| Main | `6abb0ae5c49f2d673795d01e0d0e146a2d66a1bf`, PR #10 merged; exact PR/main CI Node 22 lulus. |
| Account Cloudflare | `be04d420dc59ae25397156881c1c68ab`. |
| R2 `cms-dashboard-storage` | Target PROD dikonfirmasi pengguna; Standard/APAC; Public Development URL disabled; tidak ada custom domain. CORS PUT khusus `https://sinegasi.pictures` dipasang dan diperiksa GET pada `2026-10-13T11:37:58.643Z`; sebelumnya tidak ada policy (API 10059). Credential belum diakses/dikonfigurasi. |
| R2 `cms-dashboard-storage-dev` | Standard/APAC; Public Development URL enabled; tidak ada custom domain; CORS untuk DEV/localhost. Tidak diubah. |
| Worker Scripts | Inventory account kosong; bukan pemeriksaan service eksternal yang mungkin memiliki kredensial S3. |
| Pages DEV | `sinegasi-picture-develop-cms`, GitHub branch production `develop`, preview semua branch; tidak ada R2 binding production/preview saat inspeksi. Source/branch/domain DEV tetap cocok dengan baseline sesudah pembuatan PROD. |
| Pages PROD | `sinegasi-picture-prod-cms` dibuat Direct Upload kosong, production branch `main`, tanpa Git connection, deployment, custom domain, env var atau R2 binding. Diverifikasi GET pada `2026-10-13T11:31:53.005Z`. |
| Zone `sinegasi.pictures` | Active/full; tidak ada record A/AAAA/CNAME untuk apex, `www`, atau `api.sinegasi.pictures`. Tidak menguji resolusi/TLS atau seluruh rules routing. |
| GitHub environment | Belum ada environment; dukungan paket untuk private repo/main-only protection masih perlu dikonfirmasi. |

Inventaris bucket dan Pages selesai tanpa halaman lanjutan. Pemeriksaan tidak
menginventaris object/metadata attachment DB dan tidak membuktikan foto lama ada
di bucket PROD. Akses kredensial, signed URLs yang pernah diterbitkan,
service eksternal, upload/download dan browser belum diuji. Hasil sesaat ini
tidak boleh dipakai sebagai receipt boolean gate tanpa inspeksi ulang.

**Perhatian:** bucket DEV masih memiliki public access. Jangan menaruh data
sensitif di sana. Menutup aksesnya perlu tindakan terpisah dan pengecekan
kompatibilitas DEV; patch source tidak mencabut URL publik existing atau cache
yang sudah tersebar. Tidak ada klaim bahwa seluruh asset existing sudah privat.

## Setup yang sudah selesai

1. `cms-dashboard-storage` ditetapkan sebagai target bucket PROD berdasarkan
   persetujuan pengguna; ini bukan pergantian konfigurasi backend yang sedang
   berjalan atau bukti bucket benar-benar digunakan aplikasi. Tidak membuat
   bucket duplikat atau memakai `cms-dashboard-storage-dev`.
2. Pages PROD `sinegasi-picture-prod-cms` dibuat **Direct Upload**, branch
   production `main`, kosong tanpa Git connection, deployment atau custom domain.
   Hostname bawaan `sinegasi-picture-prod-cms.pages.dev` telah dialokasikan;
   tidak ada website/aset aplikasi diunggah dan tidak diuji sebagai website aktif.
   Direct Upload mendukung deploy melalui CI/Wrangler, tetapi tidak bisa diubah
   menjadi Git-integrated project kemudian. Dashboard **Save and Deploy** bukan
   langkah setup kosong.
   [Kontrak Cloudflare](https://developers.cloudflare.com/pages/get-started/direct-upload/).
3. CORS PROD: tepat satu rule, origin `https://sinegasi.pictures`, method `PUT`,
   header `Content-Type`, max age 300 detik, tanpa exposed header atau wildcard.
   GET provider cocok dengan policy yang disetujui; `r2.dev` tetap disabled,
   custom domain tetap nol, dan policy CORS DEV identik dengan baseline sebelum
   perubahan. Ini belum menguji preflight/upload browser atau otorisasi object.

## Tahap berikutnya — izin terpisah masih diperlukan

1. Tinjau jalur domain/proxy aktual dan konfigurasi build frontend PROD;
   custody key R2/Supabase + JWT aplikasi sudah selesai, belum koneksi runtime.
   Jangan menebak `TRUST_PROXY` atau mengubah DNS/Tunnel/routing tanpa scope baru.
2. Lengkapi gate release: credential privileged `schema-gate.json` memerlukan
   izin terpisah dan tidak boleh masuk runtime API; recovery independen dan
   evidence/rehearsal harus sesuai kontrak. Source runner baru belum dipromosikan
   melalui main/CI. Membuat file custody bukan menyiapkan seluruh release.
3. Jangan dispatch workflow atau mengatur `PRODUCTION_DEPLOYMENT_READY=true`.
   Environment production, custody recovery independen, runtime/rollback rehearsal,
   fresh schema/backup/media evidence dan approval baru tetap diperlukan.

## Yang perlu dikonfigurasi pengguna setelah izin setup

Jangan mengubah `backend/.env` DEV atau variable project Pages DEV.

| Tempat | Konfigurasi |
| --- | --- |
| Build frontend PROD, root `frontend`, output `dist` | Node 22; `npm run build:production`; `VITE_API_URL=https://api.sinegasi.pictures`; `VITE_MEDIA_ACCESS_MODE=authenticated-proxy`. |
| Build frontend PROD | `VITE_R2_PUBLIC_DOMAIN` tidak diatur; jangan masukkan Supabase service/secret key atau R2 access/secret key ke frontend. |
| Direct Upload | Variable Vite harus tersedia pada **proses build CI/lokal yang ditinjau**, bukan mengandalkan variable dashboard Pages untuk mengubah bundle yang sudah dibuat. Belum ada workflow frontend PROD yang disiapkan/disetujui. |
| Backend PROD, `/opt/sinegasi-prod/config/backend.env` | `CORS_ORIGINS=https://sinegasi.pictures`; account ID di atas dan bucket yang dikonfirmasi melalui `CLOUDFLARE_R2_ACCOUNT_ID` / `CLOUDFLARE_R2_BUCKET_NAME`. |
| Backend PROD saja | `CLOUDFLARE_R2_ACCESS_KEY_ID` dan `CLOUDFLARE_R2_SECRET_ACCESS_KEY`: kredensial baru/yang ditinjau dengan Object Read & Write **hanya bucket PROD**. Jangan kirim nilainya ke chat atau memakai token admin account. Custody/transfer perlu izin terpisah. |
| Backend PROD saja | Supabase production backend key, JWT secret kuat dan schema-gate credential mengikuti [kontrak gate](../../ops/production-gate/README.md); tidak menyalin `.env` DEV. |
| Backend PROD | `CLOUDFLARE_R2_PUBLIC_DOMAIN`, `R2_PUBLIC_DOMAIN`, dan alias deployment lama `PRODUCTION_MEDIA_PUBLIC_DOMAIN` kosong/tidak diatur. |
| Bucket PROD → Settings | Public Development URL tetap disabled; tidak menambahkan public custom domain atau public Worker/binding yang mengekspos object. |
| DNS/Tunnel/Pages custom domain | Target `api.sinegasi.pictures` dan `sinegasi.pictures`; belum dihubungkan. Jangan membuka port API langsung atau mengganti routing DEV. |

Endpoint S3 `https://be04d420dc59ae25397156881c1c68ab.r2.cloudflarestorage.com`
dipakai backend, bukan nilai `VITE_API_URL` atau URL gambar browser. Media GET
melalui API terautentikasi dan berotorisasi; CORS bukan kontrol autentikasi.

### CORS upload — sudah diterapkan, belum acceptance browser

Source frontend mengirim signed PUT staging dengan header `Content-Type`.
GET gambar berjalan melalui backend, sehingga tidak diperlukan browser GET R2.
Policy aktif yang telah diverifikasi GET, dalam format JSON dashboard R2:

```json
[
  {
    "AllowedOrigins": ["https://sinegasi.pictures"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 300
  }
]
```

Ini format S3/dashboard; REST API Cloudflare memakai wrapper `rules` dan nama
`allowed.origins/methods/headers`. Jangan mengirim format di atas ke REST endpoint.
Tidak ada wildcard/localhost/DEV origin pada PROD. CORS hanya mengizinkan browser
melakukan signed upload; URL PUT tetap capability tulis sementara dan harus dijaga.
Verifikasi aktual preflight/upload setelah izin acceptance; jangan menambahkan GET
atau mengaktifkan public access untuk memperbaiki upload.

### Token R2 — langkah penyimpanan pengguna

Sebelum membuka dialog Keychain, pengguna perlu menyiapkan kunci secara privat:

1. Buka Cloudflare account di atas → **R2 object storage → Overview**.
   Pada **Account Details → API Tokens**, pilih **Manage**. Ini token khusus R2,
   bukan Global API Key atau token Pages.
2. Pilih **Create Account API token**, nama `sinegasi-prod-backend`;
   **Object Read & Write**, **Apply to specific buckets** → hanya
   `cms-dashboard-storage`. Jangan memilih Admin Read & Write, all buckets,
   atau menambahkan bucket DEV. Jika pilihan account token tidak tersedia atau
   dashboard meminta aktivasi/pembayaran/privilege lain, STOP dan laporkan;
   runner tidak mengganti paket atau memperluas permission secara otomatis.
3. Setelah pengguna memilih Create, simpan **Access Key ID** dan **Secret Access
   Key** secara privat sebelum meninggalkan halaman; secret hanya ditampilkan
   saat pembuatan. Pilihan expiry/rotasi harus dicatat, bukan diasumsikan tersedia
   selamanya. [Panduan autentikasi Cloudflare](https://developers.cloudflare.com/r2/api/tokens/).
4. Di **Keychain Access → login → File → New Password Item**, buat dua item baru:

   | Keychain Item Name | Account | Password |
   | --- | --- | --- |
   | `sinegasi-prod-r2-access-key-id` | `cms-dashboard-storage` | Nilai Access Key ID dari Cloudflare, bukan API token. |
   | `sinegasi-prod-r2-secret-access-key` | `cms-dashboard-storage` | Nilai Secret Access Key dari Cloudflare. |

   Nama ini kontrak custody yang diusulkan untuk langkah berikutnya, bukan bukti
   item telah ada; belum ada pembacaan/import/transfer kunci dijalankan.
   Jangan menimpa item DEV, memasukkan kunci ke `.env` DEV/`VITE_*`, screenshot,
   chat, repo, terminal argument atau clipboard log. Jangan memindahkan ke VPS
   sebelum izin custody/transfer dan pemeriksaan scope terpisah.
5. Konfirmasi hanya **kunci R2 siap**, tanpa nilainya. Runner tetap menjelaskan
   tujuan pembacaan dan meminta kesiapan/izin sebelum memunculkan dialog.

Policy CORS tidak membuktikan token dibatasi bucket. Permission/resource scope
harus ditinjau dari konfigurasi token aktual tanpa memaparkan secret; tes R2
nyata tetap perlu izin tersendiri. Sampai itu selesai,
`credentialsBucketScoped`/readiness tidak boleh dinyatakan verified.

### Verifikasi kredensial R2 baca-saja — runner lokal

Pengguna menyatakan kedua item tersimpan dan mengizinkan persiapan runner,
tes offline, pembacaan privat kedua item, serta satu request `HeadBucket`.
Izin ini tidak mencakup object listing/GET/PUT/DELETE, pembacaan `.env`,
transfer credential ke VPS, push/PR, DNS/CORS atau deploy.

Runner `backend/src/scripts/productionR2Connection.ts` memiliki dua mode:

```sh
ENV_FILE_LOADING=disabled npm run r2:production:plan
ENV_FILE_LOADING=disabled npm run r2:production:verify -- --keychain-ready
```

Jalankan dari folder backend. Mode verify hanya setelah izin/readiness Keychain;
jangan menjalankannya ulang otomatis. `plan` tidak mengakses Keychain/jaringan.
Environment debug/injeksi (`DEBUG`, `NODE_DEBUG`, `NODE_OPTIONS`, `SSLKEYLOGFILE`)
dan TLS verification yang dinonaktifkan ditolak. Saat environment shell membawa
DEBUG, gunakan proses dengan environment bersih yang ditinjau; jangan melemahkan
guard atau mencetak nilai environment. Tes offline runner menggunakan adapter
sintetis, bukan credential, endpoint production atau fixture berisi asset nyata.

Kontrak request: satu `HEAD` bertanda tangan SigV4 pada endpoint account di atas
dan path `/cms-dashboard-storage`, region `auto`, tanpa query/body/redirect/retry.
HTTPS memverifikasi sertifikat, timeout 10 detik dan batas header 8 KiB; tidak
mengonsumsi body response. Keychain dibaca lewat `/usr/bin/security` tanpa shell,
dengan service/account/keychain tetap, output maksimum 1 KiB dan timeout 90 detik
per item. Error mentah, credential, signature dan header response tidak dicetak
atau disimpan. Pembatasan transport diuji dengan request di luar scope ditolak
sebelum koneksi. Tidak mengubah modul R2 runtime atau menambahkan dependency.

Hanya HTTP 200 menghasilkan `PRODUCTION_R2_HEAD_BUCKET_VERIFIED`. Hasil 403/404
tidak otomatis berarti kunci salah: HEAD tidak memiliki body diagnostik; berhenti
dan lakukan diagnosis terpisah, tanpa memperluas permission atau retry otomatis.
Sukses hanya membuktikan akses HeadBucket, bukan permission tulis, scope eksklusif
bucket, keberadaan/privasi foto existing, alur browser atau kesiapan launch.
`credentialsBucketScopedVerified`, `backendRuntimeConfigured`,
`browserMediaFlowTested` dan `readyForPublicLaunch` tetap false.
Scope token harus ditinjau dari konfigurasi permission/resource aktual; receipt
ini bukan pengganti bukti media pada gate deployment.

Referensi: [R2 S3 compatibility](https://developers.cloudflare.com/r2/api/s3/api/),
[HeadBucket](https://docs.aws.amazon.com/AmazonS3/latest/API/API_HeadBucket.html),
[SigV4 header signing](https://docs.aws.amazon.com/AmazonS3/latest/developerguide/sig-v4-header-based-auth.html).

Hasil fase ini, dicatat `2026-10-13T13:04:27Z`:

- Typecheck lulus; 10 tes runner offline lulus; suite backend keseluruhan
  607 pass / 1 skip / 0 fail; guardrail deployment dan `git diff --check` lulus.
- Plan dari npm di shell awal ditolak karena flag DEBUG hadir (nilainya tidak
  dibaca/dicetak). Plan dan percobaan verify dijalankan lewat proses Node dengan
  environment bersih, bukan dengan melemahkan guard.
- Verify berhenti `KEYCHAIN_READ_FAILED` pada item access-key-id:
  `keychainReadsAttempted=1`, `headBucketAttempts=0`. Tidak ada request R2 dikirim.
  Diagnostik mentah sengaja tidak disimpan; penyebab izin/timeout belum dibuktikan.
- Pemeriksaan metadata kedua service dengan account `cms-dashboard-storage`
  pada login keychain menemukan keduanya, tanpa flag `-w`/pembacaan password.
  Nama/account cocok, tetapi ini belum membuktikan nilai credential benar.
- Tidak mengulang pembacaan secret atau request; diperlukan kesiapan operator
  untuk dialog Allow sebelum percobaan terkontrol berikutnya. Tidak ada perubahan
  object/DB/runtime/config/DNS/CORS/public access/deployment atau push/commit.

Percobaan baru setelah pengguna menyatakan `siap, munculkan dialog lagi`,
diamati `2026-10-13T14:47:48.951Z`:

- `PRODUCTION_R2_HEAD_BUCKET_VERIFIED`, HTTP 200, kedua item Keychain terbaca;
  `keychainReadsAttempted=2`, `headBucketAttempts=1`. Proses selesai exit 0.
- Satu HEAD bertanda tangan pada bucket `cms-dashboard-storage` berhasil;
  tidak ada retry/redirect, listing atau pembacaan/penulisan object. Nilai kunci,
  signature dan diagnostik mentah tidak dicetak/disimpan dalam dokumen ini.
- Hasil hanya membuktikan akses HeadBucket. Scope credential eksklusif bucket,
  permission tulis, keberadaan/privasi foto existing dan alur browser belum
  terverifikasi; `credentialsBucketScopedVerified=false`.
- `backendRuntimeConfigured=false`, `browserMediaFlowTested=false`,
  `productionChanged=false`, `deploymentPerformed=false`,
  `readyForPublicLaunch=false`. Tidak membaca/mengubah `.env`, mentransfer kunci
  ke VPS, mengubah DB/DNS/CORS/public access, atau melakukan commit/push.

### Pemeriksaan scope setelah HEAD berhasil

Pada `2026-10-13T14:57:41Z`, pembacaan metadata lewat koneksi Cloudflare yang
tersedia ke `GET /accounts/<ACCOUNT_ID>/tokens` ditolak dengan API error `9109`
(`Unauthorized to access requested resource`). Tidak ada metadata token yang
berhasil diperoleh. Tidak mencoba token lain, membaca Keychain lagi, melakukan
probe bucket DEV, atau menambah permission koneksi/token.

Operator perlu membuka **R2 object storage → Overview → Account Details →
API Tokens → Manage**, lalu metadata token `sinegasi-prod-backend`, dan memastikan:

- Token aktif, **Object Read & Write**, **specific buckets** hanya
  `cms-dashboard-storage`; bukan Admin, all buckets atau bucket DEV.
- Token itu memang pasangan Access Key ID/Secret Access Key yang disimpan pada
  dua item Keychain dan dipakai oleh HEAD sebelumnya; nama token saja tidak
  membuktikan kecocokan tersebut.
- Catat expiry sebenarnya (termasuk jika tanpa expiry) dan filter IP sebenarnya;
  jangan menganggap TTL 90 hari atau IP egress VPS sudah diverifikasi.
- Bukti screenshot hanya permission/resource/status/expiry, tanpa token value,
  access key, secret key atau password. Jangan membuka halaman credential untuk
  dikirim ke chat. Ini peninjauan, bukan instruksi membuat/mengubah token.

Scope tetap **belum terverifikasi** sampai bukti yang cocok tersedia; HEAD 200
tidak membuktikan token hanya mengakses satu bucket. Ikuti kontrak
[permission/resource R2](https://developers.cloudflare.com/r2/api/tokens/).

Konfirmasi operator dicatat `2026-10-13T15:03:37Z`: pengguna menjawab
`iya benar` pada pertanyaan apakah token yang Access Key ID-nya disimpan di
Keychain adalah **Object Read & Write hanya `cms-dashboard-storage`**.
Ini bukti **owner-attested** untuk permission/resource dan kecocokan pasangan
credential, bukan pembacaan policy provider otomatis atau screenshot.
Expiry dan filter IP belum diberikan; jangan menyimpulkan Forever/90 hari,
status token saat ini, atau IP egress VPS dari jawaban tersebut. Receipt HEAD
historis tidak diubah dan belum diterbitkan evidence/approval deployment baru.

Usulan custody yang kemudian disetujui: menyimpan hanya empat variabel R2
account/bucket/access/secret ke file privat baru
`/opt/sinegasi-prod/config/r2.env` pada VPS `43.157.242.8`, owner deploy user
`ubuntu`, mode 0600 dalam direktori 0700, tanpa menimpa file existing.
Ini file custody staging, **belum** dikonsumsi Compose dan bukan `backend.env`
runtime lengkap. Pembacaan ulang dua item Keychain, transfer SSH dan penulisan
file tersebut semula menunggu izin eksplisit pengguna. Pengguna kemudian
menjawab `lanjut tahap berikutnya` terhadap permintaan izin transfer dengan
target/batas tersebut; hasil eksekusi dicatat di bawah. Izin ini tidak mencakup
key Supabase/admin Postgres, JWT baru, startup/restart, DNS atau deploy.

### Custody R2 VPS — selesai, belum konfigurasi runtime

Diamati `2026-10-13T15:37:56.858Z`: runner melaporkan
`PRODUCTION_R2_VPS_CUSTODY_CREATED`, exit 0, satu transfer diakui receiver.
Hanya dua item Keychain R2 yang dibaca; credential mengalir melalui stdin SSH
dengan strict host-key checking terhadap known_hosts yang sudah ada, bukan
argument shell, environment aplikasi, file sementara Mac atau output/log.
Metadata terpisah sesudah transfer juga cocok:

| Target VPS | Hasil |
| --- | --- |
| `/opt/sinegasi-prod` | Baru dibuat, owner `ubuntu`, 0700, bukan symlink. |
| `/opt/sinegasi-prod/config` | Baru dibuat, owner `ubuntu`, 0700, bukan symlink. |
| `/opt/sinegasi-prod/config/r2.env` | Baru dibuat, owner `ubuntu`, 0600, 264 byte, regular file, satu hard link, bukan symlink. |

Receiver menggunakan Python 3.12.3 yang sudah terpasang karena VPS tidak
memiliki Node.js host; tidak menginstal software. Existing sudo digunakan
hanya untuk membuat target privat dengan owner akhir `ubuntu`, bukan memberi
permission sudo baru. Parent/owner/mode diperiksa melalui directory descriptor
dan O_NOFOLLOW. Payload dibatasi ke empat variabel R2 untuk account/bucket tetap,
ditulis ke temporary privat, fsync, lalu link atomik tanpa replacement; temporary
yang dibuat sendiri dihapus setelah publish. Tidak menimpa file existing,
chmod/chown direktori existing atau membersihkan file milik pengguna.

`keychainReadsAttempted=2`, `transferAttempts=1`, `transferAcknowledged=true`,
`credentialsTransferred=true`, `vpsCustodyChanged=true`. Ini **perubahan custody
production yang diizinkan**, bukan deployment atau perubahan database/runtime.
Isi `r2.env` tidak dibaca balik: `configurationContentsRead=false`,
`contentReadBack=false`, `fileReadBackIntegrityVerified=false`. Verifikasi ini
memastikan write selesai dan metadata cocok, bukan uji R2 dari VPS atau
checksum readback isi secret. Secret tidak ditulis dalam dokumen ini.

Snapshot ID/running/restart-count/started-at DEV dan Caddy identik sebelum dan
sesudah transfer (`devCaddyUnchanged=true`). Tidak menjalankan container,
restart, query/login production, operasi object R2, perubahan bucket/CORS/DNS,
transfer Supabase/Postgres, pembuatan JWT, commit/push atau deploy.
`backendRuntimeConfigured=false`, `deploymentPerformed=false`,
`readyForPublicLaunch=false`; Compose belum memakai file custody ini.

Validasi runner: typecheck lulus, 10 tes TypeScript dan 12 skenario receiver
dengan filesystem in-memory lulus; suite backend 617 pass / 1 skip / 0 fail
(618 tes), guardrails dan diff whitespace lulus. Tidak memakai real credential
dalam tes offline. Source belum dipromosikan ke main/CI oleh fase ini.
Runner menolak replay ke destination existing; jika koneksi gagal/receipt ambigu,
STOP tanpa retry/reset, dan inspeksi metadata sebelum tindakan pemulihan terpisah.

Kontrak receiver mengikuti [Python descriptor-relative filesystem APIs](https://docs.python.org/3.12/library/os.html)
dan [SSH host-key/forwarding controls](https://man.openbsd.org/ssh_config.5).

### Draft backend VPS — non-secret, belum diprovision

Tujuan berikutnya tetap `/opt/sinegasi-prod/config/backend.env` pada VPS yang
disetujui. Blok ini hanya draft dalam dokumen, **bukan file `.env` aktif**, bukan
perintah shell dan bukan approval transfer. Jangan menyalinnya ke `.env` DEV.

<!-- BEGIN PRODUCTION_BACKEND_DRAFT -->
```text
ENV_FILE_LOADING=disabled
NODE_ENV=production
PUBLIC_DEPLOYMENT=true
HOST=0.0.0.0
PORT=5001
CORS_ORIGINS=https://sinegasi.pictures
ALLOW_DEV_AUTH=false
BACKGROUND_JOBS_ENABLED=false
NTFY_ENABLED=false
TRUST_PROXY=__APPROVED_PROXY_HOPS__
SUPABASE_URL=https://pvbdiftvzoeelibxlxzb.supabase.co
SUPABASE_SERVICE_ROLE_KEY=__PRIVATE_BACKEND_KEY__
JWT_SECRET=__PRIVATE_RANDOM_JWT_SECRET__
CLOUDFLARE_R2_ACCOUNT_ID=be04d420dc59ae25397156881c1c68ab
CLOUDFLARE_R2_BUCKET_NAME=cms-dashboard-storage
CLOUDFLARE_R2_ACCESS_KEY_ID=__PRIVATE_R2_ACCESS_KEY_ID__
CLOUDFLARE_R2_SECRET_ACCESS_KEY=__PRIVATE_R2_SECRET_ACCESS_KEY__
CLOUDFLARE_R2_PUBLIC_DOMAIN=
R2_PUBLIC_DOMAIN=
PRODUCTION_MEDIA_PUBLIC_DOMAIN=
```
<!-- END PRODUCTION_BACKEND_DRAFT -->

`HOST=0.0.0.0`/`PORT=5001` adalah listener **di dalam container**. Compose
production memetakan hanya `127.0.0.1:3002:5001`; jangan membuka `3002`/`5001`
ke internet atau menambahkan routing/label Caddy DEV. Jumlah `TRUST_PROXY`
harus ditentukan dari jalur proxy aktual dan dibatasi 0–4, bukan ditebak dari
nama domain atau jumlah layanan. Placeholder sengaja tidak valid untuk deploy.

Validasi lokal draft: **15/15 lulus**, menggunakan blok dokumen ini, environment
bersih, credential sintetis, constructor `src/config/env.ts` sebenarnya dan
`ops/production-runtime-preflight.cjs` melalui adapter `require` terisolasi.
Kasus negatif mencakup placeholder/mismatch/proxy tak terbatas, CORS salah dan
wildcard, worker/notifikasi aktif, project/bucket salah, kunci R2 kosong, JWT
lemah dan ketiga alias media publik. Ini bukan validasi image/container nyata,
topologi proxy aktual, secret sebenarnya, koneksi DB/R2 atau VPS.

Sebelum provisioning, tinjau target/SSH host key dan metadata owner/mode/symlink
tanpa membaca isi konfigurasi lama. Direktori privat dimiliki deploy user
`ubuntu`, mode 0700; file baru mode 0600, tanpa symlink dan tanpa overwrite file
existing. Transfer hanya lewat kanal SSH terverifikasi, tanpa secret di argv,
chat, log, repo atau artefak CI. Izin custody/transfer R2, key backend Supabase,
pembuatan JWT secret dan credential privileged `schema-gate.json` harus eksplisit
dan terpisah; izin HEAD sebelumnya tidak mencakup semuanya. Jangan memindahkan
credential admin Postgres ke runtime API atau mengambil credential dari `.env` DEV.

Pada fase draft tidak ada secret atau runtime diprovision. Fase custody R2
terpisah di atas kemudian membuat `r2.env`; `backend.env` lengkap dan
`schema-gate.json` tetap belum dibuat. Supabase/JWT/credential admin memerlukan
izin baru, dan tidak ada container dimulai/restart atau domain dihubungkan.

### Runner backend custody — disiapkan offline, apply belum disetujui

Fase setelah custody R2 menyiapkan `productionBackendCustody.ts` + receiver
`ops/provision-backend-custody-vps.py`, tanpa membaca Keychain atau membuat JWT
production. Plan inert dapat dijalankan dengan `ENV_FILE_LOADING=disabled`
dan environment tanpa `DEBUG`/`NODE_OPTIONS`/TLS bypass. CLI tidak memuat `.env`.

Target tetap **`/opt/sinegasi-prod/config/backend.env`**, file baru 0600 milik
`ubuntu`; direktori existing harus 0700 dan aman. Tidak membuat direktori yang
hilang atau mengubah permission existing. SSH menggunakan known-host lokal,
strict host-key checking, identitas/key/path tetap, tanpa agent/port forwarding
dan tanpa retry. `r2.env` hanya diperiksa metadata regular-file/owner/gid/mode/
nlink/ukuran; isinya tidak dibaca, tidak disalin dari file dan tidak diubah.

Inspeksi read-only VPS berhasil pada fase ini: target `backend.env` belum ada,
parent privat existing memenuhi kontrak, metadata `r2.env` memenuhi kontrak.
`inspectionAttempts=1`, `keychainReadsAttempted=0`, `transferAttempts=0`,
`networkAccessed=true`, `configurationContentsRead=false`,
`credentialsTransferred=false`, `vpsCustodyChanged=false`. Tidak menjalankan
apply, generate JWT, container/service, query DB, login atau operasi object R2.

**Izin baru yang diperlukan sebelum apply:**

- Baca satu item backend Supabase `sinegasi-prod-supabase-service-role-key`,
  account `pvbdiftvzoeelibxlxzb`, dan baca ulang dua item R2
  `sinegasi-prod-r2-access-key-id` / `sinegasi-prod-r2-secret-access-key`,
  account `cms-dashboard-storage`. Nilai tidak dikirim ke chat/log/argv/repo/CI.
- Transfer ketiga nilai sekali melalui stdin SSH terverifikasi ke VPS yang sama.
  Receiver menolak payload selain tiga field tetap, key frontend, field JWT
  dari client, credential dengan injection dan legacy JWT salah role/ref/expiry.
- Generate **JWT secret aplikasi Fastify** baru dari 64 byte CSPRNG di VPS,
  setelah pemeriksaan target lolos dan sebelum publish; simpan hanya di file
  tujuan bersama konfigurasi backend. Tidak membuat/mengganti signing key atau
  API key project Supabase, password akun, key backup atau credential Postgres.
- Publish file baru atomik/no-replace, 0600, fsync dan periksa metadata;
  jangan overwrite destination, retry, regenerate/reset atau hapus file hasil
  jika receipt gagal/hasil ambigu. Recovery membutuhkan inspeksi dan izin baru.

Konfigurasi memiliki production/public flags, project Supabase tepat, CORS
`https://sinegasi.pictures`, R2 account/bucket tetap, semua alias domain media
publik kosong, auth DEV/worker/ntfy mati dan HOST/PORT container tetap.
`TRUST_PROXY=0` adalah default **tidak memercayai forwarded headers**, bukan
persetujuan topologi proxy publik. Compose deployment nantinya wajib mengisi
`PRODUCTION_TRUST_PROXY` sesuai jalur proxy aktual yang ditinjau; gate deployment
tetap terpisah. Jangan membuka port host 3002/5001 ke publik atau mengaktifkan
backend menggunakan draft ini sebelum gate lengkap.

Key Supabase diperiksa format lokal; untuk legacy JWT juga role/project/expiry.
Ini bukan verifikasi signature/authenticity atau binding project key modern
`sb_secret_...` oleh gateway. Tidak ada koneksi Supabase dalam fase custody.
Dokumentasi kini merekomendasikan secret key modern; nama variabel backend
`SUPABASE_SERVICE_ROLE_KEY` tetap kontrak aplikasi dan menerima kedua format,
bukan alasan untuk rotate signing key Supabase. Jangan kirim key ke frontend:
secret/service-role key melewati RLS, sesuai [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys).
Changelog juga diperiksa, termasuk [deprecation CBC TLS ciphers](https://supabase.com/changelog/cbc-tls-ciphers-deprecated);
custody ini tidak melakukan HTTP API request dan tidak mengubah TLS trust.

Tes offline mencakup command/consent flags, env guard, key allowlist/format,
preflight sebelum Keychain, satu transfer, receipt ketat, buffer cleanup,
hasil ambigu tanpa retry, receiver dengan filesystem in-memory, dan draft
dengan credential sintetis melalui constructor runtime + preflight sebenarnya.
Validasi: 10 tes TypeScript dan 11 skenario Python in-memory lulus; suite backend
**627 pass / 1 skip / 0 fail (628 tes)**, typecheck dan guardrails lulus.
Satu skip tetap uji integration PostgreSQL tanpa disposable database, bukan
bukti atomicity DB atau acceptance Supabase/R2 production.
Tidak membaca `.env` atau credential nyata pada tes. Buffer transport dibersihkan;
penghapusan string JavaScript dari memori secara sempurna tidak dijamin.

Pada akhir fase persiapan runner, `backend.env` belum diprovision,
`backendRuntimeConfigured=false`,
`deploymentPerformed=false`, `readyForPublicLaunch=false`. Source fase ini
belum dipromosikan ke main/CI. `schema-gate.json` (credential admin) dan
deployment/domain/frontend tetap perlu scope serta approval tersendiri.
`backend/.env` DEV tidak perlu dan tidak boleh diubah untuk fase ini.

### Attempt backend custody — dihentikan sebelum proses berjalan

Pada kelanjutan fase ini, 10 tes TypeScript + 11 skenario Python in-memory,
typecheck, guardrails dan diff whitespace diperiksa ulang dan lulus. Metadata
VPS tetap menunjukkan direktori privat 0700 milik `ubuntu` dan `r2.env` regular
0600, 264 byte, satu hardlink; snapshot DEV/Caddy menunjukkan keduanya running
dengan restart-count 0. Pemeriksaan ini read-only, bukan baca isi `.env`.

Perintah apply diminta setelah jawaban pengguna “lanjut tahap berikutnya”,
tetapi **auto-review menolak sebelum proses CLI dimulai**: jawaban tersebut
belum diterima sebagai otorisasi eksplisit egress key Supabase privileged +
dua key R2 dan pembuatan JWT/file backend pada VPS. Tidak mengganti metode,
menjalankan workaround atau mencoba ulang. Dialog Keychain belum ditampilkan,
tidak ada key dibaca/ditransfer, JWT production dibuat atau file VPS ditulis;
`backend.env` tetap belum diprovision oleh fase ini. Tidak ada DB/login/
deploy/restart atau perubahan `.env` DEV/signing key project Supabase.

Sesudah penolakan itu, eksekusi memerlukan persetujuan pengguna yang menyebut secara jelas
baca ketiga item Keychain, transfer ke VPS `43.157.242.8`, generate JWT aplikasi
privat dan create-only `/opt/sinegasi-prod/config/backend.env` 0600 milik
`ubuntu`, tanpa overwrite/retry, deploy atau perubahan DB. Tidak meminta nilai
secret di chat; runner tetap menggunakan kanal privat.

### Backend custody VPS — selesai setelah izin eksplisit, belum deploy

Pengguna kemudian menyatakan izin eksplisit membaca key backend Supabase + dua
key R2 dari Keychain, mentransfer ke VPS `43.157.242.8`, generate JWT aplikasi
privat dan membuat file tujuan baru 0600 milik `ubuntu`, tanpa overwrite/retry,
deploy, perubahan DB, `.env` DEV atau signing key Supabase. Auto-review menerima
scope tersebut; runner yang sama dijalankan tanpa workaround. Penolakan sebelumnya
tidak pernah memulai proses atau mengakses key dan bukan transfer yang diulang.

Receipt pada **`2026-10-13T16:42:16.985Z` (23:42 WIB)**:

- Status `PRODUCTION_BACKEND_VPS_CUSTODY_CREATED`.
- Destination `/opt/sinegasi-prod/config/backend.env`, owner/group `ubuntu`,
  mode **0600**, **820 byte**, regular file, nlink **1**, tanpa symlink.
- Parent `/opt/sinegasi-prod` dan `config` existing tetap **0700** milik `ubuntu`.
- `inspectionAttempts=1`, `keychainReadsAttempted=3`, `transferAttempts=1`,
  `transferAcknowledged=true`, `credentialsTransferred=true`,
  `vpsCustodyChanged=true`. Ini perubahan custody yang diizinkan, bukan deployment.
- `appJwtGenerated=true`: 64 byte CSPRNG dibuat privat oleh receiver VPS lalu
  disimpan di file tujuan; tidak pernah dikirim ke output/model atau dipakai
  layanan. Signing key/API key project Supabase, password akun dan key backup
  tidak dibuat/dirotasi. Credential Postgres/schema-gate tidak ditransfer.
- Receiver publish atomik/no-replace dan fsync; temporary privat buatan receiver
  dibersihkan setelah publish. Tidak overwrite/hapus file existing atau retry.

Inspeksi metadata independen setelah write cocok dengan receipt. Metadata inode,
owner/group, mode, ukuran dan nlink `r2.env` identik sebelum/sesudah, demikian
pula snapshot ID/running/restart-count/started-at DEV dan Caddy:
`r2MetadataUnchanged=true`, `devCaddyUnchanged=true`.
Isi `backend.env`/`r2.env` **tidak dibaca balik**:
`configurationContentsRead=false`, `fileReadBackIntegrityVerified=false`.
Ini verifikasi acknowledgement write + metadata, bukan checksum/readback isi,
validasi secret gateway atau tes koneksi Supabase/R2 dari VPS.

Konfigurasi tetap memakai default `TRUST_PROXY=0` (tidak memercayai forwarded
headers), bukan persetujuan topologi proxy publik. Alias media publik kosong,
auth DEV/worker/ntfy mati. Tidak menjalankan container/service, restart,
query/login/rotasi password, operasi object R2, perubahan bucket/CORS/DNS/Tunnel,
commit/push/PR atau dispatch workflow. `backendRuntimeConfigured=false`,
`databaseAccessed=false`, `r2ObjectOperationsPerformed=false`,
`deploymentPerformed=false`, `readyForPublicLaunch=false`.

10 tes TypeScript dan 11 skenario Python in-memory diperiksa ulang dan lulus
sebelum eksekusi; typecheck/guardrails sebelumnya lulus, tanpa perubahan source
sesudah validasi. Fingerprint source yang dijalankan (bukan hash secret/file env):

```text
productionBackendCustody.ts: 40709a78c54ec84e5a2ae06e4315b27bc444d52daf695d2a512eb64a9891df2c
productionBackendCustodyCore.ts: 6cf2cfaa86a765166c29626108dfaf18af5175a093fce309798efdabd2030303
provision-backend-custody-vps.py: a8fee46e5e58bfb8b3b6f1a8214bdf73e1f5341fa9f8a461ea4900c2e4b7f693
```

Tidak ada nilai secret dalam dokumen/repo. File custody belum dipakai Compose;
gate/schema-gate/recovery/proxy/CI/domain/build frontend dan approval deployment
tetap terpisah. Tidak perlu mengubah `backend/.env` DEV.

## Sebelum menghubungkan domain

Acceptance masih harus membuktikan anonim tidak dapat membaca, pengguna tanpa
izin tidak dapat membaca attachment orang lain, pengguna berizin melihat gambar,
upload/attach berhasil, dan cleanup sesi/logout sesuai kontrak. Foto berbasis key
lama tetap memerlukan object dan metadata di PROD; public-URL-only lama perlu
import/re-upload terpisah yang disetujui, bukan membuka bucket publik.

Gate tetap menghentikan setup/deploy jika custody/protection/evidence belum valid;
mode solo-owner bukan reviewer independen. Tujuh temuan high dependency tooling
frontend yang telah dicatat tidak diselesaikan oleh konfigurasi ini.

Referensi: [R2 public controls](https://developers.cloudflare.com/r2/buckets/public-buckets/),
[R2 S3 endpoint](https://developers.cloudflare.com/r2/api/s3/api/),
[R2 scoped tokens](https://developers.cloudflare.com/r2/api/tokens/),
[R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/),
[R2 billing](https://developers.cloudflare.com/r2/pricing/).
Standard memiliki free tier; penggunaan storage/operasi di atas kuota dapat
ditagihkan. Tidak ada perubahan billing/paket atau migrasi object dalam fase ini.
