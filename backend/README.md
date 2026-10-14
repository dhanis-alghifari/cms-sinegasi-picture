# Backend — Fastify API

API TypeScript untuk Sinegasi Picture CMS. `src/server.ts` hanya memulai HTTP dan
lifecycle worker; komposisi berada di `src/app`, perilaku bisnis di `src/modules`.
Supabase SDK digunakan di adapter backend, bukan sebagai login frontend langsung.

## Setup

Gunakan Node.js major 22 (minimal 22.12) dan `npm ci` di folder ini.
Untuk demo tanpa database/credential, ikuti [quick start root](../README.md).
Untuk pengembangan terhubung, gunakan project Supabase dan bucket R2 terpisah
milik sendiri; jangan menyalin konfigurasi deployment milik operator.

Template konfigurasi adalah `.env.example`. Salin manual menjadi `.env` hanya
pada mesin Anda, isi secara privat, dan jangan commit nilai aslinya.
`ENV_FILE_LOADING=disabled` mematikan pembacaan file, **bukan** environment shell.
Setiap variabel berikut diverifikasi terhadap `src/config/env.ts`:

| Variabel | Kegunaan |
| --- | --- |
| `NODE_ENV`, `HOST`, `PORT` | Mode runtime dan alamat listener; demo bind `127.0.0.1` |
| `CORS_ORIGINS` | Origin frontend eksplisit, dipisahkan koma; wildcard ditolak |
| `PUBLIC_DEPLOYMENT` | Kontrol publik; HTTPS/non-loopback CORS juga mengaktifkan persyaratan publik |
| `JWT_SECRET` | Secret aplikasi acak; wajib minimal 32 karakter pada deployment publik |
| `ALLOW_DEV_AUTH` | Fixture login lokal, default off dan tidak diizinkan pada deployment publik |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Project dan credential backend; jangan kirim ke browser |
| `DATABASE_URL` | Koneksi admin untuk tool tertentu; bukan syarat server HTTP dan bukan credential runtime production |
| `TRUST_PROXY`, `TRUST_PROXY_ADDRESSES` | Default tidak percaya forwarding; trust aktif butuh hop terbatas dan daftar IP peer tepat |
| `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Storage privat; alias `CLOUDFLARE_R2_*` juga didukung |
| `R2_PUBLIC_DOMAIN` | Harus kosong untuk mode media privat production |
| `BACKGROUND_JOBS_ENABLED`, `NTFY_ENABLED` | Matikan pada demo/test; aktifkan hanya dengan konfigurasi dan otorisasi yang sesuai |

Tabel ini bukan izin menjalankan migrasi, backup, bootstrap, atau custody.
Jangan mencetak environment, output `docker compose config` berisi secret, atau
exception provider yang dapat mengandung data privat.

## Struktur dan arah dependensi

```text
src/server.ts
  -> app/createApplication.ts
     -> app/dependencies/     Penyusunan adapter dan layanan
     -> app/routes/           Pendaftaran kelompok route
     -> modules/<domain>/     Routes -> service -> repository
```

- Routes memiliki schema HTTP, autentikasi/otorisasi, status, dan envelope response.
- Services memiliki validasi dan orkestrasi use case, bukan markup/transport UI.
- Repositories memiliki query Supabase, RPC atomik, atau adapter memory.
- `shared/` berisi kontrak/helper lintas domain; shared lokal tetap dekat pemiliknya.
- `workers/` menjadwalkan layanan, tidak menduplikasi aturan bisnis.
- `scripts/` berisi CLI administrasi/rehearsal; jangan mengimpornya dari server.
- Test `*.test.ts` dekat modulnya; kontrak adapter diuji dengan dependency injection.

Modul kecil boleh flat; modul cash dikelompokkan per subdomain. Lihat
[konvensi modul](src/modules/README.md) sebelum menambah abstraksi atau memindahkan
kode. Adapter memory hanya untuk development terisolasi; kebutuhan database tidak
boleh diganti sukses palsu.

## Perintah sehari-hari

```bash
npm run dev             # Watch lokal; jangan jalankan dengan credential production
npm run typecheck
ENV_FILE_LOADING=disabled npm test
npm run api:check
npm run build
ENV_FILE_LOADING=disabled npm run quality:check
```

`npm start` menjalankan hasil build, bukan migrasi. `api:check` memvalidasi
[OpenAPI](docs/openapi.yaml) terhadap route dan schema yang ada.
Endpoint liveness lokal adalah `http://127.0.0.1:5001/api/health`; respons 200
hanya membuktikan proses hidup, bukan kesiapan database, storage, atau login.

## Database dan administrasi

`src/migrations/` adalah inventaris SQL runner aplikasi; `../supabase/migrations/`
adalah inventaris Supabase CLI. Jangan menggabungkan, menomori ulang, mengedit
migrasi yang sudah diterapkan, atau menjalankan keduanya sembarangan.
Gunakan database disposable dan review inventaris yang sesuai terlebih dahulu.

Script `db:*`, `r2:production:*`, dan `backend:production:*` bukan quick start.
Ada langkah plan/rehearsal offline serta langkah yang dapat membaca credential,
mengirim request, atau menulis data; **nama perintah saja tidak membuktikan aman**.
Ikuti [runbook operasional](../ops/README.md) dan approval yang terikat checksum.
Deployment production menggunakan gate schema read-only, bukan replay SQL legacy.

## Batas keamanan

CORS tidak menggantikan login/RBAC. Backend tetap memeriksa kemampuan, kepemilikan,
first-login, dan versi sesi. Password rotation memperbarui versi sesi; logout
saat ini menghapus sesi client tetapi **belum merupakan revocation server per token**.
Media privat tidak dikembalikan sebagai URL publik/signed GET. Identitas atau
storage yang tidak bisa diverifikasi harus gagal tertutup; lihat
[autentikasi](../docs/security/authentication.md) dan
[media privat](../docs/security/private-media.md).
