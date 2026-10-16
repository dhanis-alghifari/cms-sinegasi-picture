# Sinegasi Picture CMS

CMS untuk administrasi komunitas sekolah: siswa dan kelas, absensi, kas,
peminjaman peralatan, penilaian, perlombaan, agenda, publikasi, serta audit.
Frontend menggunakan React dan TypeScript; API menggunakan Fastify dengan
adapter Supabase/PostgreSQL dan penyimpanan gambar privat Cloudflare R2.

Repository public ini adalah source code, **bukan akses ke data atau akun aplikasi**.
Gunakan demo lokal atau infrastruktur milik sendiri. Alamat deployment development,
akun operasional, dan credential tidak disediakan sebagai akses demo.
Source `main` memiliki gate production; itu bukan pernyataan bahwa layanan sudah
live atau seluruh persyaratan peluncuran terpenuhi.

## Mulai dari sini

- [Backend: setup, konfigurasi, dan kontrak API](backend/README.md)
- [Frontend: setup dan aturan arsitektur](frontend/README.md)
- [Operasional: deployment dan gate production](ops/README.md)
- [Tinjauan struktur dan batas verifikasi](docs/security/repository-readiness.md)

## Struktur repository

```text
backend/
  docs/openapi.yaml       Kontrak HTTP
  scripts/               Validasi kontrak saat development/CI
  src/
    app/                 Composition root, hooks, dependency wiring
    config/              Konfigurasi runtime dan trust proxy
    modules/             Domain bisnis: routes, service, repository, tests
    shared/              Kontrak/helper yang benar-benar lintas domain
    services/            Adapter infrastruktur dan layanan lintas domain
    workers/             Penjadwalan pekerjaan background
    migrations/          SQL bernomor beserta inventaris/bukti migrasi
    scripts/             CLI administrasi dan rehearsal terpisah dari server
frontend/
  config/                Gate build dan resolusi origin aset
  scripts/               Pemeriksaan arsitektur/UI/bundle
  tests/                 Test integrasi konfigurasi build dan media privat
  src/
    app/                 Router, provider, layout, styles
    features/            API, hooks, pages, components, schemas/types per domain
    shared/              HTTP client, konfigurasi, primitive UI, helper umum
docs/security/           Kontrak keamanan dan rollout
ops/                     Runbook, preflight, release, dan rehearsal
scripts/                 Guardrail lintas repository
supabase/migrations/     Migrasi yang dikelola Supabase CLI
.github/workflows/       CI serta workflow deployment terpisah
```

Dependency backend dan frontend dikelola **terpisah**; repository ini tidak
memiliki npm workspace/package root. Jangan menjalankan `npm install` di root.
Jangan memindahkan atau menomori ulang migration/runner demi tampilan folder:
path dan checksum merupakan bagian dari kontrak operasional yang sudah diuji.

## Demo lokal tanpa credential

Prasyarat: Git, Node.js **22.12 atau lebih baru pada major 22** (sesuai CI), npm,
dan dua terminal. Jika memakai nvm, jalankan `nvm install` lalu `nvm use` dari root.

```bash
git clone https://github.com/dhanis-alghifari/cms-sinegasi-picture.git
cd cms-sinegasi-picture
npm ci --prefix backend
npm ci --prefix frontend
```

Terminal pertama, dari root (shell POSIX/macOS/Linux):

```bash
cd backend
ENV_FILE_LOADING=disabled NODE_ENV=development HOST=127.0.0.1 PORT=5001 \
  PUBLIC_DEPLOYMENT=false ALLOW_DEV_AUTH=true TRUST_PROXY=0 \
  CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173 \
  SUPABASE_URL= SUPABASE_SERVICE_ROLE_KEY= DATABASE_URL= \
  BACKGROUND_JOBS_ENABLED=false NTFY_ENABLED=false \
  npm run dev
```

Terminal kedua, dari root:

```bash
cd frontend
ENV_FILE_LOADING=disabled CF_PAGES=0 VITE_API_BASE_URL= \
  VITE_API_URL=http://127.0.0.1:5001 npm run dev -- --host 127.0.0.1
```

Buka `http://127.0.0.1:5173`. Untuk fixture lokal saja, login dengan
`guru_pembina` / `guru123`; ini nilai sintetis dalam source, **bukan akun server**.
Mode ini tidak membaca file `.env`, tetapi environment shell tetap diwariskan:
mulai dari terminal tanpa credential infrastruktur. Jangan menyalakan demo auth
pada host publik, menghubungkannya ke database bersama, atau membuka port melalui
tunnel. Pada Windows gunakan WSL, atau atur variabel yang sama melalui PowerShell.

Demo memakai memory adapter pada modul yang mendukungnya. Data hilang saat server
restart; perubahan password, upload, dan operasi yang memerlukan database tidak
disimulasikan sebagai sukses. Untuk mencoba alur lengkap, gunakan project
Supabase/R2 **terpisah milik sendiri** dan ikuti [panduan backend](backend/README.md).

## Verifikasi

Instal dependency kedua aplikasi terlebih dahulu; test frontend memakai loader
TypeScript dari backend. Perintah berikut tidak membaca `.env`:

```bash
node scripts/check-repository-hygiene.mjs
node --test scripts/check-repository-hygiene.test.mjs
node scripts/verify-guardrails.mjs
ENV_FILE_LOADING=disabled npm run quality:check --prefix backend
ENV_FILE_LOADING=disabled CF_PAGES=0 VITE_API_BASE_URL= \
  VITE_API_URL=http://127.0.0.1:5001 npm run quality:check --prefix frontend
```

`quality:check` frontend membuat build lokal dan memeriksa batas bundle; build
bukan deploy. Test database terisolasi tertentu hanya berjalan bila operator
menyediakan database disposable secara eksplisit; skip bukan bukti integrasi
managed production. Jangan menjalankan perintah `db:*`, custody, atau deploy
untuk sekadar mencoba UI.

## Kontribusi dan branch

- Mulai dari `main`; buat branch pendek `feat/<tujuan>`, `fix/<tujuan>`, atau
  `chore/<tujuan>`, lalu ajukan PR dengan scope, hasil test, dan risiko.
- `main` adalah source release yang ditinjau, bukan jalur auto-deploy production.
  PR membutuhkan check `backend-quality` dan `frontend-quality` dari GitHub
  Actions, branch up-to-date, dan percakapan terselesaikan. Admin juga terikat;
  force-push/deletion ditolak. Jumlah approval PR adalah 0 untuk owner tunggal,
  bukan review independen.
- `develop` adalah jalur integrasi development. Push ke sana dapat memicu deploy
  dan migrasi development; jangan menyinkronkan branch tanpa persetujuan operator.
  Merge ke `main` tidak otomatis memperbarui `develop`.
- Approval workflow fork eksternal diperlukan; review perubahan workflow/package
  scripts sebelum mengizinkan CI. Approval bukan jaminan bahwa kode fork aman.
- Jangan commit `.env`, credential, database dump, log, custody, cache CLI, atau
  build output. `.gitignore` tidak menghapus file yang sudah terlacak/history.
- Akses source public tidak memberi izin menguji server milik operator.
  Laporkan masalah keamanan secara privat kepada pemilik repository; jangan
  memasukkan password/token atau data pengguna ke issue, PR, atau screenshot.

## Keamanan dan production

Backend melakukan autentikasi/otorisasi; menyembunyikan menu atau URL bukan
kontrol akses. Credential Supabase/R2/JWT hanya untuk backend, tidak boleh
diletakkan pada variabel `VITE_*`. Media bisnis privat dilayani melalui API
dengan session dan pemeriksaan izin; tidak melalui public bucket atau signed GET.
Asset statis aplikasi (JavaScript, CSS, font) berbeda dari gambar unggahan privat.

Production memerlukan bukti schema/backup/restore, konfigurasi proxy yang sudah
diverifikasi, package/digest yang terikat approval, dan jendela eksekusi baru.
Environment `production` hanya menerima branch `main`, memerlukan approval owner,
dan tidak mengizinkan bypass admin. Readiness tetap `false` sampai persyaratan
operasional selesai; jangan mengubah flag untuk melewati gate.
Lihat [gate production](ops/production-gate/README.md) dan
[media privat](docs/security/private-media.md). Uji lokal/CI dan secret scanning
tidak membuktikan aplikasi bebas seluruh kerentanan atau siap diluncurkan.
