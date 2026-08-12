# 01 — Audit Kondisi Saat Ini

## Ringkasan Eksekutif

Catatan: dokumen ini adalah baseline audit sebelum patch foundation mobile
reachability pada 2026-08-10. Temuan yang sudah ditangani dicatat pada dokumen
spesifikasi dan rollout; temuan yang memerlukan rendered/browser QA tetap aktif.

Codebase sudah memiliki fondasi yang tepat: feature-first, service layer, TanStack Query, React Hook Form, Zod, shared HTTP client, dan role-based navigation. Kendala utama bukan pemilihan teknologi, melainkan ketidakkonsistenan penerapan pada skala halaman, presentasi mobile, security boundary, dan quality automation.

Refactor direkomendasikan secara bertahap. Full rewrite akan meningkatkan risiko regresi pada domain sensitif seperti kas, peminjaman, audit, akun, dan absensi.

## Metode Audit

Audit dilakukan terhadap:

- `frontend/START-HERE.md`;
- Engineering Constitution dan playbook frontend;
- router, provider, layout, shared API client, auth store, feature pages, table, modal, query, mutation, dan service;
- Fastify server, auth middleware, CORS, cache policy, endpoint list, dan migration inventory;
- package scripts dan test inventory;
- pola XSS statis berisiko tinggi;
- ukuran file dan ownership.

Audit ini bukan penetration test dan belum menjalankan browser interaction trace. Interaction audit dilakukan pada fase baseline sebelum implementasi.

## Stack Aktif

| Area | Teknologi |
|---|---|
| Frontend | React 19, TypeScript 6, Vite 8 |
| Styling | Tailwind CSS 4, shadcn/Base UI, Lucide |
| Routing | React Router DOM 7 |
| Server state | TanStack Query 5 |
| Form | React Hook Form dan Zod |
| Client state | Zustand |
| Backend | Fastify dan TypeScript |
| Database | Supabase PostgreSQL |
| Authentication | JWT Bearer token |

## Temuan Berdasarkan Prioritas

### P0 — Security dan correctness

#### Token autentikasi disimpan di `localStorage`

Lokasi:

- `src/shared/api/client.ts`
- `src/features/auth/hooks/useAuthStore.ts`

Risiko:

- token dapat dibaca JavaScript jika terjadi XSS;
- token dipersist dua kali, melalui HTTP client dan Zustand persist;
- logout dan session revocation lebih sulit dikontrol secara server-side.

Target:

- HttpOnly, Secure, SameSite cookie;
- frontend menyimpan user/session state, bukan bearer token;
- mutation cookie-based dilindungi Origin/Referer validation dan CSRF strategy;
- session invalidation tetap menggunakan `auth_version`.

#### CORS terlalu longgar

`origin: true` digunakan bersama `credentials: true`, lalu global error handler memantulkan nilai `Origin`.

Risiko:

- origin tidak dikenal dapat memperoleh respons credential-aware bila konfigurasi browser/deployment berubah;
- error handler mengulang kebijakan CORS secara manual;
- policy dapat berbeda antara respons normal dan error.

Target:

- allowlist origin per environment;
- CORS dikelola satu plugin;
- `Vary: Origin`;
- origin tanpa izin ditolak;
- tidak memantulkan origin secara manual dari error handler.

#### Cache policy memiliki route mismatch

Route aktual menggunakan `/api/borrowing`, tetapi cache hook memeriksa `/api/borrowings`.

Dampak:

- respons peminjaman dapat masuk default public cache policy;
- data pengguna dapat berisiko disajikan dengan freshness yang salah.

Temuan tambahan:

- blok `/api/contests` muncul dua kali; blok kedua tidak dapat dicapai;
- audit/admin belum konsisten memakai `private, no-store`;
- health response masih menyatakan `pwaMode: ready` walaupun PWA akan ditunda.

#### Role hierarchy berpotensi menjadi domain authorization yang terlalu luas

`requireRole(minRole)` menggunakan urutan hierarki global. Pola ini tidak selalu cocok dengan izin domain.

Contoh risiko:

- role yang dianggap “lebih tinggi” secara organisasi bisa mendapatkan akses modul yang tidak menjadi tanggung jawabnya;
- menu frontend dan backend guard dapat menghasilkan matriks izin berbeda;
- service-role Supabase dapat melewati RLS sehingga backend guard menjadi choke point utama.

Target:

- permission/capability matrix eksplisit;
- `requireAnyRole` atau `requirePermission` untuk domain tertentu;
- backend authoritative;
- uji IDOR dan horizontal/vertical privilege escalation.

#### Error handler dapat membocorkan detail internal

Global error handler mengembalikan `error.message` untuk error tidak terklasifikasi.

Target:

- pesan publik terkontrol;
- detail teknis hanya di structured log;
- correlation/request ID dikembalikan kepada pengguna;
- database code, stack, dan internal table tidak diekspos.

### P1 — UX responsif dan accessibility

#### Mobile masih menerima pola tabel desktop

Shared `Table` menggunakan `overflow-x-auto`. Ini mencegah clipping, tetapi tidak menyelesaikan keterbacaan dan ergonomi mobile.

Tabel terdampak:

- siswa;
- pengguna;
- kelas;
- absensi;
- nilai;
- peralatan;
- peminjaman;
- lomba;
- transaksi kas;
- piutang;
- audit trail.

Target:

- desktop semantic table;
- tablet compact table atau dua-column cards;
- mobile card/list dan detail drill-down;
- horizontal scroll hanya untuk data yang memang membutuhkan perbandingan kolom.

#### Adapter mobile belum mencakup collection bersarang

Validasi implementasi menemukan bahwa beberapa page sudah mengganti tabel utama
dengan `MobileList`, tetapi tabel di dalam report/tab masih menggunakan presentasi
desktop. Contoh nyata terdapat pada laporan Kas: daftar siswa menunggak serta
rincian pemasukan/pengeluaran masih merender table multi-kolom pada mobile.

Penyebab proses:

- audit dilakukan per page/component utama, bukan per data surface;
- container report dianggap responsif walaupun collection di dalamnya belum adaptif;
- `overflow-auto` dipakai sebagai fallback keterbacaan;
- checklist belum membedakan table layar, matrix exception, dan print-only table.

Target tambahan:

- inventarisasi seluruh `<Table>` dan collection pada page, tab, report, dialog,
  sheet, serta nested detail;
- mobile menampilkan maksimal empat nilai keputusan per card dan membuka detail
  untuk informasi lanjutan;
- table print/export boleh dipertahankan selama tersembunyi dari layar dan
  accessibility tree;
- feature belum selesai jika masih ada collection biasa yang bergantung pada
  horizontal scroll di mobile.

#### Touch target terlalu kecil

Static scan terbaru menemukan candidate ukuran kecil pada 62 file TSX dengan 282
kemunculan utility ukuran `6–9`. Angka ini adalah inventory, bukan 282 pelanggaran:
sebagian merupakan ikon/dekorasi dan wajib dinilai dari hit-area parent pada
rendered UI. Root cause yang terkonfirmasi:

- shared `Input`, `SelectTrigger`, dan `TabsList` memiliki tinggi default sekitar
  32px;
- common `Pagination` memakai tombol 32px;
- tab Kas/Notifikasi/Nilai memiliki trigger mobile sekitar 40px;
- preset, filter report, export, dan beberapa modal Kas memakai 32–36px;
- ikon 14–16px kadang berada pada parent dengan area interaksi terbatas.

WCAG 2.2 level AA menetapkan compliance floor 24×24 CSS px dengan pengecualian,
tetapi itu tidak cukup sebagai baseline ergonomi aplikasi operasional. Target
proyek:

- seluruh hit-area mobile minimum 44×44 CSS px;
- 48px untuk primary action dan kontrol utama pada coarse pointer;
- jarak minimal 8px antara target berdekatan;
- tidak ada aksi hover-only atau gesture-only.

Ukuran visual ikon tidak harus 44px; parent interaktifnya yang wajib memenuhi
target. Perbaikan dilakukan pada primitive/deep seam terlebih dahulu, kemudian
override feature diaudit. Detail normatif berada pada
[Mobile Reachability dan Control Specification](./10-mobile-reachability-and-control-spec.md).

#### Tabs dan scroll ownership belum konsisten

Temuan source-level:

- tab Kas memakai `overflow-x-auto`, tetapi base Tabs hanya sekitar 32px dan
  trigger feature sekitar 40px;
- beberapa container memakai `overflow-auto`, sehingga browser dapat membuat
  scroll x dan y pada surface yang sama;
- shared `DialogContent` dapat menjadi scroll owner, sementara beberapa modal
  menambahkan child `overflow-y-auto` kedua;
- page, report, tab, dan dialog belum mendokumentasikan siapa pemilik scroll
  vertikalnya.

Dampak:

- gesture atas/bawah dapat tertahan di nested container;
- tab dapat memperlihatkan scrollbar atau clipping yang tidak diperlukan;
- footer/submit mudah hilang di bawah keyboard atau bottom navigation;
- scroll position sulit diprediksi setelah detail/modal ditutup.

Target:

- satu pemilik scroll vertikal per page atau overlay;
- tab 2–3 item memakai equal-width segmented layout tanpa scroll;
- tab strip horizontal, bila diperlukan, hanya `overflow-x` dan selalu
  `overflow-y-hidden`;
- dialog/sheet memiliki header, satu scroll body, dan sticky footer yang jelas.

#### Filter dan field mobile belum memiliki kontrak lebar

Filter transaksi Kas sudah memiliki beberapa control 44px, tetapi scope-nya
berada sebelum seluruh tab sehingga tampak memengaruhi Laporan dan Tunggakan.
`CashReportPanel` masih memiliki preset/export 32px, field 36px, dan select group
`max-w-sm`. Shared `SelectTrigger` juga default `w-fit`, sehingga field dapat
menyusut dan terlihat tidak penuh pada mobile.

Target:

- search full-width dan tombol Filter 48px pada collection mobile;
- filter lanjutan berada dalam bottom sheet dengan satu scroll body;
- filter diletakkan di dalam panel/tab yang dipengaruhinya;
- input/select/date `w-full min-w-0` dan 48px pada mobile;
- `max-w-*` hanya aktif setelah mobile melalui pola `w-full sm:max-w-*`;
- keyboard virtual, safe-area, dan sticky action masuk test matrix.

#### Application shell sudah memiliki foundation mobile, tetapi belum lengkap

`DashboardLayout` saat ini sudah memakai `min-h-dvh`, role-aware bottom
navigation, menu “Lainnya”, top context/back, bottom safe-area, serta main sebagai
scroll owner. Remaining gap:

- fallback `100vh` belum dinyatakan untuk browser lama;
- safe-area top/right/left belum ditangani untuk landscape/notch;
- More sheet perlu memastikan grid body adalah satu-satunya scroll owner overlay;
- sticky feature action belum memiliki shared offset contract terhadap bottom nav;
- rendered UI dan perangkat nyata belum menjadi evidence.

#### Page header sudah stack pada mobile, tetapi densitas masih breakpoint-only

`PageHeader` sudah memakai column layout, wrapping action, full-width mobile, dan
minimum 44px. Namun pada breakpoint `sm:` action menyusut menjadi 32px walaupun
perangkat dapat tetap menggunakan coarse pointer.

Target lanjutan:

- satu primary action terlihat dan secondary action masuk overflow bila ramai;
- compact size hanya aktif pada fine pointer, bukan breakpoint saja;
- frequent primary action dapat menjadi sticky mobile CTA dengan safe offset;
- rendered UI diverifikasi pada 320px, tablet sentuh, keyboard, dan 200% text.

#### Loading state dominan spinner

`PageLoader` menggunakan spinner dengan minimum height 400px. Playbook meminta skeleton untuk halaman besar.

Target:

- route fallback ringan;
- page skeleton sesuai struktur;
- section-level partial failure;
- error dan retry tidak mengganti seluruh halaman jika hanya satu widget gagal.

### P1 — Maintainability

#### Page dan component terlalu besar

| File | Perkiraan baris | Tindakan |
|---|---:|---|
| `CashPage.tsx` | 511 | pecah menjadi composition dan hooks UI |
| `CashReportPanel.tsx` | 446 | pecah per section/report adapter |
| `FastCashInModal.tsx` | 432 | pisahkan form sections dan presentation shell |
| `StudentFormDialog.tsx` | 428 | pisahkan fields, upload, account result |
| `BulkGradingModal.tsx` | 425 | pisahkan selection, grade grid, review |
| `EquipmentFormDialog.tsx` | 323 | pisahkan general fields dan image management |
| `CreateBorrowingModal.tsx` | 294 | pisahkan borrower, date, equipment selection |
| `ClassesPage.tsx` | 288 | buat page tipis dan composition |
| `UsersPage.tsx` | 272 | buat page tipis dan collection composition |
| `GradesPage.tsx` | 271 | pisahkan grade dan assignment workspaces |
| `BorrowingPage.tsx` | 265 | pisahkan filters, collection, actions, dialogs |
| `StudentsPage.tsx` | 248 | jadikan vertical slice pertama |

Engineering Constitution menetapkan lebih dari 200 baris harus dipecah menjadi composition.

#### Filter, pagination, dan modal state berulang di page

Pola berulang:

- search state;
- debounced search;
- filter enum;
- reset filter;
- page reset;
- selected record;
- modal open state;
- mutation-to-dialog mapping.

Target:

- tetap feature-owned;
- buat hook hanya bila tanggung jawabnya jelas;
- jangan membuat generic hook dengan konfigurasi kompleks sebelum dua implementasi membuktikan bentuk yang sama;
- URL search params dipertimbangkan untuk filter yang perlu dipertahankan/shareable.

#### Dokumentasi path tidak konsisten

`START-HERE.md` merujuk `docs/playbooks/`, sedangkan folder aktual adalah `docs/playbook/`.

Target:

- koreksi path;
- tambahkan indeks rencana responsive web app;
- pertahankan Constitution sebagai prioritas tertinggi.

### P1 — Performance

#### Query global selalu stale

Global provider menggunakan:

- `staleTime: 0`;
- `refetchOnWindowFocus: true`.

Dampak:

- perpindahan tab pada ponsel dapat memicu banyak request;
- jaringan mobile menjadi boros;
- request yang sebenarnya stabil tetap diulang.

Target:

- default konservatif;
- stale time per domain;
- notification tetap lebih sering;
- master/options lebih lama;
- invalidation terarah setelah mutation.

#### Opsi besar dimuat sekaligus

Contoh:

- assignment options hingga 1000;
- siswa dan alat hingga 100 untuk borrowing;
- beberapa form memuat daftar seluruh siswa aktif.

Target:

- server-search combobox;
- compact option DTO;
- limit 20–50;
- debounce dan cancellation;
- selected option tetap dapat direkonsiliasi walau tidak berada pada hasil search pertama.

#### Lazy route hampir lengkap, bukan nol

Sebagian besar feature page sudah menggunakan `lazy` dan `Suspense`. `ClassesPage` masih diimpor statis.

Target:

- selaraskan Classes;
- dynamic import untuk PDF, CSV/Excel, chart, dan report berat;
- ukur chunk sebelum dan sesudah;
- jangan menambahkan memoization tanpa profiling.

### P1 — Testing dan release confidence

Kondisi saat ini:

- frontend belum memiliki test script;
- tidak ditemukan unit/component/E2E frontend;
- backend memiliki test password service, tetapi belum mencakup seluruh domain;
- belum ada visual regression responsive;
- belum ada browser matrix otomatis.

Target:

- Vitest + React Testing Library untuk module/UI logic;
- Fastify integration tests untuk contract, auth, RBAC, dan error;
- Playwright untuk critical journeys;
- visual screenshot baseline pada breakpoint utama;
- security negative tests;
- migration verification jika migration baru diperlukan.

## XSS Static Baseline

Tidak ditemukan penggunaan langsung:

- `dangerouslySetInnerHTML`;
- `innerHTML`;
- `outerHTML`;
- `document.write`;
- `insertAdjacentHTML`;
- `eval` atau `new Function` pada source aplikasi.

Temuan yang tetap perlu ditindaklanjuti:

- bearer token berada di `localStorage`;
- URL eksternal, upload preview, dan link video harus divalidasi protokol/domain;
- CSP dan security headers belum menjadi guardrail yang terdokumentasi;
- stored values seperti nama, alasan audit, dan keterangan perlu diuji dengan payload XSS.

## Database Baseline

Responsivitas tidak mengubah model data. Database hanya disentuh bila:

- access pattern baru tidak didukung query saat ini;
- search option terbukti lambat;
- filter/sort utama menghasilkan sequential scan pada volume realistis;
- laporan membutuhkan projection atau aggregate yang terukur mahal.

Sebelum index baru:

1. ambil query aktual;
2. jalankan `EXPLAIN (ANALYZE, BUFFERS)` di staging/data copy;
3. catat baseline;
4. desain index berdasarkan equality/range/order;
5. ukur write overhead;
6. gunakan migration baru dan rollback plan.

## Mobile Feasibility and Risk Index

Target platform adalah browser iOS dan Android, tablet, serta desktop. Bukan native app.

### Kondisi awal

| Dimensi | Nilai | Alasan |
|---|---:|---|
| Platform clarity | 5 | browser lintas iOS/Android sudah jelas |
| Accessibility readiness | 2 | touch target dan responsive audit belum lengkap |
| Interaction complexity | 4 | banyak tabel, modal, role, dan mutation sensitif |
| Performance risk | 4 | page besar, opsi besar, query selalu stale |
| Offline dependence | 1 | online-first, offline tidak diwajibkan |

`MFRI = 5 + 2 - 4 - 4 - 1 = -2`.

Interpretasi: jangan melakukan big-bang implementation. Risiko dikurangi melalui foundation, vertical slice, testing, dan rollout bertahap.

### Target setelah foundation

| Dimensi | Target |
|---|---:|
| Platform clarity | 5 |
| Accessibility readiness | 5 |
| Interaction complexity | 3 |
| Performance risk | 2 |
| Offline dependence | 1 |

`MFRI target = 4`, yaitu moderate dan layak dilanjutkan dengan performance serta UX validation.

## Risiko Program

| Risiko | Probabilitas | Dampak | Mitigasi |
|---|---|---|---|
| refactor UI mengubah business outcome | sedang | tinggi | contract dan E2E sebelum refactor |
| saldo kas atau piutang salah | rendah–sedang | kritis | server authoritative, ledger invariants, reconciliation tests |
| role mendapat akses salah | sedang | kritis | permission matrix dan IDOR tests |
| duplicate mutation | sedang | tinggi | idempotency key dan disable in-flight submit |
| mobile list kehilangan informasi | sedang | tinggi | detail sheet dan parity checklist |
| bundle membesar karena dua layout | sedang | sedang | render satu adapter, measure chunk/render |
| database di-index berlebihan | sedang | sedang | EXPLAIN-first policy |
| long-running branch sulit dirilis | tinggi | tinggi | vertical slice dan feature flag |
| PWA lama mengganggu cache | sedang | tinggi | nonaktifkan service worker secara eksplisit pada fase web app |

## Kesimpulan Audit

Codebase dapat diubah menjadi responsive web app tanpa mengganti stack. Perubahan paling penting adalah memperjelas seam presentasi, mengecilkan ownership page, memperkuat security boundary, menstandarkan API list/search, dan membangun quality gate sebelum memperbanyak pola ke seluruh fitur.
