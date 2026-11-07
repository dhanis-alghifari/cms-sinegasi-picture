# Rekonsiliasi rilis darurat contest

Status: **belum selesai**. Dokumen ini mencatat observasi dan pekerjaan lanjutan,
bukan izin deploy atau prosedur cutover yang telah diuji.

## Rilis yang diamati

- Pada 7 November 2026, API production berjalan sehat dari tag lokal
  `sinegasi-api:hotfix-contest-8d477ea`, image ID
  `sha256:acc7e592fe633d6aa186f20051dc7d569e625550a3533845bab73e8bb79260c2`,
  dengan label source `8d477ea51c7f63283068ed130c855f736810e8a7`.
- PR #32 sudah di-merge menjadi `c7b50db0f0a4d2d23f01432082bda2bd3188af87`;
  tree-nya cocok dengan source `8d477ea`. Label bukan bukti provenance image.
- Saat diperiksa, `current-release.txt` masih menunjuk release sebelumnya;
  referensi tersebut tidak sama dengan `.Config.Image` container. Guard resmi
  gagal tertutup. Jangan menimpa state, approval, atau bukti untuk memaksanya lolos.
- Migration history production mencatat `student_optional_nis` pada
  `20261106141216` dan `contest_optional_deadline_emergency` pada
  `20261107034531`; nama dan timestamp ini tidak sama dengan file SQL di repo.
  Jangan replay migration atau mengubah history tanpa pembuktian tersendiri.
- Gate data acuan lama mengharapkan hanya Cash; saat pemeriksaan production juga
  memiliki QRIS DANA dan QRIS GoPay aktif. Asal perubahan tersebut belum
  terbukti dari audit yang diperiksa. Gate tetap menolak perbedaan ini; jangan
  hapus atau ubah metode pembayaran untuk memaksa gate lulus.
- Izin GitHub Packages belum tercantum pada status autentikasi saat diperiksa;
  image aktif belum berhasil disimpan sebagai referensi registry permanen.
- Kondisi di atas adalah observasi saat pemeriksaan, bukan jaminan kondisi saat
  rilis berikutnya. Periksa ulang image, service, schema, backup, dan data.

## Pekerjaan sebelum deployment normal berikutnya

1. Verifikasi asal image yang aktif dan simpan sebagai artifact immutable yang
   dapat dipulihkan. Pull digest-nya dalam lingkungan terisolasi dan bandingkan
   config/image ID, arsitektur, serta revisi. Docker image ID dan digest manifest
   registry adalah hal berbeda; label saja tidak membuktikan provenance.
2. Verifikasi schema lengkap, fungsi, trigger, kepemilikan, ACL, dan migration
   history terhadap baseline serta delta yang ditinjau. Jangan samakan hash SQL
   yang berbeda hanya karena hasil tampak serupa. Gate tidak boleh mengabaikan
   drift lain atau mengubah schema saat deploy.
3. Siapkan paket release, konfigurasi runtime, schema evidence dan approval
   format yang benar-benar sesuai. Jangan membuat approval palsu atau memakai
   checksum release lama untuk image baru. Pastikan backup dan pemulihan relevan
   terverifikasi, termasuk batas cakupan Auth dan Storage.
4. Uji rollback backend **dan** frontend terhadap schema baru dan data contest
   bertanggal NULL. Image lama `sinegasi-api:hotfix-8ddeaa1b` tidak terbukti
   kompatibel; jangan otomatis mengembalikannya setelah data NULL dibuat.
   Harness `scripts/rehearse-contest-null-rollback.sh` lulus pada PostgreSQL
   sintetis dan image rollback terisolasi pada 7 November 2026. Skema minimal,
   mapper, dan validasi deadline tercakup; auth, Storage, browser, dan API
   terhubung database tidak diuji. Ini belum membuktikan rollback end-to-end.
5. Rancang dan uji cutover ke digest immutable serta pembaruan state di bawah
   lock deployment yang sama. Perlu journal privat tahan crash, validasi ulang
   identitas dan health, penulisan atomik state, dan uji kegagalan di setiap
   tahap. Docker dan filesystem tidak dapat diganti dalam satu transaksi atomik.
   Prosedur ini belum diimplementasikan atau dibuktikan end-to-end.

## Pemulihan setelah interupsi

Di bawah lock, bandingkan journal yang terverifikasi, hash state, referensi dan
ID container, health, serta identitas DEV/Caddy. Container baru dengan state lama
dapat berarti cutover sudah terjadi tanpa pencatatan; jangan jalankan deploy
resmi atau menebak state. Image tak dikenal, journal hilang/rusak, state baru
dengan container lama, atau health gagal memerlukan penghentian dan penanganan
operator. Jangan otomatis restore database atau mengisi/menghapus data NULL.

Selesaikan rekonsiliasi hanya setelah guard resmi, API, frontend, alur utama,
dan rollback kompatibel benar-benar diverifikasi; dokumentasikan batas bukti.
