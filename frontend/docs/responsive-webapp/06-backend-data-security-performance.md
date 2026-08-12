# 06 — Backend, API, Data, Performa, dan Keamanan

## Tujuan

Responsive UI tidak cukup jika API terlalu besar, otorisasi ambigu, session rapuh, atau query tidak terukur. Dokumen ini menetapkan guardrail backend/data yang harus berjalan paralel dengan vertical slice.

## Strategi Backend: Modular Monolith

Backend tetap satu Fastify app. `server.ts` yang besar dipindahkan sedikit demi sedikit per domain:

1. route registration;
2. request/response schema;
3. service/use case;
4. repository/data access;
5. mapper/public DTO;
6. module tests.

Tidak ada perubahan database client atau deployment hanya demi memecah file.

### Ownership

| Layer | Boleh | Tidak boleh |
|---|---|---|
| route | auth guard, parse schema, call service, map HTTP | SQL/domain calculation |
| service | authorization use case, invariant, transaction orchestration | Fastify reply/UI wording detail |
| repository | query/projection/locking | role UX dan toast |
| mapper | public DTO/redaction | database write |
| shared plugin | CORS, context, errors, headers | domain-specific rule |

## Standard API Contracts

### List

```json
{
  "success": true,
  "data": [],
  "page": 1,
  "pageSize": 20,
  "total": 0,
  "totalPages": 0,
  "request_id": "uuid"
}
```

Server menetapkan batas `pageSize`, stable default sort, allowlist sort field, dan filter validation.

### Detail

```json
{
  "success": true,
  "data": {},
  "request_id": "uuid"
}
```

List dan detail memiliki projection berbeda. JSON audit, image arrays besar, atau nested relations tidak ikut list bila tidak diperlukan.

### Mutation

```json
{
  "success": true,
  "data": {},
  "message": "Outcome bisnis yang jelas",
  "request_id": "uuid"
}
```

Mutation sensitif menerima idempotency key dan audit reason melalui contract yang konsisten.

### Public error

```json
{
  "success": false,
  "code": "CASH_PAYMENT_METHOD_INACTIVE",
  "message": "Metode pembayaran tidak lagi aktif.",
  "field_errors": {},
  "request_id": "uuid"
}
```

PostgreSQL code, constraint name, SQL, stack, Supabase key, dan raw upstream body hanya masuk structured server log.

## Authentication Hardening

### Target

- access/session token berada di HttpOnly cookie;
- `Secure` pada non-local environment;
- `SameSite=Lax` atau lebih ketat sesuai flow;
- session user diperoleh melalui `/auth/me`;
- `auth_version`/session version merevoke session lama setelah password reset, role change, atau deactivation;
- bearer localStorage dihapus dengan migration rollout yang kompatibel.

### Expand/contract rollout

1. Backend mendukung cookie dan bearer lama sementara.
2. Frontend beralih ke cookie dan tidak lagi mempersist token.
3. Monitor auth error dan browser compatibility.
4. Revoke/expire bearer lama.
5. Hapus code localStorage dan compatibility path.

### CSRF

Cookie-based mutation memerlukan:

- Origin/Referer allowlist;
- SameSite cookie;
- CSRF token bila threat model/deployment membutuhkan cross-site flow;
- non-GET route tidak menerima simple cross-origin form secara tidak sengaja.

Keputusan final ditulis dalam ADR.

## Authorization Model

Ganti asumsi “role lebih tinggi boleh semuanya” dengan permission eksplisit.

Contoh capability:

```text
students.read
students.write
users.manage
attendance.record
grades.manage
cash.read
cash.record
cash.export
equipment.manage
borrowing.submit
borrowing.approve
borrowing.handover
borrowing.return
audit.read
```

### Enforcement

1. Route memeriksa capability umum.
2. Service memeriksa ownership/record scope.
3. Repository selalu memakai actor-scoped filter bila relevan.
4. Response mapper meredact field berdasarkan permission.
5. Frontend menyembunyikan action hanya untuk UX, bukan security.

### IDOR tests wajib

- user A membaca/mengubah record user B;
- member mencoba endpoint teacher/treasurer;
- valid UUID record yang berada di luar scope;
- mass-assignment role/status/created_by;
- manipulasi query filter agar scope melebar;
- direct Supabase/RLS behavior sesuai exposure policy.

## CORS dan Security Headers

### CORS

- allowlist dari environment;
- exact origin match;
- credentials hanya untuk origin yang disetujui;
- preflight methods/headers minimum;
- `Vary: Origin`;
- tidak ada manual reflection di error handler.

### Headers

- Content Security Policy bertahap;
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy`;
- frame protection melalui CSP `frame-ancestors`;
- HSTS hanya pada HTTPS deployment;
- `Permissions-Policy` minimum;
- cache policy eksplisit per route class.

## Cache Policy

| Route class | Policy awal |
|---|---|
| auth/session | `private, no-store` |
| users/audit/notifications | `private, no-store` |
| cash/borrowing/grades | `private, no-store` atau short private cache setelah audit |
| stable master/options | private short cache + ETag bila aman |
| static assets | fingerprinted immutable |
| health | no-store atau short public tanpa data sensitif |

Perbaiki mismatch `/api/borrowing` vs `/api/borrowings` dan unreachable duplicate cache branch. Test header untuk success dan error response.

## Rate Limiting dan Abuse Control

Terapkan key dan limit sesuai endpoint:

- login/change/reset password: username/IP/session aware;
- upload/export: lebih ketat dan memiliki ukuran maksimum;
- search options: debounce client dan rate limit server;
- expensive reports: range maksimum, role guard, concurrency cap;
- mutation bisnis: idempotency, bukan hanya rate limiting.

## Audit dan Observability

### Request context

Setiap request memiliki:

- request ID;
- actor ID/role;
- route dan method;
- status code;
- duration;
- operation ID untuk multi-record mutation;
- safe error code;
- metadata minimal tanpa secret/PII berlebihan.

### Metrics

- request count/error/latency per route;
- auth failures dan rate-limit hits;
- DB/RPC latency;
- report/export duration;
- duplicate idempotency outcomes;
- cache hit/refetch count client;
- Web Vitals per route/viewport;
- client crash dan lazy-load failure.

## XSS dan Frontend Security

Baseline source tidak menunjukkan dangerous HTML sink langsung, tetapi guardrail tetap wajib:

- React rendering text default, tanpa `dangerouslySetInnerHTML`;
- allowlist internal route untuk notification links;
- validasi `http/https` untuk external media links;
- upload preview menggunakan object URL yang direvoke;
- file type diperiksa client dan server;
- CSP ditingkatkan dari report-only ke enforce setelah violation bersih;
- stored XSS payload diuji di siswa, keterangan, audit reason, alat, lomba, dan notifikasi;
- token tidak disimpan di localStorage setelah auth migration.

## Data Access dan Query Optimization

### Aturan

1. Tetapkan access pattern dan volume.
2. Ambil query SQL/RPC aktual.
3. Jalankan `EXPLAIN (ANALYZE, BUFFERS)` pada staging.
4. Ukur rows, loops, scan, sort, buffer, dan execution time.
5. Perbaiki projection/query dahulu.
6. Tambah index hanya jika bukti mendukung.
7. Ukur ulang read dan write overhead.

### Pagination

- page/offset cukup untuk dataset kecil dan random-page UX;
- keyset/cursor dipertimbangkan untuk audit/notifications yang terus tumbuh;
- stable sort selalu memiliki tie-breaker `id`;
- total count mahal boleh dipisah/di-cache jika terukur menjadi bottleneck.

### Index design

Urutan index mengikuti:

```text
equality predicates → range/date → ORDER BY/tie breaker
```

Partial index dipakai hanya bila predicate stabil dan query selalu menyertakannya. Jangan membuat index untuk setiap filter kombinasi.

### N+1 dan over-fetching

- list menggunakan join/projection terukur;
- count relasi dilakukan aggregate, bukan request per card;
- detail nested hanya diambil saat detail dibuka;
- option endpoint mengirim DTO kecil;
- gambar memakai ukuran thumbnail dan lazy loading.

## Database Migration Policy

- migration lama yang sudah terpasang tidak diedit untuk production fix;
- migration baru idempotent bila proyek mengandalkan rerun manual;
- `CREATE INDEX CONCURRENTLY` dipertimbangkan untuk tabel besar dan dijalankan di luar transaction sesuai tooling;
- constraint baru dapat melalui add nullable/backfill/validate/set not null;
- enum PostgreSQL dihindari untuk payment method dinamis; gunakan master table stable code;
- destructive drop/rename memakai expand-contract;
- backup/restore dan rollback diverifikasi sebelum high-risk migration.

## Responsive-related Data Changes

Tidak ada migration hanya karena UI berubah. Migration baru mungkin sah untuk:

- compact search index yang terukur;
- cursor index audit/notification;
- projection/RPC report yang membutuhkan schema object;
- permission/session hardening;
- reconciliation constraint.

Setiap proposal mencantumkan query plan before/after dan rollback.

## Threat Model Ringkas

| Threat | Boundary | Kontrol |
|---|---|---|
| token theft via XSS | browser/session | HttpOnly cookie, CSP, no dangerous sinks |
| CSRF mutation | browser/API | SameSite, Origin check, CSRF policy |
| IDOR | API/service-role DB | capability + record scope + tests |
| SQL/RPC misuse | API/DB | schema validation, parameterized client/RPC |
| duplicate financial mutation | API/DB | idempotency + lock + unique constraint |
| role escalation | users endpoint | field allowlist + capability + audit |
| open redirect | notification/login | internal path allowlist |
| spreadsheet injection | export | cell escaping/sanitization |
| sensitive error leakage | API/client | public error map + structured logs |
| stale private cache | browser/proxy | explicit private/no-store policy |
| upload abuse | API/storage | type/size/path validation + rate limit |

## Backend/Data Exit Criteria

- [ ] route yang dimigrasikan memiliki schema request/response;
- [ ] capability dan record-scope tests lulus;
- [ ] public errors tidak membocorkan detail internal;
- [ ] cache/CORS headers benar pada success/error/preflight;
- [ ] query/payload dibandingkan baseline;
- [ ] no N+1 pada collection;
- [ ] mutation sensitif idempotent dan audited;
- [ ] log memiliki request ID tanpa secret;
- [ ] migration, bila ada, memiliki rollback dan verification query;
- [ ] frontend mobile tidak membutuhkan endpoint tanpa pagination/batas.

