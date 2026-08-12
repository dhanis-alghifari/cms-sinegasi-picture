# Cash module

Modul ini menangani seluruh alur kas. Mulai membaca dari `cash.module.ts`,
karena file itu adalah public interface yang dipakai composition root.

## Folder map

```text
cash/
├── cash.module.ts          # public interface dan route registration
├── ledger/                 # saldo, daftar transaksi, kas masuk/keluar
├── reports/                # laporan, tunggakan, dan billing rules
├── payment-methods/        # master metode pembayaran
├── disputes/               # pengajuan dan penyelesaian sanggahan
├── shared/                 # tipe, helper, memory state, schema HTTP lokal
└── README.md
```

Setiap subdomain menggunakan pola yang sama:

```text
route → service → repository → Supabase RPC/query atau memory adapter
```

Route hanya menangani HTTP dan authorization. Service menjalankan aturan
bisnis. Repository menyembunyikan detail persistence.

## Endpoint map

| Endpoint | Route file | Service | Persistence |
| --- | --- | --- | --- |
| `GET /api/cash/summary` | `ledger/cash.read.routes.ts` | `CashReadService.getSummary` | `cash.read.repository.ts` |
| `GET /api/cash/transactions` | `ledger/cash.read.routes.ts` | `CashReadService.listTransactions` | `cash.read.repository.ts` |
| `POST /api/cash/transactions/in` | `ledger/cash.mutations.routes.ts` | `CashMutationsService.recordIn` | `cash.mutations.repository.ts` |
| `POST /api/cash/transactions/out` | `ledger/cash.mutations.routes.ts` | `CashMutationsService.recordOut` | `cash.mutations.repository.ts` |
| `GET /api/cash/report` | `reports/cash.reporting.routes.ts` | `CashReportingService.getReport` | `cash.reporting.repository.ts` |
| `GET /api/cash/debts` | `reports/cash.reporting.routes.ts` | `CashReportingService.listDebts` | `cash.reporting.repository.ts` |
| `GET/PUT /api/cash/billing-rules` | `reports/cash.reporting.routes.ts` | `CashReportingService.*BillingRules` | `cash.reporting.repository.ts` |
| `GET/POST/PATCH /api/cash/payment-methods` | `payment-methods/*routes.ts` | `CashPaymentMethodsService` | `cash.payment-methods.repository.ts` |
| `POST/PATCH /api/cash/disputes` | `disputes/*routes.ts` | `CashDisputesService` | `cash.disputes.repository.ts` |

## Example reading flow

Untuk bug pada kas masuk, baca berurutan:

1. `ledger/cash.mutations.routes.ts`: pastikan endpoint dan guard benar.
2. `ledger/cash.mutations.service.ts`: periksa nominal, tanggal, payment method,
   dan idempotency.
3. `ledger/cash.mutations.repository.ts`: periksa RPC atomic atau memory flow.
4. Migration cash dan `docs/query-optimization.md`: periksa database function,
   index, dan privilege.

Jika hanya gagal saat database belum tersedia, periksa adapter memory. Jika
hanya gagal di production, periksa Supabase RPC dan migration terlebih dahulu.

## Invariants penting

- `X-Idempotency-Key` harus dipakai ulang untuk retry operasi yang sama.
- Pengeluaran tidak boleh membuat saldo menjadi negatif.
- Member hanya dapat melihat atau menyanggah transaksi miliknya.
- Metode pembayaran dinormalisasi ke kode allow-list.
- Error database tidak dikirim mentah ke client.
