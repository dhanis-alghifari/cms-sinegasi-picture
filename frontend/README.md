# Frontend Architecture

Frontend aplikasi CMS Sinegasi Picture menggunakan React, TypeScript, Vite,
React Router, TanStack Query, Zustand, React Hook Form, Zod, dan Tailwind CSS.

Dokumen ini menjadi aturan kerja sederhana agar codebase mudah dicari, dibaca,
dan dirawat. Refactor struktur dilakukan bertahap supaya setiap langkah dapat
diverifikasi.

## Setup lokal

Ikuti [quick start root](../README.md) untuk demo loopback tanpa credential.
Gunakan Node.js major 22 (minimal 22.12) dan instal dependency backend **serta**
frontend: test frontend memakai loader `tsx` dari dependency backend.

```bash
npm ci --prefix ../backend
npm ci
ENV_FILE_LOADING=disabled CF_PAGES=0 VITE_API_BASE_URL= \
  VITE_API_URL=http://127.0.0.1:5001 npm run dev -- --host 127.0.0.1
```

`VITE_API_URL` adalah origin API; service menambahkan path `/api/...` sendiri.
`VITE_API_BASE_URL` adalah alias legacy; jangan memberi dua nilai berbeda.
Variabel `VITE_*` masuk ke bundle browser, jadi tidak boleh memuat credential
backend, Supabase service role, atau key R2. Nilai build-time tidak berubah hanya
dengan mengedit environment dashboard setelah bundle dibuat.

Build biasa `npm run build` juga dipakai pipeline development. Launch production
menggunakan `npm run build:production` dengan API production yang eksplisit,
`VITE_MEDIA_ACCESS_MODE=authenticated-proxy`, dan tanpa `VITE_R2_PUBLIC_DOMAIN`.
Lihat [gate operasional](../ops/production-gate/README.md); build bukan deployment.
Jangan gunakan alamat deployment development sebagai demo publik.

## Struktur yang dituju

    src/
    +-- main.tsx                 # Entry Vite
    +-- app/                     # Komposisi aplikasi
    |   +-- App.tsx
    |   +-- layouts/
    |   +-- navigation/
    |   +-- providers/
    |   +-- router/
    |   +-- styles/
    +-- features/                # Domain bisnis
    |   +-- <feature>/
    |       +-- api/              # Service HTTP dan integrasi backend
    |       +-- components/       # Komponen khusus feature
    |       +-- hooks/            # Query, mutation, dan hook feature
    |       +-- pages/            # Root halaman
    |       +-- schemas/          # Validasi input feature (jika ada)
    |       +-- types/            # Type domain feature
    |       +-- utils/            # Helper feature (jika ada)
    |       +-- routes.tsx
    +-- shared/                  # Kode reusable tanpa aturan domain
        +-- api/
        +-- auth/
        +-- config/
        +-- hooks/
        +-- types/
        +-- ui/
        |   +-- primitives/       # Komponen UI generik/generated
        +-- utils/

Folder top-level lama sudah dipindahkan ke app atau shared. File main.tsx
tetap berada di src sebagai entry point Vite.

## Aturan penempatan kode

### Komponen global

Letakkan komponen di shared/ui jika komponen tersebut:

- tidak mengenal domain bisnis tertentu;
- digunakan oleh sedikitnya dua feature nyata; dan
- memiliki API yang stabil untuk digunakan ulang.

Primitive seperti Button, Input, Dialog, dan Select berada di
shared/ui/primitives. Pola umum seperti PageHeader, Pagination, EmptyState,
dan StatusBadge berada langsung di shared/ui.

Jangan memindahkan komponen ke shared hanya karena terlihat generik. Promosikan
komponen setelah ada kebutuhan penggunaan ulang yang nyata.

### Komponen lokal

Komponen yang hanya dipakai satu domain berada di
features/<feature>/components. Hook, konstanta, dan helper yang hanya dipakai satu
komponen diletakkan sedekat mungkin dengan komponen tersebut.

Jika sebuah child component tidak bermakna tanpa parent-nya, simpan keduanya di
folder parent. Komponen satu file tidak perlu memiliki folder tambahan; buat
folder hanya ketika beberapa file memang saling terkait.

### Hasil ownership Fase 2

Komponen global yang dipakai lintas domain berada di shared/ui atau
shared/ui/primitives. Komponen yang hanya memiliki arti dalam satu domain tetap
berada di feature tersebut, misalnya:

- users/components/ActorSummaryText
- cash/components/FormattedNumberInput dan ImageUploadField
- equipment/components/MultiImageUploadField
- attendance/components/AttendanceStatusBadge
- borrowing/components/BorrowingStatusBadge

AuditHistoryButton dipisahkan dari tabel audit menjadi file tersendiri karena
dipakai oleh banyak feature, tetapi tetap dikelola di feature audit sebagai
integrasi lintas domain yang eksplisit.

### Arah dependensi

    app -> features -> shared

- app boleh mengompilasi route, provider, layout, dan feature.
- features boleh menggunakan shared dan feature lain jika kebutuhan bisnis
  memang jelas.
- shared tidak boleh mengimpor app, layout, atau feature tertentu.
- API, hook, schema, dan type tidak boleh mengimpor komponen UI.
- Hindari barrel export baru; import langsung membuat dependensi mudah dilacak.

### Boundary response API

Semua payload dari HTTP dianggap sebagai data eksternal dan harus divalidasi
sebelum dipakai oleh feature. Service yang sudah dimigrasikan menggunakan
apiClient.getParsed, postParsed, putParsed, atau patchParsed bersama decoder
Zod atau normalizer eksplisit di layer api.

Decoder bertanggung jawab memvalidasi envelope success, data paginated, union
status, dan field wajib. Jika bentuk response berubah atau tidak valid, client
melempar API_RESPONSE_INVALID daripada membiarkan payload rusak masuk ke UI.
Transformasi nama legacy ke kontrak frontend juga dilakukan di decoder, bukan
di komponen.

Guardrail memeriksa seluruh file `*.service.ts` dalam `src/features`, bukan hanya
auth, contests, dan dashboard. Jalankan:

    npm run check:api-boundaries

Service baru juga harus memakai decoder response yang sesuai; jangan mencampur
generic cast dengan payload yang belum divalidasi. Pemeriksaan source ini tidak
menggantikan test decoder terhadap kontrak backend yang sebenarnya.

### Storytelling code

Nama kode harus menjelaskan cerita use case tanpa perlu menebak konteksnya.
Aturan ini berlaku terutama untuk page dan controller feature:

- State domain memakai nama seperti contestBeingEdited, nextPipelineStatus,
  selectedEvidenceFile, dan awardResultRows.
- Handler memakai nama aksi yang spesifik, misalnya
  handleOpenContestEntries atau handlePipelineUpdateSubmit.
- Boolean memakai awalan is, has, atau can.
- Parameter callback memakai nama bermakna seperti searchTerm, resultRow, atau
  nextStatus, bukan val, item, row, atau data ketika konteksnya dapat dibuat
  lebih jelas.
- Nama field API tetap mengikuti kontrak backend; yang diperjelas adalah
  variabel lokal dan fungsi yang mengorkestrasi alurnya.
- Jangan membuat abstraksi hanya untuk mengganti nama. Pecah fungsi hanya saat
  ada tanggung jawab yang berbeda dan tetap mudah diikuti pemula.

Pemeriksaan awal untuk vertical slice kontes:

    npm run check:storytelling

### SOLID per feature

Workstream D dimulai dari feature `contests` dengan batas tanggung jawab yang
jelas:

- `ContestEntriesDialog` hanya mengorkestrasi query, tampilan mode, dan child component.
- `CreateContestEntryForm` memiliki form karya dan mutation pembuatan karya.
- `ContestPipelineUpdateForm` memiliki alur perubahan status dan upload bukti.
- `ContestEntryList` hanya merender daftar karya.
- `ContestAwardResultFields` hanya merender field hasil penghargaan berulang.
- `utils/contestPipelineRules.ts` hanya berisi aturan dan transformasi domain murni.

Dengan pembagian ini, perubahan markup tidak perlu menyentuh aturan pipeline,
dan perubahan aturan pipeline tidak perlu mengubah daftar karya. Boundary utama
diverifikasi dengan:

    npm run check:feature-boundaries

Guardrail ini sengaja kecil dan spesifik. Ia mencegah dialog orkestrator
memiliki form atau mutation sendiri, serta menjaga utility pipeline tetap bebas
dari React dan komponen UI.

### Compound component yang terukur

Compound component hanya digunakan pada kelompok field hasil penghargaan karena
header, tombol tambah, daftar, dan row-nya memakai context callback yang sama.
Pemakaiannya tetap terbaca dari parent:

    <ContestAwardResultFields {...handlers}>
      <ContestAwardResultFields.Header />
      <ContestAwardResultFields.List />
    </ContestAwardResultFields>

Tidak semua komponen diubah menjadi compound component. Jika bagian-bagiannya
tidak berbagi state atau tidak membutuhkan komposisi, props biasa lebih sederhana.
Kontrak root, context, dan pemakaian compound diperiksa oleh
`npm run check:feature-boundaries`.

### DRY pengetahuan domain

Pada feature contests, nilai domain memiliki satu sumber kebenaran:

- types/contests.types.ts menyimpan daftar nilai dan type union seperti status,
  scope, jenis karya, dan hasil penghargaan.
- utils/contestLabels.ts menyimpan label UI, opsi dropdown, type guard, badge,
  dan formatter tampilan.
- utils/contestPipelineRules.ts hanya menyimpan aturan pipeline murni; ia tidak
  mendefinisikan label atau opsi tampilan.

Komponen dan hook mengonsumsi katalog tersebut. Katalog lokal tidak dibuat ulang
karena dapat membuat UI dan API memiliki daftar nilai yang berbeda. Label yang
memang berbeda karena konteks, seperti label hasil pada form dan badge rekap,
tetap didefinisikan terpisah dengan nama yang menjelaskan konteksnya.

Pemeriksaan DRY vertical slice ini dijalankan dengan:

    node scripts/check-domain-dry.mjs

### Lazy loading yang konsisten

Setiap feature route memuat page dengan React.lazy dan merendernya di dalam
Suspense dengan fallback PageLoader. Dengan begitu bundle awal tidak
memasukkan halaman yang belum dibuka pengguna. Komponen kecil yang selalu
dibutuhkan oleh page tetap eager agar tidak menambah boundary dan request yang
tidak perlu.

Dialog, laporan, dan panel opsional yang berukuran besar boleh memiliki lazy
boundary di dalam feature page. Boundary tersebut harus memakai fallback yang
sesuai konteks; modal yang belum dibuka boleh memakai fallback kosong agar tidak
menggeser layout.

Pemeriksaan seluruh route dijalankan dengan:

    node scripts/check-lazy-loading.mjs

### Aset tetap konsisten setelah deployment Cloudflare Pages

Pada build Cloudflare (`CF_PAGES=1`), `vite.config.ts` menggunakan
`CF_PAGES_URL` sebagai base aset. URL hash deployment tersebut disediakan
otomatis oleh Cloudflare; jangan menggantinya dengan domain project atau alias
branch. Build gagal dengan pesan yang jelas jika URL deployment tidak valid.
Build lokal dan `npm run dev` tetap menggunakan `/`.

Dengan demikian, tab yang sudah terbuka tetap memuat chunk halaman/modal dari
deployment asal ketika domain development berpindah ke deployment terbaru.
Alamat navigasi dan konfigurasi API tidak berubah. `_headers` mengizinkan CORS
hanya untuk aset publik `/assets/*` (JavaScript, CSS, font), bukan endpoint API.

Deployment hash yang masih digunakan harus tetap tersedia; jangan menghapusnya
atau memasang Cloudflare Access pada origin aset tanpa menyesuaikan strategi
pemuatan aset. Jika menggunakan CSP, izinkan origin deployment untuk script,
style, dan font. Lihat [variabel build Cloudflare](https://developers.cloudflare.com/pages/configuration/build-configuration/)
dan [URL deployment atomik](https://developers.cloudflare.com/pages/configuration/preview-deployments/#preview-aliases).

Error pemuatan tetap ditangani oleh route error boundary dan root error boundary
yang eager, dengan pesan Bahasa Indonesia dan tombol muat ulang. Tidak ada
reload otomatis atau pengulangan tanpa batas; pengguna diberi peringatan tentang
data yang belum disimpan. Tidak perlu mengubah puluhan pemanggilan React.lazy.

Validasi dari folder `frontend` (dependency backend diperlukan untuk runner tsx):

    npm run check:deployment-assets
    npm run build
    npm run check:bundle

Setelah patch pertama kali terdeploy, tab yang masih menjalankan bundle lama
harus dimuat ulang sekali untuk menerima strategi ini. Verifikasi di Network:
request JS/CSS mengarah ke `<hash>.<project>.pages.dev`, berstatus 200 dengan
Content-Type yang sesuai. Biarkan tab terbuka saat deploy berikutnya, kemudian
buka halaman dan modal yang belum pernah dimuat; chunk tetap berasal dari hash
deployment tab tersebut.

## Batas ukuran file

Batas ini adalah alat bantu review, bukan target untuk menambah isi file:

- 80-250 baris: ukuran ideal untuk page atau component biasa.
- Di atas 300 baris: mulai cari tanggung jawab yang dapat dipisahkan.
- Di atas 400 baris: muncul sebagai warning lint dan wajib direview.
- Di atas 500 baris: wajib dipecah berdasarkan tanggung jawab.
- File handwritten tidak boleh mencapai 1.000 baris.

File generated atau primitive dari library boleh memiliki pengecualian dengan
alasan yang jelas. Pengecualian tidak berlaku untuk page, modal, atau feature
controller yang kita pelihara sendiri.

### Hasil Fase 4 - Pecah file besar

File handwritten yang sebelumnya terlalu besar sudah dipisahkan berdasarkan tanggung jawab:

- cash/pages/CashPage.tsx menjadi orchestration page, CashPageTabs, CashPageModals, dan utility export/print laporan.
- cash/components/FastCashInModal.tsx menjadi controller dan FastCashInFields.
- students/components/StudentFormDialog.tsx menjadi controller dan StudentFormFields.
- grades/components/BulkGradingModal.tsx menjadi controller dan BulkGradingFields.

Controller tetap memegang state, query, mutation, validasi, dan submit. Komponen
fields hanya memegang markup serta callback yang dibutuhkan. Primitive sidebar
dipertahankan sebagai pengecualian karena merupakan komponen UI bersama/generated,
bukan feature business code.

### Hasil Fase 5 - Cleanup

Audit cleanup menemukan bahwa referensi folder lama (`services`, `queries`,
`mutations`, dan `compositions`) serta artefak debug tidak lagi digunakan, jadi
tidak ada file bisnis yang dihapus secara spekulatif. Cleanup yang diterapkan:

- `ProcessReturnModal` memakai `useWatch` sehingga tidak memicu warning React
  Compiler dari `form.watch()` di render.
- Warning Fast Refresh dinonaktifkan secara terbatas hanya untuk modul route yang
  mengekspor konfigurasi `RouteObject` dan primitive UI generated/shared yang
  memang mengekspor variant atau manager bersama komponennya.
- Batas ukuran file tetap aktif untuk kode feature; primitive shared tetap menjadi
  pengecualian yang terdokumentasi.

Tidak ada perubahan pada kontrak API, state bisnis, atau alur pengguna.

## Pola kerja per feature

1. Mulai dari pages atau route feature untuk memahami use case.
2. Letakkan komponen tampilan di components dan data access di api.
3. Letakkan schema di schemas dan type domain di types milik feature.
4. Promosikan komponen ke shared/ui setelah benar-benar reusable.
5. Jalankan validasi sebelum membuat commit.

Validasi lokal:

    npm run lint
    npm run check:dialogs
    npm run check:form-controls
    npm run build

Kontrak ukuran kontrol:

- Input, SelectTrigger, dan tombol default memakai tinggi 48px pada mobile
  dan 36px pada desktop.
- Ukuran compact hanya boleh dipilih melalui varian primitive: gunakan
  density="compact" pada Input dan size="sm" pada Select/Button, bukan dengan
  menambahkan h-* yang berbeda pada kontrol yang berdampingan.
- Ukuran kontrol pada satu baris harus sama; lebar boleh berbeda jika kebutuhan
  konten memang berbeda, seperti status dan catatan absensi.

## Tahapan migrasi

1. Guardrail dan dokumentasi.
2. Konsolidasi app, features, dan shared.
3. Pemisahan komponen global dan lokal.
4. Normalisasi struktur internal setiap feature. (selesai untuk boundary api/hooks/components)
5. Pemecahan file besar.
6. Cleanup dead code dan penambahan test.

Setiap tahap harus menjaga perilaku aplikasi tetap sama dan diverifikasi sebelum
tahap berikutnya dimulai.
