# Monitor lokal Sinegasi — operator VPS

## Status penerapan — 19 Oktober 2026, 14.21 WIB

- **Sudah aktif di VPS:** SSH key-only (root/password login dinonaktifkan),
  laporan `sinegasi-monitor report`, dan collector setiap 5 menit.
- **Bukti cron nyata:** state diperbarui otomatis pukul **14.18.01 WIB**;
  jurnal cron juga mencatat perintah collector. Bukan hanya file jadwal aktif.
- **Sudah aktif di Cloudflare:** notifikasi Tunnel produksi dan HTTP DDoS ke
  alamat email admin yang sebelumnya dipakai budget alert. Penerimaan email
  belum diuji. Alert DDoS berlaku tingkat akun, bukan hanya satu hostname.
- **Belum dirilis:** event login/aktivitas/error API baru dan reporter error
  browser. Kodenya lokal, telah diuji; perlu release aplikasi melalui gate
  produksi dan persetujuan pemilik untuk SHA/digest yang tepat. Jangan
  mengartikan “belum ada event” sebagai bukti tidak ada percobaan login.
- Container produksi/DEV tidak diganti atau direstart; cron backup tetap utuh.
  Tidak menambah SaaS, port publik, aturan WAF, atau paket berbayar.
- Kandidat PR berikutnya menambah bucket route tetap dan cursor baca sukses
  terpisah agar kegagalan sementara dapat dicoba ulang (tetap dibatasi satu jam).
  Dua perbaikan collector tambahan ini **belum dipasang ke VPS**; status di atas
  adalah snapshot instalasi awal, bukan klaim seluruh source kandidat sudah live.

Untuk pemula, buka [panduan lokal yang dapat dicetak](Panduan-Monitoring-Sinegasi.html)
di Safari/Chrome pada Mac. Ringkasan penerapan bukan jaminan seluruh sistem aman.

Kode di direktori ini menambahkan satu perintah privat, tanpa port, database,
paket tambahan, API token atau penyedia monitoring baru. Pemasangan memerlukan
Python 3.10+ stdlib, Docker CLI, systemd/journalctl, `timeout`, dan cron yang
sudah ada di Ubuntu 24.04. Tidak ada perubahan SSH/firewall/aplikasi dalam installer.

## Pengoperasian

**Di Terminal Mac**, masuk ke VPS yang host key-nya sudah diverifikasi:

```sh
ssh -o StrictHostKeyChecking=yes ubuntu@43.157.242.8
```

**Sesudah prompt menjadi `ubuntu@VM-11-154-ubuntu`**, jalankan:

```sh
sudo /usr/local/sbin/sinegasi-monitor report
```

Laporan berbahasa Indonesia mencakup layanan, container/restart/OOM, rotasi log,
beban CPU 1 menit (bukan persen CPU), RAM/disk, subset request API non-health,
login/error/aktivitas akun yang tercatat, kejadian SSH dan waktu/metode login SSH
sukses terbaru, serta ringkasan backup. Semua jam ditampilkan WIB, tanpa mengubah
zona waktu VPS. `BELUM TERKONFIRMASI` bukan nol atau sehat.

Periksa collector dan jalankan satu pengumpulan bila diperlukan:

```sh
sudo bash /usr/local/lib/sinegasi-monitor-v1/control-vps.sh status
sudo /usr/local/sbin/sinegasi-monitor collect
sudo /usr/local/sbin/sinegasi-monitor report
```

`collect` hanya membaca sumber log lokal dan memperbarui state monitoring;
tidak mengirim request login, tidak menulis database aplikasi, tidak restart layanan.
Exit bukan nol pada collect berarti sumber belum terkonfirmasi atau batas log
tercapai. Karena laporan bisa berisi peringatan, exit 0 pada `report` berarti
laporan berhasil dibuat, **bukan** semua layanan sehat.

## Penyimpanan dan batas yang wajib dipahami

- State: `/var/lib/sinegasi-monitor`, root:root `0700`; `state.json` dan `lock`
  root `0600`. Laporan hanya untuk operator sudo, bukan endpoint publik.
- Hanya field allowlist yang disimpan: waktu, jenis/kategori error tetap, route bucket statis,
  metode, status HTTP, durasi terbatas, request ID, outcome login, dan UUID akun
  terverifikasi dari event server. Tidak ada nama, IP, username, token, password,
  request body, query string, path parameter, pesan exception atau stack trace.
- UUID akun merupakan data pengenal/pseudonim; lindungi seperti data privat.
  Daftar aktivitas ≤10 menit **bukan** daftar orang yang pasti sedang online.
- Retensi maksimal 14 hari, maksimal 20.000 event. Batas kapasitas dapat membuang
  event lebih cepat. Satu state dibatasi 15 MiB agar state lama + penulisan atomik
  berada di bawah 32 MiB. Tidak ada dump mentah yang diarsipkan.
- Setiap pengumpulan membaca maksimum 5.000 baris Docker/16 MiB, maksimum satu
  jam kebelakang dengan overlap 60 detik; awal instalasi hanya backfill satu jam.
  Gagal baca, rotasi log, jeda >1 jam, dan penggantian container dapat meninggalkan
  celah. Penanda batas/gap muncul pada laporan; **histori tidak lengkap**.
- Dedup memakai UUID event server. Untuk log lama, memakai identitas container,
  timestamp Docker, hash baris dan urutan duplikat pada timestamp yang sama.
  Jika potongan awal sejumlah baris identik telah terotasi/terpangkas, dedup log
  lama tidak bisa menjamin hitungan tepat; seluruh sumber tetap berstatus subset.
- Image aplikasi lama mencatat completion otomatis dan kustom; monitor hanya menghitung log
  kustom yang memiliki field route/method/statusCode/durationMs. Request health
  tidak dihitung sebagai hit pengguna. Satu request bisa memiliki event error dan
  completion; ringkasan error menampilkan jenis event, bukan angka insiden unik.
  Kode aplikasi baru menonaktifkan completion otomatis yang memuat raw URL;
  perubahan ini belum berlaku di image produksi sebelum release disetujui.
- Jurnal SSH maksimum 10.000 baris/8 MiB untuk 24 jam terakhir. Hitungan merupakan
  kejadian log, bukan orang/koneksi unik. Kegagalan baca tidak dilaporkan sebagai nol.
- Histori sebelum instalasi dan error browser tanpa event baru tidak dapat diciptakan
  ulang. Jika browser gagal memuat JavaScript, offline, atau pengiriman ditolak,
  error tersebut mungkin tidak terkirim. Tidak ada jaminan seluruh error terdeteksi.
- Health container adalah liveness, bukan tes Supabase/R2. Monitor pada VPS yang
  sama tidak dapat memberi alert ketika seluruh VPS/jaringan mati. Dashboard dan
  notifikasi Cloudflare tetap diperlukan. Tidak ada alert eksternal dari collector.

## Event server yang didukung

`monitoring.login`, `monitoring.activity`, `monitoring.client_error`,
`monitoring.api_error`. Field `eventId` dan `requestId` menggunakan UUID,
`actorId` hanya berasal dari autentikasi server yang berhasil. Monitor juga
mendukung log completion lama; event keamanan baru baru terlihat setelah versi
aplikasi terkait benar-benar dideploy.

## Jadwal collector

```cron
3-59/5 * * * * root ... sinegasi-monitor collect
```

Berjalan **semua hari** pada menit 03, 08, 13, 18, 23, 28, 33, 38, 43, 48,
53, 58. Interval tetap 5 menit, 288 kali/hari, sekitar 105.120 kali/tahun biasa.
Tidak ada tanggal mustahil, pembatas hari/tanggal OR, step drift atau kasus 29
Februari. Tidak berjalan pada tengah malam persis. Zona waktu server tidak
mengubah selisih 5 menit; jadwal backup yang sudah ada tidak diubah.

## Pemasangan baru — untuk pelaksana deployment

1. Tinjau kode, jalankan tes lokal, simpan checksum sumber yang ditinjau.
2. Transfer hanya `monitor_vps.py`, `control-vps.sh`, `install-vps.sh` ke direktori
   staging privat VPS. Cocokkan checksum lokal dan VPS sebelum `sudo`.
3. Jalankan `sudo bash /lokasi/staging/install-vps.sh` pada host yang benar.
4. Jalankan `collect`, lalu `report`; pastikan waktu collector segar dan tidak
   ada status unknown yang disembunyikan.
5. Sesudah menit terjadwal berikutnya, periksa waktu collector berubah. Aktifnya
   file cron saja tidak membuktikan job sukses dijalankan.

Installer menolak target yang sudah ada, symlink/hardlink sumber, dan parent yang
dapat ditulis group/publik. Kode dipasang atomik ke direktori versi
`/usr/local/lib/sinegasi-monitor-v1`; wrapper root dan cron dipasang tanpa menimpa
target lain. Cron baru diaktifkan terakhir setelah kode dan state siap. Bila
instalasi berhenti sebagian, **jangan hapus target secara membabi buta**; periksa
checksum/owner setiap artefak. Installer sengaja tidak menimpa histori/konfigurasi.

## Rollback tanpa kehilangan histori

Nonaktifkan hanya cron monitor yang kontennya cocok dengan versi ini:

```sh
sudo bash /usr/local/lib/sinegasi-monitor-v1/control-vps.sh disable
sudo bash /usr/local/lib/sinegasi-monitor-v1/control-vps.sh status
```

Konfigurasi cron dipindah ke `/var/lib/sinegasi-monitor/cron.disabled`, bukan
dihapus; histori dan kode tetap ada. Tidak memengaruhi cron backup, SSH, Docker,
aplikasi maupun Cloudflare. Laporan masih bisa dijalankan; waktu collector akan
menjadi tidak segar. Aktifkan kembali dengan `control-vps.sh enable` setelah
masalah diperiksa. Jika disable dijalankan lagi, arsip hanya boleh diganti ketika
berkas privat dan kontennya identik; arsip yang berbeda tidak ditimpa.

Rollback perubahan backend/frontend mengikuti deployment aplikasi masing-masing;
menonaktifkan collector tidak mengembalikan versi aplikasi. Tidak ada penghapusan
data atau migration rollback dalam modul monitor ini.

### Catatan pemulihan SSH — untuk operator berpengalaman

Konfigurasi tambahan: `/etc/ssh/sshd_config.d/00-sinegasi-hardening.conf`.
Snapshot dan checksum: `/var/lib/sinegasi-ssh-hardening` (root-only).
Rollback: `/usr/local/lib/sinegasi-ssh-hardening-v1/rollback.sh`.
Sesudah koneksi SSH key baru berhasil, marker `confirmed` dipasang dan timer
rollback otomatis dihentikan. Script rollback menolak berjalan selama marker
tersebut ada; bukan perintah pemeriksaan harian. Jika memang perlu rollback,
gunakan Web Console, verifikasi target/checksum, arsipkan marker tanpa menimpa
berkas lain, lalu jalankan script dan periksa koneksi baru. Ini membuka kembali
konfigurasi autentikasi sebelumnya; jangan dilakukan hanya karena ada log bot.

## Tes offline

Verifikasi lokal 19 Oktober 2026: **24 tes backend + 7 frontend + 31 collector
= 62 tes terarah lulus**, typecheck backend/frontend, dan sintaks shell lulus.
Ini bukan pengganti full quality/CI, production build, dan acceptance sesudah
rilis. Test collector juga ditambahkan ke workflow Code Quality; lihat Checks
pada PR untuk status CI commit terbaru, bukan menyimpulkannya dari angka tes lokal.

### Temuan dependency yang perlu tindak lanjut sebelum persetujuan produksi

Audit lockfile pada 19 Oktober 2026: backend 0 temuan; frontend melaporkan 7
entry paket terdampak berlevel high dalam rantai shadcn/ts-morph/braces, berakar
pada [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
Lockfile frontend identik dengan base PR, sehingga bukan dependency baru dari
monitoring. Review source menemukan import CSS shadcn, bukan import JavaScript
CLI di frontend/src; ini **belum membuktikan seluruh jalur build/CLI tidak
terjangkau**. Tidak ada eksploit/pentest produksi dilakukan untuk memeriksanya.
Tidak menandai risiko ini selesai atau sebagai bukti aplikasi telah dibobol.

Remediasi perlu review dependency/toolchain dan regression build terpisah pada
`frontend/package.json` serta lockfile. Jangan menjalankan `npm audit fix --force`
secara buta: advisory saat diperiksa belum mencantumkan patched version braces,
meskipun npm melaporkan alternatif perubahan dependency tersedia. CI hijau
bukan pengganti keputusan keamanan sebelum release.

```sh
python3 -m unittest discover -s ops/monitoring -p 'test_*.py' -v
bash -n ops/monitoring/install-vps.sh
bash -n ops/monitoring/control-vps.sh
```

Tes memakai fixture log dan subprocess lokal yang terbatas; tidak menghubungi
VPS/Supabase/Cloudflare, tidak membaca kredensial, dan tidak memasang cron.
