# Gate deployment rekonsiliasi — tanpa replay SQL

Promosi patch dan kelulusan CI **bukan izin dispatch/deploy**. Manifest bernomor dan
runner migrasi lama tetap diblokir sebagaimana sebelumnya. Izin login/password
atau checksum migrasi/bootstrap lama tidak berlaku untuk deployment.

**Kontrak hardening 14 Oktober:** [proxy/network hardening](../../docs/security/proxy-network-hardening.md)
menambahkan trust exact peer + hop dan bridge production terpisah dari DEV/Caddy.
Approval deployment sekarang format 3 (18 field, tambahan `trust_proxy_addresses`);
evidence schema/media tetap format 2. Approval format 2/hop-only ditolak. Promosi
patch memerlukan CI exact; tidak menerbitkan izin deploy. Pengguna tidak memilih
upgrade Pro dan berencana membuka repo setelah audit/promosi; visibility tidak
diubah oleh patch. Gate GitHub existing tetap wajib, tanpa fallback. Alternatif
gate privat tanpa Pro perlu desain/izin terpisah.

**Kontrak versi baru:** [media privat](../../docs/security/private-media.md)
memakai authenticated API proxy, bukan public/signed GET media domain. Evidence
format 2 dan approval format 3 mengikat account/bucket R2 privat dan kebijakan
review eksplisit; format/public-domain lama ditolak. Baseline media privat
(sebelum hardening proxy dan approval format 3) dipromosikan melalui
[PR #10](https://github.com/dhanis-alghifari/cms-sinegasi-picture/pull/10) ke main
`6abb0ae5c49f2d673795d01e0d0e146a2d66a1bf`; CI Node 22
[PR](https://github.com/dhanis-alghifari/cms-sinegasi-picture/actions/runs/38385168997)
dan [main](https://github.com/dhanis-alghifari/cms-sinegasi-picture/actions/runs/38385694349)
lulus. Ini tidak menerbitkan izin setup atau launch. Inspeksi provider dan
konfigurasi berikutnya dicatat dalam [panduan kesiapan](../../docs/security/production-configuration-readiness.md).

## Dua tahap approval

Hotfix foto siswa memiliki jalur migrasi additive terpisah yang direview di
[runbook khusus](../../docs/security/student-photo-production-migration.md).
Evidence deployment format 3 menerima hanya satu RPC yang body/ACL-nya terpin
dan receipt-nya cocok; tidak menjalankan SQL pada job deploy atau mengubah
checkpoint historis. Format 2 tetap ketat dan tidak otomatis menerima addition.
Pembuatan PR bukan aktivasi flag migrasi/deploy atau approval operasional.

Delta role backup yang sudah disetujui memakai format 4 sebelum hotfix dan
format 5 sesudah hotfix, dengan policy `sinegasi-backup-readonly-v1` eksplisit.
Policy memeriksa metadata role, grantor dan tepat dua membership sebelum
membandingkan seluruh catalog lain dengan checkpoint lama; tidak membuat role,
menambah hak, menulis checkpoint, atau menerima drift lain. Format 2/3 tidak
otomatis menerima delta ini. Rincian ada pada runbook khusus di atas.

1. Setelah exact patch dipromosikan ke `main` dan CI backend/frontend sukses,
   publisher yang ditinjau menyiapkan bukti schema/recovery/rehearsal baru.
   Workflow manual memeriksa actual environment protection, exact current main,
   CI push sukses, dan bukti `reconciled-no-sql` **sebelum publish image**.
2. Dispatch `phase=build` **hanya** publish image dan archive, tanpa SSH/deploy.
   Setelah digest image, SHA256 archive dan build run ID diketahui, siapkan
   approval deployment baru yang mengikat semuanya. Dispatch `phase=deploy`
   terpisah harus membawa `deployment_approval_sha256` byte exact approval format 3 VPS,
   `build_run_id`, `image_digest`, dan `release_package_sha256`. Tidak ada job
   deploy yang otomatis mengikuti build. Artifact metadata, run/job build sukses,
   repo/path/event/head SHA, exact main dan CI diperiksa ulang sebelum SSH.
   VPS memeriksa konfigurasi candidate image dan metadata DB dalam transaksi
   `REPEATABLE READ READ ONLY`, sebelum mengganti satu container API production.

Kedua fase memakai environment `production` dengan tepat satu branch policy
`main`, verified melalui GET GitHub. Dispatch hanya pelaksana `dhanis-alghifari`
di repository exact ini, main SHA exact dan run attempt pertama; rerun ditolak.
`PRODUCTION_REVIEW_MODE` harus eksplisit dan sama dengan evidence:

- `independent-review`: required reviewer terpisah (`prevent_self_review=true`),
  `soloRiskAccepted=false`; ini tetap default ketat validator environment.
- `solo-owner`: hanya owner tersebut, `soloRiskAccepted=true`, approval text
  `approved_by=dhanis-alghifari`. Ini **bukan** reviewer independen; dua dispatch
  manual/checksum tidak melindungi dari owner/account compromise atau keputusan
  owner yang keliru. Memilih mode/risiko nyata masih perlu izin deployment baru.

Jika environment API/fitur branch policy/secrets tidak tersedia, STOP; mode solo
tidak fallback ke repository secrets atau menghapus environment. Jangan mengubah
visibilitas repository/paket langganan. [Dokumentasi GitHub](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
menguraikan keterbatasan fitur private repository menurut paket; paket akun ini
belum diketahui. Jangan mengarang reviewer kedua.
Pengaturan admin bypass tetap harus ditinjau manual: response API yang tidak
memuat field bypass bukan bukti bypass telah dinonaktifkan.

## Kontrak bukti baru

`DeploymentEvidence` di `backend/src/scripts/productionDeploymentGate.ts` adalah
sumber kontrak. JSON harus minified `JSON.stringify(value)`, tanpa newline,
duplicate keys, field tambahan top-level, atau placeholder. SHA256 mengikat
**byte file**, bukan sebuah tanda tangan; publisher/receipt harus direview.

- Exact project, full release SHA, hash byte snapshot dan paket rekonsiliasi.
- Observasi maksimal 30 menit, checkpoint complete, approval completion,
  managed extension dan schema/security hash yang cocok dengan checkpoint.
- Backup maksimal 2 jam, restore public terverifikasi, checksum archive/metadata
  yang cocok dengan receipt salinan ciphertext VPS. Receipt copy bukan pemeriksaan
  remote live dan bukan bukti kunci pemulihan tersedia.
- Bukti custody kunci recovery **independen dari Mac/VPS aplikasi**. Exception
  Mac-only yang dulu diterima untuk initialization tidak otomatis berlaku untuk
  public deployment; jangan mengklaim key tersedia sebelum benar-benar diverifikasi.
- Rehearsal rollback/runtime pada exact release/paket, tanpa perubahan DB prod/DEV.
- `reviewPolicy`: tepat `mode`, `owner=dhanis-alghifari`, `soloRiskAccepted` sesuai
  mode di atas; tidak mewarisi approval migration/login atau variable READY.
- `media`: tepat `mode=authenticated-proxy`, `verification=owner-attested`,
  `accountId` hexadecimal 32 karakter, `bucket`, `developmentBucket` berbeda,
  `r2DevEnabled=false`, `enabledCustomDomains=0`, `publicWorkerRoutes=false`,
  `credentialsBucketScoped=true`, `verifiedAt`, `verifiedBy=dhanis-alghifari`.
  Receipt harus berdasarkan inspeksi provider/credential aktual, maksimal 30
  menit dan tidak lebih baru dari `observedAt`. Validator **tidak** mengakses
  Cloudflare untuk membuktikan boolean; checksum bukan bukti provider privat.
  Runtime/evidence/approval account dan bucket wajib cocok sebelum cutover.

Inspeksi mengabaikan variasi **jumlah** row bisnis/counter saat membandingkan
schema, tetapi memeriksa reference rows sebenarnya, ACL/RLS, body fungsi,
constraint/index/trigger/view/policy, extension dan private checkpoint. Ini bukan
uji akun/login, isi semua row bisnis, atau penerimaan fitur aplikasi. Auth/Storage
managed harus tetap kosong; bila berisi data, perlu review recovery managed terpisah.
Transaksi diakhiri dengan `ROLLBACK`; tidak ada DDL, history insert atau auth RPC.

Schema dapat berubah sesudah observasi transaksi selesai. Approval harus mengikat
maintenance window tanpa penulis lain; kode tidak menjamin freeze lintas cutover.

## File privat VPS — belum diprovision

Semua direktori `/opt/sinegasi-prod` harus private/owned oleh deploy user, tanpa
symlink. Gate tidak membuat atau menyalin credential.

| Lokasi | Kontrak |
| --- | --- |
| `config/backend.env` | Runtime backend production terpisah; jangan salin `.env` DEV. |
| `config/schema-gate.json` | 0600, JSON tepat `postgresUrl` dan `ca`; URL session pooler production dan CA Supabase pinned/verified. Dibaca hanya one-off inspeksi. |
| `config/approvals/<FULL_SHA>.schema.json` | 0600; byte identik dengan `PRODUCTION_SCHEMA_EVIDENCE` yang ditinjau. Tidak berisi password/token. |
| `config/approvals/<FULL_SHA>.txt` | 0600; tepat 18 field approval format 3 di bawah; byte SHA256 dikonfirmasi saat dispatch. |

`schema-gate.json` membawa kredensial inspeksi privileged (`postgres`) karena
checkpoint privat tidak tersedia untuk service_role. **Ini keputusan custody
baru yang memerlukan izin eksplisit tersendiri** sebelum provisioning; jangan
export/transfer item Keychain admin sebagai langkah otomatis. Session diadapter
diset read-only, target/CA dipin, bounded timeout, mount read-only, tanpa server,
worker atau port; ini bukan credential dengan privilege SQL intrinsik read-only.

18 field text approval: `approval_format=3`, `release_sha`, `api_image`, `schema_evidence_sha256`,
`release_package_sha256`, `project_ref`, `trust_proxy_hops`,
`trust_proxy_addresses`,
`database_rollback_compatible`, `no_other_writers`, `approved_by`, `window_start`,
`window_end`, `review_mode`, `solo_risk_accepted`, `media_access_mode=authenticated-proxy`,
`r2_account_id`, `r2_bucket`. Window ISO UTC millisecond, start inklusif/end
eksklusif, maksimal 45 menit; fingerprint/digest harus exact output CI, proxy 0–4
sesuai topologi nyata. `trust_proxy_addresses` adalah IP canonical exact comma-separated
(bukan CIDR/hostname), atau `none` hanya jika proxy 0. Constructor memvalidasi IP;
preflight mengikat daftar runtime ke approval, termasuk rollback. Account/bucket
sesuai receipt privat yang ditinjau.
`independent-review` memerlukan approver berbeda dari owner dan risiko solo false.
Tidak ada approval valid/example checksum diterbitkan oleh patch ini.

Rollback hanya image/config sebelumnya yang sudah tercatat dan disiapkan sebelum
cutover; tidak menjalankan ulang inspeksi candidate dengan window lama dan tidak
memulihkan DB. First release gagal hanya menghentikan API prod. DEV/Caddy/shared
lock/loopback tetap dilindungi. Metadata release menyimpan lima binding
SHA/image/evidence/archive/approval; checksum approval lama juga wajib sama saat
menyiapkan rollback. Format manifest/public-media lama ditolak, bukan dimigrasikan
diam-diam. Tidak boleh rollback ke image yang membuka media publik; bila ada
release lama nyata, tinjau baseline/kompatibilitas privatnya terpisah sebelum rollout.

## Konfigurasi pengguna — lakukan setelah izin setup terpisah

| Lokasi | Pengaturan |
| --- | --- |
| GitHub Settings → Environments → `production` | Main-only, bypass ditinjau, secrets production terpisah; reviewer sesuai mode, `PRODUCTION_REVIEW_MODE` eksplisit. Jangan set `PRODUCTION_DEPLOYMENT_READY=true` sekarang. Evidence baru menjadi `PRODUCTION_SCHEMA_EVIDENCE`. |
| Cloudflare → R2 → bucket PROD terpisah → Settings | Public Development URL disabled; tidak ada enabled Custom Domains atau Worker publik yang membuka bucket. Token S3 dibatasi bucket PROD; bukan URL media frontend. [Panduan Cloudflare](https://developers.cloudflare.com/r2/buckets/public-buckets/). |
| VPS `config/backend.env` | Key Supabase backend, JWT kuat, R2 account/bucket/access/secret production terpisah; kedua alias public domain harus kosong/tidak diatur. Jangan salin `.env` DEV atau secret ke frontend. |
| Pages **production terpisah**, root `frontend`, output `dist` | Build `npm run build:production`; `VITE_API_URL=https://api.sinegasi.pictures`, `VITE_MEDIA_ACCESS_MODE=authenticated-proxy`, tanpa `VITE_R2_PUBLIC_DOMAIN`. Secret backend tidak boleh masuk build. |
| Project Pages DEV | Tetap `npm run build` dan target DEV; jangan ubah variable DEV/main preview menjadi production. |
| DNS/Tunnel/custom domain | Setup/review terpisah untuk `api.sinegasi.pictures` dan `sinegasi.pictures`; port API tidak dibuka langsung. |

`build:production` memakai mode explicit `production-launch`: gagal jika API hilang,
localhost/DEV/salah, alias URL konflik, mode privat hilang, public media domain
diisi atau secret backend muncul pada variable frontend.
Build biasa/DEV tidak berubah. Tidak ada secret boleh menjadi `VITE_*`.
Runtime preflight menolak public-domain alias (termasuk alias lama) dan memeriksa
account/bucket approved. Mengosongkan env bukan bukti akses publik di provider mati.
Pengaturan provider, upload/download dan CORS browser belum diuji secara nyata.

Gambar attached R2 lama dengan metadata valid tetap dibaca dari object key sama;
foto inline valid tetap bisa tampil sesudah login/otorisasi. URL publik-only lama
diblokir, tidak dihapus, dan perlu import/re-upload privat yang disetujui. DB/bucket
DEV tidak otomatis disalin ke PROD. Inventaris nyata belum dilakukan; jangan
menjanjikan semua gambar lama akan tersedia sebelum inspeksi dan uji browser.

## Pemeriksaan lokal aman

Gunakan `ENV_FILE_LOADING=disabled` untuk quality backend/frontend; `vite.config.ts`
menetapkan `envDir:false` pada flag ini. Guardrail source tidak membaca `.env*`.
Tes deployment memakai mock Docker/curl/lock dan PG in-memory, bukan koneksi nyata.
CLI `deployment:verify` adalah offline; `inspect` **mengakses DB** dan tidak boleh
dijalankan tanpa readiness/izin baru. Jangan menjalankan fixture sebagai approval.

Hasil lokal 13 Oktober 2026 (Node 24.11.1, bukan CI Node 22 atau VPS):

- Backend quality: 597 pass, 0 fail, 1 skipped (PostgreSQL disposable nyata tidak
  diberikan); typecheck/build dan parity OpenAPI 160 operasi lulus.
- Gate: 14 tes lokal lulus, termasuk CLI dengan snapshot aktual 73 tabel
  (674094 byte) dan receipt synthetic, zero PG connects.
- Release fixture: 19 tes lulus; candidate schema gate gagal sebelum cutover,
  exact-digest rollback, first-release failure, approval/custody/lock path checks.
- Frontend quality lulus, 12 tes build/assets termasuk actual Vite launch build
  offline; 0 hard bundle violation, 22 target warning masih ada.
- Source guardrails, shell syntax, YAML parse + 11 blok bash tanpa eksekusi,
  CJS syntax dan `git diff --check` lulus. Actionlint/ShellCheck/Semgrep tidak
  tersedia; YAML/bash parse bukan pengganti pemeriksaan tersebut atau CI nyata.
  Belum ada full managed recovery, actual image/PG
  runtime integration atau acceptance browser/media. Scan secret staged dijalankan
  sebelum commit. Ini bukan full SAST.

## Risiko dependency tooling yang belum diselesaikan

Audit 13 Oktober 2026: backend runtime (`npm audit --omit=dev`) tidak menemukan
vulnerability; frontend `npm audit` melaporkan 7 temuan high pada rantai CLI
`shadcn@4.21.4` → `fast-glob`/`ts-morph` → `micromatch` → `braces@3.0.3`.
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
menjelaskan stack-exhaustion DoS dari pola brace bersarang; advisory belum
mencantumkan patched version. Jangan menjalankan `audit fix --force`: saran npm
mengubah versi mayor CLI dan berada di luar patch gate ini.

Pencarian import pada source/config/scripts/tests frontend dan manifest Vite
tidak menemukan module tooling tersebut. Karena frontend production berupa aset
statis dan quality build tidak menjalankan generator CLI, penilaian **sementara**
adalah risiko tooling tidak reachable dari aplikasi browser; ini bukan bukti
seluruh dependency bebas kerentanan. Jangan menjalankan generator dengan registry
atau pola glob tidak tepercaya. Tinjau perbaikan paling lambat 20 Oktober 2026,
atau sebelum penggunaan generator/perubahan dependency berikutnya; temuan tidak
disembunyikan dan tidak ada dependency/lockfile diubah oleh patch ini.

Promosi patch/CI → keputusan custody/recovery/provisioning → fresh actual evidence
dan approval digest/window → rollout loopback → routing/Pages → acceptance backend
deployed/browser/login/media → keputusan public go-live. Tidak ada jaminan zero bug,
zero downtime single-container, pemulihan seluruh managed schema, atau public launch
yang diterbitkan oleh tes lokal ini.
