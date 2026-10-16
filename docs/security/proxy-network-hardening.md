# Proxy/network — patch lokal, 14 Oktober 2026

Scope: hardening source backend/Compose dan binding approval; tidak membaca atau
mengubah `.env*`, Keychain, VPS, DB, DNS/Tunnel/Pages, visibilitas repository,
subscription GitHub, atau menjalankan push/deploy. Tidak mengubah kebijakan
login/password/CORS, limit request, atau konfigurasi DEV/Caddy yang sedang aktif.

## Temuan dan threat model

Adapter lama di `createApplication.ts` memakai `hop < count` dan mengabaikan
alamat peer. Uji Fastify 5.12.5 terisolasi memperlihatkan peer tidak tepercaya dapat
mengubah `request.ip`, hostname dan protocol memakai `X-Forwarded-*` ketika adapter
aktif. IP tersebut juga dipakai sebagai bagian key rate-limit login; header bukan
identitas pengguna atau bukti autentikasi. Compose production lama bergabung dengan
`caddy_net` milik DEV/Caddy: loopback host port saja tidak membatasi peer satu bridge.

Patch menutup spoofing dari peer tidak tepercaya dan memisahkan bridge production.
Ini bukan bukti bahwa production pernah dieksploitasi atau bahwa proxy aktif di VPS;
pada inspeksi terakhir 13 Oktober belum ada API PROD/Tunnel, dan custody runtime
disiapkan dengan trust disabled. Inspeksi tersebut bersifat historis.

## Kontrak baru

- `TRUST_PROXY=0` / `false` atau tidak diatur: tidak mempercayai forwarding headers.
  `TRUST_PROXY_ADDRESSES` harus kosong/tidak diatur atau `none`.
- `TRUST_PROXY=1..4`: wajib daftar IP exact `TRUST_PROXY_ADDRESSES` (maksimal 8 IP,
  256 karakter). Function memeriksa **alamat dan hop**; peer tidak dikenal dan chain
  yang melewati batas berhenti, bukan dipercaya hanya karena berada pada posisi
  tertentu. Daftar dinormalisasi/frozen; IPv4-mapped IPv6 dikenali.
- `true`, wildcard, hostname, CIDR/private subnet luas, zone ID, duplikat,
  unspecified IP, daftar kosong/malformed gagal tertutup saat startup. Kebijakan ini
  berlaku juga untuk startup DEV baru; file/runtime DEV existing tidak disentuh.
- Default tetap disabled. Tidak ada IP peer atau jumlah hop production yang ditebak
  atau disetujui oleh patch ini. IP root bridge/Docker gateway bisa berbeda dari
  `127.0.0.1`; ukur TCP peer nyata dan header chain melalui jalur yang disetujui.
- `docker-compose.prod.yml` memakai bridge Compose-managed
  `sinegasi_prod_api_net`, bukan network external `caddy_net`. Port host tetap
  `127.0.0.1:3002:5001`, tanpa Caddy labels atau host networking. Bridge tetap
  outbound-capable untuk Supabase/R2; `internal: true` bukan konfigurasi yang cocok
  untuk dependensi eksternal ini. Tidak ada network/container dibuat sekarang.
- Approval deployment **format 3**, 18 field: tambahan `trust_proxy_addresses`
  berupa IP canonical comma-separated, atau `none` hanya bila `trust_proxy_hops=0`.
  Format 2/hop-only ditolak; format evidence schema/media tetap 2. Checksum baru
  mengikat field ini; tidak ada approval valid baru dibuat. Syntax allowlist dicek
  oleh shell, validitas IP lengkap oleh constructor candidate sebelum cutover.
- Compose override menyuntikkan **kedua** nilai approved, mengalahkan nilai custody
  yang lama. Runtime preflight menolak peer list hilang/berbeda dan disabled trust
  tanpa `none`. Rollback memulihkan daftar peer release sebelumnya, bukan memakai
  daftar candidate. Release lama format 2 tidak boleh otomatis dipakai rollback.

## Jalur yang akan ditinjau, belum diprovision

```text
Browser → Cloudflare → cloudflared pada host VPS
                         → 127.0.0.1:3002 → API di bridge PROD terpisah
```

Ini rancangan, bukan observasi header/peer production. Trust header Cloudflare hanya
boleh datang melalui jalur terkendali; jangan mempercayai `CF-Connecting-IP` dari
client langsung. Ukur/review IPv4/IPv6, XFF tambahan, request langsung, CORS,
TLS, rate-limit identity dan auth/media sebelum routing public. Bridge terpisah
bukan isolasi dari host root atau operator Docker: proses berizin pada host masih
dapat mengakses loopback, dan pemegang Docker socket dapat mengubah network.
Trust exact IP tidak mengautentikasi proses proxy secara kriptografis.

## Repository privat tanpa Pro

Repository **tidak harus public** untuk aplikasi production. GitHub Free membatasi
environment secrets/deployment branch protection pada repository public; fitur
private tersebut memerlukan Pro/Team/Enterprise. Mengubah repo public akan membuka
source dan history untuk dibaca/disalin, bukan sekadar membuka fitur deployment.
Jangan mengubah visibility tanpa review history/data sensitif dan izin eksplisit.

Pengguna menolak upgrade Pro; patch ini tidak mengubah gate GitHub atau menambahkan
fallback ke repository secrets. Workflow yang ada tetap diblokir sampai actual
environment memenuhi kontraknya. Alternatif yang bisa dirancang terpisah adalah
gate operator lokal/VPS dengan exact-main CI, digest, checksum/window approval,
backup/restore/recovery dan audit, tanpa deploy credential pada Actions. Itu bukan
review independen dan tidak ekuivalen dengan branch protection; risiko owner/account
compromise harus dijelaskan/disetujui. Jangan sekadar menghapus environment check
atau mengatur READY true.

## Verifikasi

Tes baru memakai Fastify inject dan environment/credentials synthetic; tidak
membuka listener jaringan atau menghubungi DB/provider. Mencakup peer langsung,
DEV/Caddy sintetis, mapped IPv6, malformed configuration, chain/hop limits,
header spoofing, identity key rate-limit, wiring constructor aplikasi, preflight
binding, approval legacy rejection dan rollback peer list. Tes release memakai
mock Docker/curl/lock, bukan daemon/container production. Hasil Node 24.11.1:

- Backend `quality:check`: 636 test total, 635 pass, 0 fail, 1 skipped (disposable
  PostgreSQL nyata tidak disediakan); typecheck/build dan parity OpenAPI 160 lulus.
- Release/rollback fixture: 20 pass; launch build frontend in-memory: 3 pass.
- Guardrails source, Bash/CJS syntax, Ruby safe YAML parse + exact Compose topology,
  dan `git diff --check` lulus. File/config DEV/Caddy/frontend dan lockfile tidak
  diubah oleh patch ini.
- Run penuh pertama gagal pada dua rehearsal auth offline karena deadline/child
  timeout (633 pass, 2 fail, 1 skipped). Suite tersebut lulus terpisah (17 pass)
  lalu run penuh kedua lulus tanpa mengubah kode auth, timeout atau deadline.
  Penyebab scheduling/wall-clock awal belum dibuktikan; jangan menyebutnya fix auth
  atau replay production. Kelulusan lokal bukan CI Node 22/main atau actual
  Tunnel/Compose integration.

Docker CLI/daemon, ShellCheck dan Semgrep tidak tersedia pada Mac saat patch ini;
YAML/shell parse, source guardrails dan review manual bukan pengganti integration
network nyata atau full SAST. Jangan memasang alat/menjalankan container VPS otomatis.

Referensi: [Fastify trustProxy](https://fastify.dev/docs/latest/Reference/Server/#trustproxy),
[Docker bridge isolation](https://docs.docker.com/engine/network/drivers/bridge/),
[GitHub environment availability](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments),
[repository visibility](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility).
