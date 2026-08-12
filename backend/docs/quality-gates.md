# Quality gates backend

Dokumen ini adalah checklist sederhana sebelum membuat commit atau pull request.

## Perintah utama

Jalankan dari folder `backend`:

```bash
npm run quality:check
```

Perintah tersebut menjalankan empat pemeriksaan berurutan:

1. `npm run typecheck` memastikan TypeScript memahami seluruh import dan tipe.
2. `npm test` menjalankan unit/integration test yang tersedia tanpa memerlukan database produksi.
3. `npm run api:check` memastikan setiap route Fastify memiliki operation di `docs/openapi.yaml`.
4. `npm run build` menghapus `dist` lama lalu membuat artefak produksi baru.

Jika satu langkah gagal, perbaiki langkah itu sebelum melanjutkan. Jangan melewati typecheck dengan cast `any`; gunakan `unknown`, type guard, atau tipe boundary dari `src/shared/database/database.types.ts`.

## Cara membaca hasil gagal

- **Typecheck gagal**: baca file dan nomor baris pertama. Biasanya kontrak service/repository tidak sama atau nilai dari database belum dinormalisasi.
- **Test gagal**: lihat nama test pertama yang gagal, lalu reproduksi hanya test itu dengan `node --import tsx --test path/to/file.test.ts`.
- **API parity gagal**: tambahkan atau perbarui operation di `docs/openapi.yaml`, termasuk response error dan parameter query/body.
- **Build gagal**: jalankan typecheck lagi; build memakai konfigurasi yang sama tetapi juga memeriksa output `dist` bersih.

## Checklist review manusia

- Route hanya membaca request dan memanggil service.
- Service memvalidasi input, izin, dan actor database sebelum memanggil repository.
- Repository memakai query terparameterisasi, kolom eksplisit, pagination, dan index yang sesuai.
- Mutation punya alasan perubahan dan idempotency jika operasi dapat dikirim ulang.
- Error yang dikembalikan ke client tidak membocorkan SQL, token, atau secret.
- Feature README dan OpenAPI diperbarui ketika endpoint baru ditambahkan.

## Batas verifikasi lokal

`npm audit` dan pengujian beban/`EXPLAIN ANALYZE` membutuhkan registry atau database staging yang tersedia. Jalankan di CI/staging dengan akses resmi, bukan pada database produksi dari laptop developer.
