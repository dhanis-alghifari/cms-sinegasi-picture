# 08 — Strategi QA dan Matriks Pengujian

## Quality Strategy

Build dan lint bukan bukti feature bekerja. Verifikasi dilakukan berlapis:

```text
Static checks
→ Unit/domain tests
→ Component/interaction tests
→ API integration tests
→ Database/RPC/invariant tests
→ Browser E2E
→ Responsive visual/accessibility tests
→ Performance/security tests
→ User acceptance
```

## Tooling Target

Tooling ditambahkan saat fase baseline/foundation dan harus mengikuti package manager proyek.

| Layer | Target tooling |
|---|---|
| static | TypeScript, ESLint, existing formatter |
| unit/component | Vitest + React Testing Library + user-event |
| API | Fastify `inject` + Vitest/Node test |
| database | migration verification + isolated Supabase/staging test data |
| browser E2E | Playwright |
| accessibility | axe automated + keyboard/screen reader manual |
| visual | Playwright screenshots/visual diff |
| performance | Lighthouse/Web Vitals + browser trace + query plan |
| security | API negative tests + dependency/static checks + manual threat cases |

Jangan menambah semua dependency sekaligus tanpa satu test nyata dan CI command untuk masing-masing.

## Test Pyramid per Perubahan

### Business rule

- unit/domain test;
- API integration test;
- satu E2E happy path bila user-critical.

### Responsive presentation

- component interaction test;
- visual screenshot pada breakpoint;
- E2E task completion pada mobile dan desktop.

### Database/RPC

- migration apply/rerun verification bila idempotent;
- constraint/invariant tests;
- concurrent/idempotent request tests;
- query plan before/after jika optimasi.

### Security boundary

- unauthorized, unauthenticated, wrong role, wrong record, mass assignment;
- public error redaction;
- audit/log secret redaction;
- browser session/CSRF/CORS behavior.

## Viewport dan Browser Matrix

### Automated minimum

| Profile | Viewport | Tujuan |
|---|---:|---|
| Small phone | 320×568 | worst-case width |
| Android common | 360×800 | one-hand flow |
| Modern phone | 390×844 | primary mobile baseline |
| Large phone | 412×915 | wide coarse-pointer baseline |
| Tablet portrait | 768×1024 | adapter boundary |
| Laptop | 1024×768 | compact desktop |
| Desktop | 1440×900 | full table/workspace |

### Browser

- Chromium desktop dan Android emulation;
- WebKit/iOS emulation;
- Firefox desktop;
- minimal satu perangkat Android dan satu iPhone nyata sebelum rollout penuh.

### Additional modes

- portrait dan landscape;
- 200% zoom desktop;
- browser text scaling;
- reduced motion;
- dark mode hanya jika aplikasi mendukungnya;
- virtual keyboard open pada form panjang.

## Role Matrix

Setiap critical journey dijalankan dengan role yang diizinkan dan minimal satu role yang dilarang.

| Domain | Positive role contoh | Negative role contoh |
|---|---|---|
| kelola user | Guru | Anggota |
| catat kas | Bendahara | Anggota |
| approval peminjaman | role sesuai PRD | Anggota/pemohon sendiri |
| handover alat | Tim Alat | Bendahara |
| kelola nilai | Guru | Anggota |
| audit read | role berwenang | role tanpa izin |

Matriks final mengikuti capability policy, bukan tabel contoh ini.

## Critical Journey Matrix

| Journey | Mobile | Desktop | API integration | Negative/security |
|---|:---:|:---:|:---:|:---:|
| login dan logout | ✓ | ✓ | ✓ | rate limit/session invalid |
| first-login change password | ✓ | ✓ | ✓ | wrong current/reuse/loop |
| create/edit/status siswa | ✓ | ✓ | ✓ | duplicate/IDOR/inactive |
| attendance single/bulk | ✓ | ✓ | ✓ | future/duplicate/partial |
| grade single/bulk | ✓ | ✓ | ✓ | stale/unauthorized |
| cash paid/unpaid/partial | ✓ | ✓ | ✓ | duplicate/concurrent/invalid method |
| cash report/export | ✓ | ✓ | ✓ | range/permission/formula injection |
| equipment create/edit | ✓ | ✓ | ✓ | file/code/status conflict |
| borrowing lifecycle | ✓ | ✓ | ✓ | transition/double booking/IDOR |
| contest members/film | ✓ | ✓ | ✓ | duplicate relation/scope |
| notification read/navigation | ✓ | ✓ | ✓ | other user/open redirect |
| audit filter/detail | ✓ | ✓ | ✓ | redaction/permission |

### Cash mobile implementation checks

- [ ] Role Bendahara/Guru melihat satu FAB icon-only; role Anggota tidak melihat
  FAB maupun aksi pencatatan.
- [ ] FAB memiliki area sentuh minimal 48px, berada di atas safe area/bottom
  navigation pada 320/390/412px, dan tidak menutupi kartu saldo atau kontrol.
- [ ] Tap FAB membuka bottom sheet; tiga aksi (`Kas masuk`, `Pengeluaran`,
  `Pengaturan iuran`) memiliki target minimal 48px, lalu sheet menutup sebelum
  dialog tujuan dibuka.
- [ ] Filter laporan hanya menampilkan ringkasan + tombol `Filter` di mobile;
  perubahan draft tidak memanggil report query sebelum `Terapkan filter`.
- [ ] Rentang 91 hari tidak dapat diterapkan; Reset mengembalikan 30 hari dan
  semua metode.
- [ ] FastCashInModal memiliki satu pemilik scroll vertikal; header/footer tidak
  ikut bergeser dan submit tidak tertutup safe-area/keyboard.
- [ ] Combobox siswa mencari nama, NIS, dan kelas; debounce 300ms; hasil dibatasi
  20; siswa nonaktif tidak muncul.
- [ ] Query options tanpa auth, role anggota, query term ekstrem, dan error
  backend ditangani sebagai error UI tanpa data bocor.

### Tabs spacing checks

- [ ] Kas, Nilai, dan Notifikasi memakai `gap-2` (8px) antartarget dan padding
  yang tidak membuat trigger saling menempel.
- [ ] Pada 320/360/390/412px label tab memakai versi ringkas, trigger tetap
  minimum 48px, dan tidak ada teks overlap atau clipping.
- [ ] Pada 640–767px label panjang belum aktif; pada 768px ke atas label penuh
  tampil dengan `whitespace-nowrap` dan lebar minimum yang cukup.
- [ ] Pada 768/1024/1440px setiap tab masih dapat dibaca tanpa horizontal scroll;
  pada semua viewport tab list tidak memiliki scroll vertikal.

## Responsive Interaction Checklist

Untuk setiap page:

- [ ] tidak ada overflow horizontal yang tidak disengaja;
- [ ] collection adapter tepat untuk viewport;
- [ ] seluruh tab, report, widget, dialog, sheet, dan nested detail sudah dibuka;
- [ ] tidak ada interactive desktop table terlihat pada mobile kecuali matrix allowlist;
- [ ] horizontal-scroll exception memiliki alasan, affordance, sticky identifier bila relevan, dan detail alternatif;
- [ ] table print/export tetap tersembunyi dari layout, focus order, dan accessibility tree;
- [ ] tidak ada hidden duplicate table/card di DOM;
- [ ] primary action terlihat dan tidak tertutup bottom nav;
- [ ] target sentuh minimum 44px;
- [ ] primary action dan coarse-pointer control utama mencapai 48px;
- [ ] gap target berdekatan minimum 8px atau grouping memiliki hit-area aman;
- [ ] ukuran diukur dari parent interaktif rendered UI, bukan ukuran ikon;
- [ ] filter chips dapat dihapus;
- [ ] search/filter/date/select full-width dan tidak clipping pada 320px;
- [ ] 2–3 tab equal-width; tab strip exception tidak memiliki overflow vertikal;
- [ ] page atau overlay hanya memiliki satu pemilik scroll vertikal;
- [ ] sheet/dialog focus trap dan focus return benar;
- [ ] keyboard virtual tidak menutupi submit;
- [ ] rotate/resize tidak kehilangan form state;
- [ ] back menutup sheet sebelum meninggalkan page;
- [ ] detail close mengembalikan scroll/focus;
- [ ] long text, empty value, dan maximal content tidak pecah;
- [ ] badge memiliki text, bukan warna saja;
- [ ] loading/empty/error/no-results terlihat benar.

## Accessibility Test

### Automated

- axe pada shell dan page utama;
- accessible name untuk icon buttons;
- label/control association;
- obvious color contrast violations;
- invalid ARIA.

### Manual

1. Selesaikan journey hanya keyboard.
2. Periksa focus order dan visible focus.
3. Buka/tutup dialog/sheet dan cek focus return.
4. Gunakan VoiceOver/TalkBack pada navigation, card, status, form error.
5. Zoom 200% dan text resize.
6. Aktifkan reduced motion.
7. Pastikan live feedback mutation diumumkan tanpa mengganggu.

## Security Negative Cases

### Authentication/session

- no cookie/token;
- expired/invalid token;
- disabled user;
- auth version berubah;
- forged role client-side;
- return URL eksternal;
- first-login route refresh/back/deep link;
- concurrent password change;
- brute-force/rate-limit behavior.

### Authorization/IDOR

- ganti path UUID dengan record lain;
- ubah body `created_by`, `updated_by`, role, status, student ID;
- gunakan valid filter untuk melihat scope lain;
- panggil endpoint tersembunyi langsung;
- akses audit/notifikasi user lain;
- export data di luar permission.

### Injection/content

Stored payload contoh diterapkan pada field teks:

```text
<img src=x onerror=alert(1)>
javascript:alert(1)
=HYPERLINK("https://attacker.example")
'; DROP TABLE example; --
```

Expected: dirender sebagai text/ditolak sesuai field, link scheme tidak dijalankan, spreadsheet cell aman, dan SQL tetap parameterized.

### CSRF/CORS

- disallowed Origin normal request;
- preflight disallowed origin/header;
- mutation tanpa valid Origin/CSRF control;
- error response tidak memantulkan origin liar;
- credentials tidak dapat digunakan cross-origin sembarang.

## Domain Edge Cases

### Kas

- lihat matriks lengkap pada [vertical slice Kas](./05-cash-vertical-slice.md);
- reconciliation variance;
- timezone/periode ISO week;
- overpayment policy;
- retry setelah timeout server commit.

### Peminjaman

- dua user memilih alat yang sama;
- alat menjadi unavailable di antara create dan approve;
- double approve/handover/return;
- item conditions kurang/duplikat/alat bukan milik borrowing;
- notification insert gagal;
- old borrowing tanpa items.

### Siswa/User

- NIS/username duplicate;
- account already linked;
- inactive class/student/user;
- delete dengan related records;
- last authorized teacher;
- user mengubah role sendiri.

### Absensi/Nilai

- duplicate siswa/tanggal atau siswa/assignment;
- inactive student;
- empty bulk payload;
- duplicate IDs dalam bulk;
- partial failure policy;
- concurrent edit.

## Database and Migration Verification

Untuk migration baru:

1. apply pada schema baseline;
2. apply pada schema parsial/production-like bila migration mengklaim hardening;
3. rerun jika memang dirancang idempotent;
4. verifikasi columns/types/defaults/nullability/constraints/index/functions/grants;
5. verifikasi data backfill counts;
6. jalankan positive/negative RPC;
7. ukur lock duration pada tabel realistis;
8. jalankan rollback/recovery procedure;
9. `NOTIFY pgrst` dan schema cache verification bila RPC berubah.

Query destructive atau update luas harus memiliki pre-check count, scope yang jelas, dan backup/rollback plan.

## Performance Test

### Frontend

- build chunk report;
- LCP/INP/CLS per route utama;
- React profiler pada list/filter/modal;
- network request count pada load, tab focus, mutation;
- 4G + CPU throttling;
- image loading dan layout shift;
- memory setelah membuka/menutup sheet berulang.

### Backend/API

- p50/p95/p99 latency;
- payload size;
- rate-limit/report concurrency;
- connection/DB/RPC duration;
- duplicate request behavior.

### Database

- `EXPLAIN (ANALYZE, BUFFERS)`;
- realistic cardinality/distribution;
- sequential scan yang disengaja vs bermasalah;
- index usage dan write overhead;
- lock/concurrency untuk ledger dan borrowing.

## Visual QA Protocol

1. Render page pada seluruh viewport.
2. Buka seluruh tab/accordion/report dan state yang memuat collection bersarang.
3. Inventarisasi seluruh table yang terlihat dan cocokkan dengan exception allowlist.
4. Ambil screenshot fresh, bukan hanya compare diff.
5. Periksa hierarchy, spacing, clipping, overlap, safe area, empty/loading/error.
6. Interaksikan filter, sheet, form, keyboard, pagination, card detail, dan row action.
7. Uji data kosong, teks panjang, nominal maksimum, serta jumlah record lebih dari satu page.
8. Ambil screenshot state setelah interaction.
9. Bandingkan field/action parity desktop dengan keterbacaan mobile.
10. Catat defect dengan route, role, viewport, state, expected, actual.
11. Ukur `getBoundingClientRect()` seluruh target interaktif yang terlihat pada
    320/390/412px; gagal jika width atau height di bawah 44px.
12. Pastikan setiap tab strip memiliki `scrollHeight <= clientHeight` dan tidak
    memindahkan scroll page saat digeser horizontal.
13. Buka keyboard virtual pada field pertama dan terakhir; submit/footer tetap
    terlihat atau dapat dicapai tanpa nested vertical scroll.
14. Jalankan satu critical journey dengan ibu jari kanan dan kiri pada perangkat
    nyata; catat action yang memerlukan perubahan genggaman.

### Automated responsive collection guard

Pada viewport 320/390px, E2E harus gagal jika menemukan semantic table interaktif
yang terlihat dan tidak berada dalam allowlist matrix. Pengecualian print-only
harus `hidden`/non-interaktif pada media screen. Guard dijalankan setelah seluruh
tab/report dibuka agar nested table tidak lolos hanya karena default tab berbeda.

Tool pencarian design system `ui-ux-pro-max` tidak dapat dijalankan saat penyusunan dokumen karena script skill eksternal memiliki syntax error. Implementasi tidak boleh bergantung pada output tool tersebut; validasi visual tetap dilakukan dengan aturan proyek dan rendered UI.

## CI Gates Target

Urutan pipeline:

```text
install locked deps
→ typecheck
→ lint
→ unit/component
→ backend/API integration
→ build
→ migration verification (environment terisolasi)
→ Playwright critical journeys
→ accessibility/visual smoke
→ security/dependency checks
```

Full browser/performance suite dapat berjalan nightly atau sebelum release jika waktu CI tinggi, tetapi critical auth/cash/borrowing journeys wajib pada pull request terkait.

## Evidence yang Disimpan

- test result dan coverage yang relevan;
- screenshots/video trace untuk failed E2E;
- request/response contract snapshot tanpa secret;
- query plan before/after;
- Lighthouse/Web Vitals baseline/after;
- reconciliation output;
- migration verification counts;
- accessibility findings;
- known limitations dan accepted risk.
