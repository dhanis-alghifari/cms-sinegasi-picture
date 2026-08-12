# 09 — Rollout, Observability, Rollback, dan Definition of Done

## Rollout Strategy

Status implementasi repository saat ini: foundation dan adapter responsive untuk
Dashboard, Students, Cash, Equipment, Borrowing, Attendance, Grades, Users,
Classes, Contests, Notifications, dan Audit sudah tersedia. Shared mobile
reachability contract dan vertical slice Kas sudah diperkuat; perubahan tetap
berstatus siap untuk internal QA. Rollout bertahap, visual review browser, dan
feature flag production belum dianggap selesai hanya karena build lulus.

Perubahan dirilis per vertical slice, bukan menunggu seluruh aplikasi selesai.

```text
Development
→ internal QA
→ feature flag untuk maintainer
→ pilot role/user
→ broader role rollout
→ full rollout
→ observation window
→ legacy cleanup
```

## Feature Flag

Flag diperlukan minimal untuk:

- responsive application shell;
- secure-cookie auth transition;
- adaptive collection per high-risk feature;
- report/export baru;
- permission model transition.

Flag tidak boleh dipakai untuk melewati authorization backend. Flag adalah rollout control, bukan security control.

## Cohort Rollout

Urutan contoh:

1. developer/maintainer;
2. satu Guru dan satu role operasional yang relevan;
3. seluruh role pada satu lingkungan/pilot group;
4. 25% pengguna;
5. 50% pengguna;
6. 100% pengguna;
7. hapus legacy setelah observation window dan acceptance.

Untuk Kas, pilot dimulai dengan bendahara dan fixture/reconciliation yang dapat dibandingkan manual.

## Metrics dan Alert

### Product/UX

- task success rate;
- time/tap to complete key task;
- abandonment form;
- filter usage;
- manual refresh frequency;
- error/retry frequency per viewport;
- mobile vs desktop completion.

### Technical

- client error/lazy chunk failure;
- Web Vitals per route/device;
- API p95/error rate;
- auth failures/redirect loop signals;
- DB/RPC latency;
- duplicate idempotency result;
- report/export failures;
- reconciliation variance;
- forbidden/IDOR attempts.

### Alert examples

- mutation error rate naik di atas baseline threshold;
- login success turun signifikan;
- reconciliation variance bukan nol;
- duplicate financial transaction terdeteksi;
- borrowing double-booking invariant gagal;
- p95 endpoint utama melewati SLO;
- client crash hanya pada mobile/WebKit.

Threshold numerik ditetapkan setelah baseline Fase 0.

## Rollback Triggers

Rollback atau flag-off segera jika:

- saldo/piutang tidak konsisten;
- duplicate transaction/borrowing terjadi;
- role mendapatkan data/action terlarang;
- login/password flow loop atau memblokir pengguna valid;
- private data ter-cache publik;
- critical journey gagal pada browser yang didukung;
- crash/error rate melebihi threshold;
- migration menyebabkan lock/latency tidak aman.

Cosmetic spacing defect tidak selalu memerlukan full rollback; gunakan severity triage.

## Rollback Plan

### Frontend

- matikan feature flag;
- kembali ke adapter lama tanpa mengubah data contract;
- deploy asset version sebelumnya;
- pastikan service worker tidak menahan bundle lama.

### Backend/API

- pertahankan contract lama selama compatibility window;
- rollback route module/plugin melalui deployment sebelumnya;
- jangan menghapus response field lama sampai observation selesai.

### Authentication

- selama expand phase, bearer fallback tersedia hanya sesuai window;
- cookie dan bearer revocation policy terdokumentasi;
- rollback tidak boleh membuka origin/CSRF boundary.

### Database

- additive migration lebih mudah di-roll back secara aplikasi;
- destructive contract phase hanya dilakukan setelah semua consumer pindah;
- backup/restore procedure tersedia untuk high-risk migration;
- data reconciliation dijalankan setelah rollback.

## Runbook Insiden

1. Catat waktu, environment, release, route, role, viewport, request ID.
2. Tentukan apakah data integrity/security terdampak.
3. Jika ya, hentikan mutation terkait melalui flag/route guard.
4. Simpan evidence log dan affected record IDs secara aman.
5. Jalankan reconciliation/verification query read-only.
6. Rollback aplikasi atau migration sesuai decision tree.
7. Perbaiki data melalui audited operation, bukan silent SQL edit.
8. Tambah regression test sebelum re-release.
9. Tulis post-incident summary dan update guardrail.

## Definition of Ready per Slice

- [ ] user outcome dan non-goal jelas;
- [ ] current flow direkam;
- [ ] role/capability disetujui;
- [ ] API contract dan data ownership jelas;
- [ ] responsive adapter dipilih dengan alasan;
- [ ] edge/negative cases tercatat;
- [ ] baseline performance/query tersedia;
- [ ] rollback/feature flag tersedia;
- [ ] test plan disetujui;
- [ ] tidak ada dependency yang belum diputuskan.

## Definition of Done per Feature

### Product/UX

- [ ] primary journey selesai pada mobile/tablet/desktop;
- [ ] maksimal tiga perpindahan untuk tujuan role utama;
- [ ] loading, empty, no-results, error, retry, pending, success tersedia;
- [ ] filter/page/scroll/focus terjaga;
- [ ] wording Indonesia dan masking konsisten;
- [ ] destructive action menjelaskan dampak dan meminta alasan bila domain mewajibkan;
- [ ] user acceptance role aktual lulus.

### Frontend architecture

- [ ] page tipis dan tidak menyimpan business logic;
- [ ] query/mutation/service/schema tetap feature-owned;
- [ ] desktop/mobile memakai domain state yang sama;
- [ ] hanya satu presentation adapter aktif;
- [ ] inventory mencakup collection di page, tab, report, widget, dialog, sheet, dan nested detail;
- [ ] setiap surface memiliki klasifikasi adaptive, matrix exception, print-only, atau key-value detail;
- [ ] tidak ada duplicate server state di Zustand;
- [ ] event listener/object URL/timer cleanup benar;
- [ ] bundle berat di-lazy-load;
- [ ] tidak ada native alert/confirm.

### Responsive/accessibility

- [ ] 320–1440px diperiksa;
- [ ] tidak ada accidental horizontal overflow;
- [ ] tidak ada interactive desktop table pada mobile kecuali matrix exception terdokumentasi;
- [ ] mobile card menampilkan maksimal empat nilai keputusan dan menyediakan detail lengkap;
- [ ] table print/export tidak masuk layout, focus order, atau accessibility tree pada mode layar;
- [ ] touch target minimal 44px;
- [ ] primary/coarse-pointer control utama 48px dan gap target berdekatan aman;
- [ ] ukuran target dibuktikan pada rendered UI, bukan disimpulkan dari ikon;
- [ ] tabs mengikuti decision tree equal-width/controlled strip/menu dan tidak
  membuat scroll vertikal tambahan;
- [ ] search, filter, input, select, dan date control full-width pada mobile;
- [ ] hanya ada satu pemilik scroll vertikal per page atau overlay;
- [ ] keyboard, focus trap/return, screen reader basic flow lulus;
- [ ] safe area, virtual keyboard, orientation, 200% zoom lulus;
- [ ] contrast/status tidak color-only;
- [ ] reduced motion dihormati.

### Backend/security

- [ ] request/response schema dan field allowlist;
- [ ] capability + record scope enforced server-side;
- [ ] IDOR/mass assignment tests lulus;
- [ ] public error aman dan memiliki request ID;
- [ ] CORS/cache/security headers benar;
- [ ] mutation sensitif idempotent, atomic, dan audited;
- [ ] log/audit tidak menyimpan secret;
- [ ] XSS/link/upload/export security diperiksa.

### Data/performance

- [ ] projection/pagination bounded;
- [ ] no N+1;
- [ ] query/payload/request count dibandingkan baseline;
- [ ] index baru memiliki query plan evidence;
- [ ] migration memiliki verification dan rollback;
- [ ] domain reconciliation/invariant lulus;
- [ ] Web Vitals dan endpoint SLO dalam budget atau ADR disetujui.

### QA/release

- [ ] typecheck, lint, tests, build lulus;
- [ ] component/API/E2E coverage sesuai risiko;
- [ ] responsive visual review dilakukan pada rendered UI;
- [ ] browser matrix smoke lulus;
- [ ] feature flag dan rollback diuji;
- [ ] observability dashboard/alert tersedia;
- [ ] docs/runbook/changelog diperbarui;
- [ ] legacy code dihapus hanya setelah observation window.

## Program Completion Criteria

Program responsive web app selesai ketika:

1. seluruh route prioritas memiliki shell dan collection responsif;
2. tidak ada feature, subtab, report, dialog, atau nested detail yang bergantung
   pada tabel desktop biasa untuk tugas mobile utama;
3. auth, permission, CORS, cache, error, dan audit boundary telah dikeraskan;
4. Kas dan Peminjaman memiliki data integrity/concurrency evidence;
5. automated critical journeys tersedia;
6. performance mobile memenuhi budget;
7. rollout penuh stabil selama observation window;
8. legacy adapters dan compatibility code yang tidak dibutuhkan telah dihapus;
9. source-of-truth documentation diperbarui.

## Readiness Gate untuk Program PWA Berikutnya

PWA baru boleh direncanakan setelah program ini selesai dan pertanyaan berikut terjawab:

- Apakah installability benar-benar dibutuhkan pengguna?
- Data apa yang aman dibaca offline?
- Apakah mutation offline diperbolehkan untuk domain kas/peminjaman?
- Bagaimana conflict resolution, retry, idempotency, dan stale authorization?
- Bagaimana service worker versioning dan rollback?
- Bagaimana logout/session revocation membersihkan cache?
- Apakah push notification memiliki consent dan recipient policy?

Jika kebutuhan hanya “tampilan seperti aplikasi mobile”, responsive web app ini sudah memenuhinya tanpa kompleksitas PWA.
