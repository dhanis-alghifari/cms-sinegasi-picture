# Changelog

Semua perubahan penting pada repository ini dicatat di file ini.

## [Unreleased]

### Architecture and maintainability

- Memisahkan komposisi aplikasi, route registry, dependency wiring, dan feature module facade.
- Memecah feature cash ke subdomain ledger, reports, payment-methods, dan disputes.
- Menambahkan README per feature serta code tour dan feature map untuk onboarding developer baru.
- Menghapus tipe `any` dari source production; boundary database sekarang memakai `unknown` dan `DatabaseError` bersama.

### Security and data access

- Menolak secret JWT dan password default saat environment production dimulai.
- Memastikan query daftar utama memilih kolom eksplisit, memakai pagination, dan membatasi ukuran halaman.
- Menjaga audit trail, request ID, rate limit, CORS, security headers, dan idempotency pada mutation yang relevan.
- Menambahkan proyeksi actor (`nama`, `username`, `role`) secara batch ke response
  audit UUID lintas modul, dengan cache singkat dan fallback aman tanpa mengubah
  field UUID legacy.
- Menambahkan migration 036 untuk snapshot actor RBAC dan migration 037 untuk
  audit atomik bulk grading serta rotasi password tanpa menyimpan password hash.
- Menambahkan migration 040 untuk reset password teacher-only yang atomik,
  idempotent, mengrotasi `auth_version`, dan mengeluarkan satu audit event.
- Menutup kebocoran credential pada audit response legacy melalui redaction
  rekursif di repository tanpa mengubah histori immutable secara otomatis.

### Quality and API contract

- Menambahkan pemeriksaan parity route Fastify terhadap OpenAPI (`npm run api:check`).
- Menambahkan quality gate terpadu (`npm run quality:check`) yang menjalankan typecheck, test, API parity, dan build bersih.
- Validator OpenAPI kini membandingkan pasangan method/path sumber dengan
  dokumentasi, bukan hanya jumlah operation.
