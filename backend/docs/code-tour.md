# Backend code tour

Dokumen ini adalah titik mulai untuk developer baru. Backend menggunakan Fastify
modular monolith: satu proses aplikasi, tetapi setiap domain memiliki module,
interface, service, dan repository sendiri.

## Mulai dari proses aplikasi

```text
src/server.ts
  ↓
src/app/createApplication.ts
  ├── registerAppHooks()
  ├── createAppDependencies()
  └── registerAppRoutes()
       ├── core routes
       ├── catalog routes
       ├── cash module
       └── borrowing routes
```

`server.ts` hanya memulai HTTP server dan worker. Jangan menambahkan aturan
bisnis atau query database di sana.

## Cara mengikuti satu request

Contoh `POST /api/cash/transactions/in`:

```text
HTTP request
  → route plugin: authentication, role guard, schema, response status
  → service: validasi dan aturan bisnis
  → repository interface: operasi berdasarkan intent bisnis
  → Supabase RPC atau memory adapter
  → response envelope
```

Cara mencari kode:

1. Cari path endpoint dengan `rg "transactions/in" src`.
2. Ikuti import service dari route.
3. Ikuti repository yang diterima constructor service.
4. Periksa test service untuk aturan bisnis.
5. Periksa test route untuk authorization dan response envelope.
6. Periksa migration/RPC hanya jika bug berada di persistence.

## Arti tiap layer

| Layer | Tanggung jawab | Tidak boleh dilakukan |
| --- | --- | --- |
| Route | HTTP, schema, auth, status code | Query database dan aturan bisnis panjang |
| Service | Use case, validasi, ownership, error mapping | Bergantung pada Fastify request/reply |
| Repository | Query/RPC, mapping row, adapter memory | Menentukan role atau response HTTP |
| Module facade | Merakit implementation dan route plugins | Membocorkan detail adapter ke aplikasi |
| Shared | Kode yang benar-benar lintas domain | Menjadi tempat semua helper tanpa pemilik |

## Jika terjadi error

- `401/403`: mulai dari route dan middleware auth/capability.
- `422`: mulai dari schema dan service validation.
- `404/409`: periksa ownership, duplicate constraint, dan state transition.
- `500/503`: periksa repository, migration, RPC, dan konfigurasi.
- Response salah tetapi operasi berhasil: periksa mapper/DTO di service atau repository.

## Quality gate sebelum perubahan dianggap selesai

```bash
npm run typecheck
npm test
npm run api:check
npm run build
```

Untuk query dan security production, jalankan `EXPLAIN (ANALYZE, BUFFERS)`,
privilege checks, dan load test hanya pada staging yang memang diotorisasi.
