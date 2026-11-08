# Uji sintetis migrasi dan rollback deadline lomba

Jalankan hanya pada host Docker **terisolasi/nonproduksi**, dengan gambar berikut sudah tersedia di cache lokal:

- `postgres@sha256:3645570cccdfa447589da9f57dd740faa29b30938e861289a5574b6ca6b03826`
- `ghcr.io/dhanis-alghifari/cms-sinegasi-picture/api@sha256:d6b998602feefc66d74d484bf5863d415a12721bbca534d7d2fa169e8326e3f4`

Gambar harus diperoleh dan diverifikasi melalui proses organisasi sebelum uji. Skrip menggunakan `--pull never` dan tidak mengunduh gambar, memerlukan koneksi, secret, database, service, atau file produksi. Jangan gunakan bind mount atau volume produksi. Jika Docker host berbagi layanan penting, perhatikan kapasitas sumber daya dan gunakan host uji terpisah.

Dari root worktree ini, dengan Docker berjalan:

```sh
bash scripts/rehearse-contest-null-rollback.sh
```

Sukses ditandai `ROLLBACK_IMAGE_SYNTHETIC_PG_ROW_OK` dan `ISOLATED_POSTGRES_MIGRATION_CHECKS_OK`, diikuti exit code 0. Skrip membuat kontainer PostgreSQL dengan `--network none`, tanpa port dan penyimpanan tmpfs sementara. Kontainer rollback juga menggunakan `--network none`. Setelah selesai/gagal, trap hanya menghentikan kontainer PostgreSQL dengan ID, label unik, dan mode network milik run tersebut; kedua kontainer menggunakan `--rm`. Pada gangguan host/`SIGKILL`, trap mungkin tidak berjalan: periksa label `sinegasi.contest-rehearsal` dan pastikan ID serta nama run sebelum cleanup manual, jangan hapus kontainer lain.

Skrip memasang file migrasi yang ada di worktree pada skema sintetis minimal, memeriksa deadline kosong pada event selesai, event buka bertanggal hari ini, penolakan event buka tanpa tanggal, dan kegagalan `SET NOT NULL` saat data NULL ada. Hasil baris sintetis diteruskan ke mapper dalam image rollback yang dipin.

**Batas:** ini bukan uji migrasi terhadap seluruh skema produksi, bukan full-stack atau uji browser, dan tidak membuktikan auth/session, API server/PostgREST, Storage, kompatibilitas dependensi lain, restore data, atau keberhasilan deployment. Kegagalan `SET NOT NULL` berarti rollback skema memerlukan penanganan data NULL yang direncanakan; jangan mengisi tanggal palsu atau menjalankan rollback destruktif secara otomatis. Setelah rollback aplikasi, form edit lama tetap dapat mewajibkan tanggal meskipun tampilan daftar mendukung NULL.
