# 05 — Vertical Slice Uang Kas

## Mengapa Kas Menjadi Slice Khusus

Kas menggabungkan ledger, transaksi pemasukan/pengeluaran, iuran mingguan, piutang, metode pembayaran, audit, laporan, dan export. Kesalahan presentasi dapat menjadi kesalahan pembukuan. Karena itu slice ini dilakukan setelah pola responsif sederhana dibuktikan di Siswa.

## Status Implementasi Mobile — 2026-08-10

Perubahan yang sudah diterapkan:

- `CashPage` mempertahankan action header untuk desktop. Pada mobile, tiga aksi
  yang setara memakai satu FAB icon-only berukuran coarse-pointer di atas safe
  area bottom navigation. Tap FAB membuka bottom sheet berisi `Kas masuk`,
  `Pengeluaran`, dan `Pengaturan iuran`; tidak ada action card permanen yang
  menggeser atau menutupi kartu saldo.
- `CashReportFilter` mereduksi filter laporan menjadi ringkasan periode + tombol
  `Filter` pada mobile. Draft tanggal/metode baru memanggil query setelah
  `Terapkan filter`.
- tab Kas memakai label ringkas dan grid equal-width sampai `md`, gap antartarget
  8px, lalu label lengkap yang tidak membungkus pada layar yang lebih lebar.
- `FastCashInModal` memakai full-height mobile shell dengan header/footer tetap
  dan satu body form sebagai pemilik scroll vertikal.
- pemilihan siswa memakai Base UI combobox searchable; query hanya meminta
  maksimal 20 siswa aktif melalui `GET /api/students/options?q=&limit=20&active=true`.
- route options memakai projection minimal dan guard eksplisit
  `requireAnyRole('teacher', 'treasurer')`; role lain tidak dapat menggunakannya.

### Status Implementasi MVP dan Loading Boundary

Urutan awal page manager dibuat berorientasi tugas:

```text
Header
→ aksi Kas masuk / Pengeluaran
→ saldo saat ini + tiga metrik ringkas
→ Aktivitas Kas + transaksi terbaru
```

Kontrak loading awal:

- hanya `cash.summary` dan lima transaksi terbaru yang dimuat pada landing
  manager;
- query daftar transaksi penuh baru aktif ketika tab `Transaksi` dibuka;
- query tunggakan baru aktif ketika tab `Tunggakan` dibuka;
- query laporan dan komponennya baru aktif ketika tab `Laporan` dibuka;
- payment methods baru aktif ketika filter transaksi, laporan, atau dialog yang
  membutuhkannya dibuka; billing rules hanya aktif ketika dialog pengaturan
  atau kas masuk membutuhkannya;
- modal laporan dan dialog pencatatan dipisah menjadi lazy chunks dan tidak
  dirender sebelum benar-benar dibuka.

Setiap boundary memiliki state loading, error dengan retry, dan empty state.
Mutation tetap memakai idempotency key serta invalidasi cache yang sudah ada;
optimistic transaction tidak dibuat untuk nominal `0` karena unpaid hanya
menulis kewajiban, bukan transaksi kas.

Kontrak ini wajib dipertahankan ketika fitur kas dipecah menjadi composition.
Jangan mengembalikan full student list ke modal atau menambahkan scroll owner
baru pada body dialog.

## Invariant Bisnis

Invariant ini lebih penting daripada tampilan:

1. Uang yang belum diterima tidak boleh masuk `cash_transactions`.
2. Nominal nol untuk iuran berarti kewajiban/piutang, bukan pemasukan nol.
3. Metode pembayaran hanya wajib jika uang benar-benar diterima.
4. Saldo berasal dari ledger server, bukan penjumlahan cache client.
5. Retry tidak boleh membuat transaksi atau utang ganda.
6. Satu kewajiban mingguan siswa tidak boleh digandakan.
7. Payment method memakai stable code/ID; label dapat berubah tanpa mengubah histori.
8. Semua perubahan sensitif memiliki actor dan change reason.
9. Export memakai data/report contract server yang sama dengan layar.
10. Filter date range default 30 hari dan maksimum 90 hari untuk report interaktif.

## Target Information Architecture

### Desktop

```text
Header + primary actions
KPI saldo + metrics
Tabs: Aktivitas | Transaksi | Piutang | Laporan
Filter hanya di workspace yang memerlukannya
```

### Mobile

```text
Top bar
Saldo saat ini + metrik ringkas
Icon-only FAB → action sheet: Kas masuk | Pengeluaran | Pengaturan iuran
Segmented control:
  Aktivitas | Transaksi | Piutang | Laporan
Mobile cards / stacked charts saat section dibuka
```

Jangan menampilkan semua tabel, charts, debts, dan forms sekaligus pada ponsel.

## Ringkasan yang Ditampilkan

Untuk date range terpilih:

- saldo awal;
- total pemasukan;
- total pengeluaran;
- saldo akhir;
- total piutang outstanding;
- jumlah siswa menunggak;
- breakdown penerimaan per metode pembayaran;
- warning rekonsiliasi jika angka ledger tidak seimbang.

Breakdown metode pembayaran menampilkan label, bukan code `qris_dana`/`qris_gopay`.

## Flow Catat Pemasukan

### Langkah UI

1. Pengguna menekan “Catat Kas”.
2. Memilih `Iuran wajib` atau `Pemasukan lain`.
3. Jika iuran, memilih siswa melalui server-search combobox.
4. Memilih tanggal; default hari ini dan dapat diubah sesuai aturan bisnis.
5. Mengisi status/nominal:
   - nominal `0`: belum membayar;
   - nominal `> 0`: uang diterima.
6. Metode pembayaran:
   - disembunyikan/tidak wajib saat nominal 0;
   - wajib dan hanya metode aktif saat nominal > 0.
7. Mengisi keterangan dan bukti bila diperlukan.
8. Review outcome sebelum submit:
   - “Akan membuat piutang Rp X”, atau
   - “Akan mencatat pemasukan Rp X melalui QRIS DANA”.
9. Submit satu kali dengan idempotency key.
10. Server mengembalikan outcome lengkap: paid/partial/unpaid, transaction, debt, outstanding.
11. UI memperbarui KPI, transaksi, piutang, dan report yang relevan.

### Wording

Jangan memaksa instruksi “Pilih status Belum bayar untuk nominal Rp0” jika nominal itu sendiri sudah menentukan outcome. Gunakan feedback kontekstual:

- nominal 0: “Tidak ada uang masuk. Sistem akan mencatat piutang iuran periode ini.”
- nominal parsial: “Pembayaran belum menutup kewajiban. Sisa akan menjadi piutang.”
- lunas: “Pembayaran akan dicatat sebagai pemasukan.”

## Flow Catat Pengeluaran

1. Pilih tanggal.
2. Masukkan nominal positif; tipe menentukan arah ledger.
3. Pilih kategori jika domain menyediakannya.
4. Isi penerima/keterangan/bukti.
5. Tampilkan saldo sebelum dan estimasi saldo sesudah dari data server terbaru.
6. Konfirmasi jika pengeluaran melewati threshold atau membuat saldo negatif sesuai policy.
7. Server mengunci/menghitung ledger secara atomik.
8. UI menampilkan outcome server dan memperbarui section terkait.

Pengeluaran tidak boleh dikirim sebagai angka negatif dari client.

## Flow Piutang

```text
Piutang outstanding
→ filter siswa/periode/status
→ detail kewajiban dan pembayaran
→ catat pembayaran
→ alokasi oldest-unpaid sesuai policy
→ tampilkan sisa atau lunas
→ audit event
```

Jika pembayaran berlebih diperbolehkan, policy harus eksplisit: menjadi credit balance, dialokasikan ke periode berikut, atau ditolak. Jangan membiarkan sisa hilang diam-diam.

## Flow Laporan

1. Default date range 30 hari hingga hari ini.
2. Pengguna dapat memilih rentang maksimal 90 hari.
3. Summary dan semua section memakai rentang yang sama.
4. Filter tambahan: tipe, metode pembayaran, siswa, status piutang.
5. Export menghasilkan section terpisah agar mudah dipakai di slide:
   - cover/periode dan ringkasan;
   - komposisi arus kas;
   - aktivitas kas harian;
   - breakdown metode pembayaran;
   - siswa menunggak;
   - rincian pemasukan;
   - rincian pengeluaran;
   - reconciliation/audit footer.
6. PDF bukan screenshot DOM. Gunakan layout dokumen dari structured report data.
7. Excel memakai sheet terpisah dengan angka numerik, bukan string rupiah.

### Presentasi laporan per viewport

| Section | Mobile | Tablet | Desktop/print |
|---|---|---|---|
| KPI | grid dua kolom | grid 2–3 kolom | KPI row |
| Aktivitas harian | stacked bar/list | stacked bars | chart/table print |
| Siswa menunggak | card: nama, kelas, jumlah catatan, total | card grid/compact table | semantic table |
| Rincian pemasukan | grouped transaction cards | compact list/table | semantic table |
| Rincian pengeluaran | grouped transaction cards | compact list/table | semantic table |

Card rincian transaksi memprioritaskan tanggal, nominal, jenis/metode, dan
siswa/keterangan. Metadata lengkap dibuka melalui detail sheet. Jangan merender
tujuh kolom sebagai teks kecil atau mengandalkan `overflow-auto` pada ponsel.

Table khusus PDF/print boleh dipertahankan terpisah dari presentation layar.
Table tersebut harus tersembunyi dari layout dan accessibility tree saat tidak
mencetak. Hanya satu adapter laporan interaktif yang aktif per viewport.

## Component Decomposition Target

```text
features/cash/
├── pages/
│   └── CashPage.tsx
├── compositions/
│   ├── CashWorkspace.tsx
│   └── useCashWorkspace.ts
├── components/
│   ├── summary/
│   │   ├── CashKpiGrid.tsx
│   │   └── PaymentMethodBreakdown.tsx
│   ├── transactions/
│   │   ├── CashTransactionTable.tsx
│   │   ├── CashTransactionList.tsx
│   │   └── CashTransactionCard.tsx
│   ├── debts/
│   │   ├── DebtTable.tsx
│   │   ├── DebtList.tsx
│   │   └── DebtDetailSheet.tsx
│   ├── report/
│   │   ├── CashReportWorkspace.tsx
│   │   ├── CashFlowComposition.tsx
│   │   ├── DailyCashActivity.tsx
│   │   ├── DelinquentStudentsTable.tsx
│   │   ├── DelinquentStudentsList.tsx
│   │   ├── CashReportDetailTable.tsx
│   │   ├── CashReportDetailList.tsx
│   │   └── ReportExportActions.tsx
│   └── forms/
│       ├── CashEntrySheet.tsx
│       ├── CashEntryForm.tsx
│       ├── CashEntryFields.tsx
│       └── CashEntryOutcome.tsx
├── queries/
├── mutations/
├── services/
├── schemas/
├── types/
└── utils/
    └── cashLabels.ts
```

`FastCashInModal` tidak perlu mempertahankan seluruh ownership. Form controller, fields, dan shell dipisah agar form dapat menjadi dialog desktop dan full-height sheet mobile tanpa business logic ganda.

## Query dan Cache Strategy

### Query keys

```text
cash.summary(range, filters)
cash.transactions(page, pageSize, range, filters, sort)
cash.debts(page, pageSize, filters, sort)
cash.report(range, filters)
cash.paymentMethods(activeOnly)
cash.settings()
```

### Setelah mutation sukses

Invalidasi hanya:

- summary yang terdampak;
- page transaksi yang relevan;
- piutang siswa/periode terkait;
- report untuk rentang yang mencakup tanggal transaksi;
- audit list terkait jika sedang terbuka.

Jangan me-refetch seluruh aplikasi.

### Optimistic update

Optimistic update diperbolehkan pada list transaksi dan KPI hanya jika:

- mutation memiliki idempotency key;
- snapshot cache tersedia;
- rollback deterministik;
- outcome server menggantikan nilai optimistis;
- piutang/partial allocation tidak dihitung sendiri bila rule server kompleks.

Untuk pencatatan unpaid, jangan menambahkan fake transaction. Tambahkan/update debt summary sesuai response server.

## API Contract Target

### Mutation response

```json
{
  "success": true,
  "data": {
    "payment_status": "unpaid",
    "already_recorded": false,
    "cash_transaction": null,
    "debt": {},
    "amount_due": 5000,
    "amount_paid": 0,
    "amount_outstanding": 5000,
    "payment_method": null
  },
  "request_id": "..."
}
```

### Report response

Report mengirim structured sections, bukan gambar atau HTML:

```text
period
openingBalance / income / expense / closingBalance
outstandingDebt / delinquentStudents
paymentMethodBreakdown[]
dailyActivity[]
incomeDetails[]
expenseDetails[]
debtDetails[]
reconciliation
```

## Accounting Check and Balance

Minimal reconciliation:

```text
expectedClosing = openingBalance + recognizedIncome - recognizedExpense
variance = recordedClosing - expectedClosing
```

Kewajiban/piutang tidak ditambahkan ke kas sampai uang diterima. Report membedakan:

- cash basis: uang benar-benar diterima/dibayar;
- receivables: kewajiban belum diterima;
- payment-channel composition: hanya transaksi yang memiliki payment method.

Jika `variance != 0`, export dan dashboard harus memberi warning; jangan menyembunyikannya dengan rounding client.

## Database dan Performance

- pertahankan stable payment method ID/code dan mutable label;
- endpoint list mengambil projection, bukan seluruh row dan metadata besar;
- report aggregate dilakukan server-side;
- date filter memakai kolom tanggal yang dapat di-index;
- gunakan existing index dahulu;
- jalankan `EXPLAIN (ANALYZE, BUFFERS)` pada query report/list volume realistis;
- index baru harus mendukung equality + range/order aktual;
- hindari satu global ledger lock bila concurrency dan volume membuktikan bottleneck; perubahan lock strategy memerlukan invariant/concurrency tests.

## Security

- hanya permission kas yang dapat create/update/export sesuai policy;
- student ID dan payment method divalidasi server;
- inactive method ditolak untuk transaksi baru tetapi histori tetap terbaca;
- nominal memiliki batas atas dan precision server;
- upload evidence divalidasi tipe/ukuran/path;
- audit tidak menyimpan token atau payload file;
- formula injection dicegah pada CSV/Excel cell yang dimulai `=`, `+`, `-`, `@`;
- PDF/Excel tidak menyertakan data di luar filter/permission aktor.

## Negative dan Edge Cases

| Case | Expected outcome |
|---|---|
| nominal nol untuk pemasukan lain | ditolak |
| nominal nol + payment method | payment method diabaikan UI dan ditolak server |
| tanggal future untuk unpaid | mengikuti policy eksplisit; pesan domain, bukan SQL error |
| weekly due nol/tidak ada | ditolak sebagai konfigurasi tidak valid |
| duplicate click/request retry | satu outcome, `already_recorded` benar |
| siswa/periode sudah punya debt | tidak menggandakan |
| pembayaran parsial | transaksi tercatat, sisa debt benar |
| pembayaran melebihi debt | policy overpayment eksplisit |
| metode nonaktif | ditolak untuk transaksi baru |
| network putus setelah server commit | retry key mengembalikan hasil yang sama |
| dua bendahara mencatat bersamaan | saldo/invariant tetap benar |
| tanggal di luar report | tidak mengubah cache report aktif |
| filter 91 hari | client dan server menolak |
| export dataset kosong | dokumen valid dengan empty section |
| timezone pergantian hari | periode/tanggal mengikuti Asia/Jakarta policy |
| audit trigger gagal | transaksi atomik gagal atau policy failure eksplisit |

## Acceptance Criteria Slice Kas

- [ ] mobile 320px tidak memiliki overflow horizontal tidak disengaja;
- [ ] siswa menunggak dan rincian pemasukan/pengeluaran memakai card/list mobile;
- [ ] tidak ada interactive report table yang terlihat pada viewport `< 768px`;
- [ ] table print/export tersembunyi dari layar dan accessibility tree;
- [ ] create paid/unpaid/partial bekerja tanpa refresh manual;
- [ ] tidak ada fake cash transaction untuk unpaid;
- [ ] payment method label termasking konsisten;
- [ ] KPI, list, debt, dan report konsisten setelah mutation;
- [ ] date range default 30 dan maksimum 90 hari;
- [ ] PDF/Excel berasal dari structured data, bukan screenshot;
- [ ] role/IDOR/duplicate/concurrency tests lulus;
- [ ] reconciliation variance nol pada fixture valid;
- [ ] query plan dan payload memenuhi budget;
- [ ] desktop flow lama tidak regresi.
