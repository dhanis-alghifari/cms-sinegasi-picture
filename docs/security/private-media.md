# Media privat — kontrak lokal, belum deploy

Browser mengambil gambar melalui API aplikasi dengan `Authorization: Bearer`.
Backend memverifikasi sesi/capability dan membaca attachment dari repository pada
setiap request; hanya backend memakai endpoint S3 R2
`https://<ACCOUNT_ID>.r2.cloudflarestorage.com`. Browser menerima byte JPEG/PNG/WebP,
bukan signed GET, redirect, object key atau domain bucket publik.

## Referensi dan izin

`access_url` adalah path `/api/private-media/<kind>/<parentId>/<id>` pada base API
frontend. `expires_in_seconds: 0` berarti **bukan bearer URL dengan masa berlaku**,
bukan akses permanen/anonim. Setiap pengambilan baru tetap memerlukan sesi valid.

| Kind | Capability | Pemeriksaan resource tambahan |
| --- | --- | --- |
| `agenda` | `agenda.read` | Agenda tidak diarsipkan; foto attached dan cocok dengan agenda/ID. |
| `contest` | `contests.read` | Entry selesai; bukti attached, provider R2, parent cocok. |
| `return` | `borrowing.manage` | Bukti attached; borrowing cocok; bukan bukti student report. |
| `return-report` | `borrowing.read` | Guru atau reporter sendiri; bukti attached terhubung ke laporan terbaru. |
| `charge` | `equipment.read` atau `borrowing.manage` | Bukti pembayaran attached pada settlement yang diminta. |
| `publication` / `insight` | `social_media.read` | Parent masih ada; bukti attached dengan parent dan ID yang cocok. |

Foto profil siswa/alat menggunakan endpoint `/api/students/:id/photo` dan
`/api/equipment/:id/photo` yang sudah berautentikasi dan ber-capability.
Inline foto/bukti lama tetap dikirim hanya melalui respons API terautentikasi.
Tidak ditambahkan endpoint file umum, parameter URL upstream, cookie auth baru,
atau akses berdasarkan object key pilihan pengguna.

## Batas dan custody browser

- Tidak mengikuti redirect upstream. MIME raster, signature, ukuran metadata dan
  ukuran stream harus cocok; maksimum 5 MiB dan timeout R2 10 detik. Signature
  bukan full image decoding, malware scan atau moderasi.
- Maksimum delapan pembacaan proxy R2 per proses; overload/storage invalid gagal
  dengan respons generik 503. Batas request IP/account existing tetap berlaku.
- Byte dikirim dengan `Cache-Control: private, no-store`, `Vary: Authorization`,
  `nosniff` dan `Referrer-Policy: no-referrer`, tanpa header Location.
- Browser membatasi stream 5 MiB, empat pengambilan paralel dan 256 waiter per tab.
  Tidak retry otomatis. Blob hanya hidup pada view, tidak disimpan ke localStorage
  atau query cache. Unmount/logout/pergantian token membatalkan antrean/request dan
  mencabut object URL; hasil request sesi lama tidak boleh dipublikasikan lagi.
- Token aplikasi masih memakai localStorage existing; patch ini bukan migrasi
  HttpOnly-cookie. Logout backend existing mengakui logout tanpa revokasi server
  JWT. Salinan token valid tetap credential aktif; invalidasi auth_version/expiry
  mengikuti mekanisme auth existing beserta cache-nya.

Signed PUT upload tetap capability tulis staging dengan TTL 300 detik, bukan
capability baca. Byte diverifikasi dan dipromosikan ke key final sebelum attached;
browser tidak diberi signed PUT ke final key. Pemegang URL dapat menulis staging
sampai kedaluwarsa; jangan menyebutnya bebas risiko.

## URL lama dan input baru

URL HTTP(S) tidak lagi diterima sebagai input **gambar privat** baru. Gunakan
upload raster/file valid, bukan paste public URL. Foto remote yang sudah tercatat
gagal tertutup: tidak dirender langsung, tidak difetch arbitrary server-side,
dan tidak dikembalikan melalui fallback `{url}`. Record lama perlu re-upload/import
terpisah yang disetujui; kode ini tidak memindahkan, menghapus atau memprivatkan file
yang sudah publik di layanan lain. URL sumber harga/platform/karya yang memang
metadata eksternal bukan endpoint file privat aplikasi.

JS/CSS/font/logo halaman login tetap aset statis publik. Jangan memasukkan foto/data
privat atau credential ke build tersebut. Pengguna berizin tetap dapat menyimpan,
screenshot atau menyalin byte; login tidak dapat mencegah itu.

## Konfigurasi nanti — jangan ubah DEV sekarang

1. Bucket R2 production **terpisah**, tanpa public custom domain dan dengan `r2.dev`
   disabled. Verifikasi kedua pengaturan provider secara nyata; env kosong bukan
   bukti bucket privat. Token S3 dibatasi bucket production dan disimpan backend saja.
2. Backend production: account/bucket/access key/secret key R2 terpisah melalui
   nama `CLOUDFLARE_R2_*` atau alias `R2_*` yang sudah didukung. Public-domain alias
   harus kosong. Tidak dibutuhkan domain `media.sinegasi.pictures` untuk pembacaan.
3. Pages project **production terpisah**: `VITE_API_URL=https://api.sinegasi.pictures`
   dan `VITE_MEDIA_ACCESS_MODE=authenticated-proxy`. Hapus/kosongkan
   `VITE_R2_PUBLIC_DOMAIN`; jangan masukkan backend/Supabase service key ke `VITE_*`.
   Build produksi eksplisit menolak konfigurasi publik atau secret backend tersebut.
4. DNS/TLS API dan frontend serta CORS production tetap target
   `api.sinegasi.pictures` → `sinegasi.pictures`; setup memerlukan izin terpisah.

**Belum boleh launch:** [gate production](../../ops/production-gate/README.md)
sudah disesuaikan lokal menjadi account/bucket privat dan mode reviewer/solo
eksplisit, tanpa public-domain approval. Build/deploy memakai dua dispatch berbeda
dengan checksum approval baru. Patch belum dipromosikan dan provider belum
dikonfigurasi/diverifikasi; independent recovery dan acceptance nyata masih wajib.
Jangan mengaktifkan bucket publik untuk mempertahankan URL lama.

## Verifikasi lokal

`ENV_FILE_LOADING=disabled npm run quality:check` di backend dan frontend.
Tes memakai Fastify inject, repository fixtures dan transport R2 mock; tidak
membaca `.env`, custody password/Keychain, database nyata atau akun Cloudflare.
Tes mencakup anonymous/expired/forged/first-login denial, capability/ownership,
parent mismatch/pending/archive, legacy URL denial, metadata/stream limits,
concurrency, cancellation/blob revocation, decoder API dan Vite production build.
Masih perlu acceptance browser dan real private-bucket integration setelah izin
setup/promotion terpisah; tes lokal bukan klaim zero bug atau production readiness.

Referensi provider: [R2 presigned bearer URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/),
[pengaturan bucket publik](https://developers.cloudflare.com/r2/buckets/public-buckets/).
