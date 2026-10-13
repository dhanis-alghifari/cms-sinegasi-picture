# Gate deployment rekonsiliasi — tanpa replay SQL

Promosi patch dan kelulusan CI **bukan izin dispatch/deploy**. Manifest bernomor dan
runner migrasi lama tetap diblokir sebagaimana sebelumnya. Izin login/password
atau checksum migrasi/bootstrap lama tidak berlaku untuk deployment.

## Dua tahap approval

1. Setelah exact patch dipromosikan ke `main` dan CI backend/frontend sukses,
   publisher yang ditinjau menyiapkan bukti schema/recovery/rehearsal baru.
   Workflow manual memeriksa actual environment protection, exact current main,
   CI push sukses, dan bukti `reconciled-no-sql` **sebelum publish image**.
2. Setelah digest image dan SHA256 archive diketahui, siapkan approval deployment
   baru yang mengikat keduanya. Job deploy memerlukan approval environment lagi.
   VPS memeriksa konfigurasi candidate image dan metadata DB dalam transaksi
   `REPEATABLE READ READ ONLY`, sebelum mengganti satu container API production.

Kedua job memakai environment `production`; variable environment tersedia pada
job build, bukan diambil dari environment yang belum ada. Required reviewer
terpisah (`prevent_self_review=true`) dan tepat satu branch policy `main`
diverifikasi melalui GET GitHub. Jika API/fitur/proteksi tidak tersedia, STOP;
jangan mengubah visibilitas repository, paket langganan, atau membuang gate.
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
| `config/approvals/<FULL_SHA>.txt` | 0600; tepat 12 field approval deployment di bawah, tanpa field lama. |

`schema-gate.json` membawa kredensial inspeksi privileged (`postgres`) karena
checkpoint privat tidak tersedia untuk service_role. **Ini keputusan custody
baru yang memerlukan izin eksplisit tersendiri** sebelum provisioning; jangan
export/transfer item Keychain admin sebagai langkah otomatis. Session diadapter
diset read-only, target/CA dipin, bounded timeout, mount read-only, tanpa server,
worker atau port; ini bukan credential dengan privilege SQL intrinsik read-only.

12 field text approval: `release_sha`, `api_image`, `schema_evidence_sha256`,
`release_package_sha256`, `project_ref`, `trust_proxy_hops`,
`database_rollback_compatible`, `no_other_writers`, `approved_by`, `window_start`,
`window_end`, `media_public_domain`. Window ISO UTC millisecond, start inklusif/end
eksklusif, maksimal 45 menit; fingerprint/digest harus exact output CI, proxy 0–4
sesuai topologi nyata, media HTTPS production sesuai bucket yang ditinjau.
Tidak ada approval valid/example checksum diterbitkan oleh patch ini.

Rollback hanya image/config sebelumnya yang sudah tercatat dan disiapkan sebelum
cutover; tidak menjalankan ulang inspeksi candidate dengan window lama dan tidak
memulihkan DB. First release gagal hanya menghentikan API prod. DEV/Caddy/shared
lock/loopback tetap dilindungi. Metadata release baru menyimpan empat binding
SHA/image/evidence/archive; format manifest lama ditolak, bukan dimigrasikan diam-diam.

## Konfigurasi pengguna — lakukan setelah izin setup terpisah

| Lokasi | Pengaturan |
| --- | --- |
| GitHub Settings → Environments → `production` | Required reviewer terpisah, main-only, bypass ditinjau, secrets production terpisah; jangan set `PRODUCTION_DEPLOYMENT_READY=true` sekarang. Evidence baru menjadi `PRODUCTION_SCHEMA_EVIDENCE`. |
| VPS `config/backend.env` | Key Supabase backend, JWT kuat, R2 account/bucket/access/secret/public domain production. Compose menetapkan exact project/CORS, worker-off dan proxy approved. |
| Pages **production terpisah**, root `frontend`, output `dist` | Build `npm run build:production`; Production variable `VITE_API_URL=https://api.sinegasi.pictures` dan explicit `VITE_R2_PUBLIC_DOMAIN` yang cocok dengan media backend approved. Jangan gunakan domain media fixture di tes. |
| Project Pages DEV | Tetap `npm run build` dan target DEV; jangan ubah variable DEV/main preview menjadi production. |
| DNS/Tunnel/custom domain | Setup/review terpisah untuk `api.sinegasi.pictures` dan `sinegasi.pictures`; port API tidak dibuka langsung. |

`build:production` memakai mode explicit `production-launch`: gagal jika API hilang,
localhost/DEV/salah, alias URL konflik, atau media hilang/memakai fallback DEV.
Build biasa/DEV tidak berubah. Tidak ada secret boleh menjadi `VITE_*`.
Runtime preflight memerlukan semua field R2 dan domain approved yang sama;
ini **bukan** uji akses bucket, upload/download atau CORS browser.

## Pemeriksaan lokal aman

Gunakan `ENV_FILE_LOADING=disabled` untuk quality backend/frontend; `vite.config.ts`
menetapkan `envDir:false` pada flag ini. Guardrail source tidak membaca `.env*`.
Tes deployment memakai mock Docker/curl/lock dan PG in-memory, bukan koneksi nyata.
CLI `deployment:verify` adalah offline; `inspect` **mengakses DB** dan tidak boleh
dijalankan tanpa readiness/izin baru. Jangan menjalankan fixture sebagai approval.

Hasil lokal 13 Oktober 2026 (Node 24.11.1, bukan CI Node 22 atau VPS):

- Backend quality: 581 pass, 0 fail, 1 skipped (PostgreSQL disposable nyata tidak
  diberikan); typecheck/build dan parity OpenAPI 159 operasi lulus.
- Gate baru: 11 tes lokal lulus, termasuk CLI dengan snapshot aktual 73 tabel
  (674094 byte) dan receipt synthetic, zero PG connects.
- Release fixture: 16 tes lulus; candidate schema gate gagal sebelum cutover,
  exact-digest rollback, first-release failure, approval/custody/lock path checks.
- Frontend quality lulus, 12 tes build/assets termasuk actual Vite launch build
  offline; 0 hard bundle violation, 22 target warning masih ada.
- Source guardrails, shell syntax, YAML parse + 11 blok bash tanpa eksekusi,
  dan `git diff --check` lulus. Belum ada full managed recovery, actual image/PG
  runtime integration atau acceptance browser/media. Scan secret staged dijalankan
  sebelum commit; Semgrep tidak tersedia, sehingga ini bukan full SAST.

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
