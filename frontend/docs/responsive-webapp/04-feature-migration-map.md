# 04 — Peta Migrasi Seluruh Fitur

## Cara Membaca

Peta ini menjelaskan outcome mobile, presentasi adaptif, pemecahan code ownership, kebutuhan API, dan risiko setiap fitur. Urutan implementasi final mengikuti [roadmap](./07-implementation-roadmap.md), bukan urutan alfabet.

Setiap feature harus melalui pola yang sama:

```text
Baseline flow
→ Contract tests
→ Page/composition split
→ Mobile presentation adapter
→ Detail/action flow
→ API projection/performance bila terukur perlu
→ Responsive + security + regression tests
→ Feature rollout
```

`Mobile presentation adapter` mencakup seluruh data surface di dalam feature:
page, tab, report, widget, dialog, sheet, dan nested detail. Daftar komponen utama
saja tidak cukup; seluruh penggunaan `Table`/collection harus diinventarisasi.

## Ringkasan

| Fitur | Mobile collection | Detail | Risiko | Backend potensial |
|---|---|---|---|---|
| Dashboard | KPI cards + task list | drill-down route | sedang | role projection |
| Siswa | cards | detail sheet/route | sedang | option search, pagination |
| Kelas | compact cards | member list | rendah–sedang | aggregate count |
| Pengguna | cards | edit sheet | tinggi | permission/security |
| Absensi | date/status list | daily workspace | tinggi | bulk/idempotency |
| Nilai | assignment-first list | matrix workspace | tinggi | option search/bulk |
| Kas | segmented cards/report | detail/receipt | kritis | ledger/report projection |
| Peralatan | image cards | detail/action sheet | tinggi | compact search |
| Peminjaman | timeline/status cards | lifecycle detail | kritis | authorization/concurrency |
| Lomba | event cards | team/detail route | sedang–tinggi | relation projection |
| Notifikasi | grouped list | linked destination | rendah | cursor/read state |
| Audit | event cards | structured diff | tinggi | indexed filters/redaction |
| Auth/Password | focused form | account security | kritis | secure session/rate limit |

## 1. Application Shell dan Dashboard

### Outcome

Setelah login, pengguna langsung melihat tugas dan indikator yang sesuai role, bukan semua modul.

### Target UI

- desktop: sidebar + grid KPI + recent tasks;
- tablet: two-column KPI + list;
- mobile: 2-column compact KPI, role quick actions, alert penting, recent tasks;
- bottom navigation role-aware;
- title dan account context konsisten.

### Code change

- pecah `DashboardLayout` menjadi shell, desktop sidebar, mobile top bar, mobile bottom nav, dan More sheet;
- pusatkan navigation config dan label/permission;
- ganti `h-screen` dengan dynamic viewport dan safe area;
- buat dashboard composition per role/projection, tanpa duplikasi page.

### Acceptance

- tidak ada menu yang tidak diizinkan;
- tujuan utama role maksimal satu tap dari dashboard;
- mobile keyboard/screen reader dapat mengakses seluruh navigation;
- redirect login/password tidak menghasilkan route kosong atau loop.

## 2. Siswa — Vertical Slice CRUD Pertama

### Mobile summary

- nama;
- NIS;
- kelas;
- status aktif/alumni;
- status akun;
- detail/action overflow.

### Target flow

```text
Daftar siswa → search/filter kelas/status → card → detail
→ edit / ubah status / lihat audit
→ hasil tersimpan → kembali ke posisi daftar semula
```

### Code change

- `StudentsPage` menjadi route boundary tipis;
- composition memiliki filter, pagination, selected record, dan actions;
- `StudentTable` hanya adapter desktop;
- tambah mobile list/card dan detail sheet;
- pecah `StudentFormDialog` menjadi schema/controller, fields, upload, dan account result;
- gunakan server-search combobox untuk relasi besar.

### Backend/data

- pertahankan provisioning akun atomik;
- projection list tidak mengirim field sensitif;
- endpoint option hanya mengirim `id`, nama, NIS, kelas;
- permission edit/delete/status diperiksa backend;
- hard delete hanya bila domain invariant dan retention policy mengizinkan.

### Acceptance

- akun tidak tergandakan ketika request retry;
- NIS/username conflict memberi pesan domain;
- card dan table memiliki action parity;
- detail audit dapat dibuka tanpa kehilangan filter.

## 3. Kelas

### Mobile summary

- nama kelas;
- status;
- jumlah siswa aktif;
- wali/pengurus bila tersedia.

### Code change

- pecah `ClassesPage` menjadi page/composition/desktop/mobile;
- lazy-load route;
- member list dibuka melalui detail route/sheet;
- hindari memuat seluruh member pada list kelas.

### Backend/data

- gunakan aggregate count/projection bila query existing belum menyediakannya;
- jangan N+1 mengambil siswa per kelas;
- index hanya ditambah setelah query plan menunjukkan kebutuhan.

## 4. Pengguna dan Akses

### Mobile summary

- nama;
- username;
- role terformat;
- aktif/nonaktif;
- keterkaitan siswa.

### Target flow

- halaman fokus pada kelola akun, bukan membuat duplikasi siswa;
- role dan active status hanya dapat diubah role berwenang;
- reset password merupakan action eksplisit dengan alasan dan konfirmasi;
- destructive action menjelaskan dampak pada login dan data terkait.

### Code change

- `UsersPage` menjadi composition + adapters;
- add-user manual hanya ditampilkan jika use case non-siswa memang disetujui;
- form user tidak menerima role yang tidak diizinkan aktor;
- permission mapping bukan sekadar hierarchy UI.

### Security

- uji self-demotion, last-teacher protection, disabled user, IDOR, dan mass assignment;
- backend mengabaikan/menolak field yang tidak diizinkan;
- password hash tidak pernah berada di response/log/audit snapshot.

## 5. Absensi

### Mobile presentation

- default ke tanggal aktif;
- siswa dikelompokkan status atau kelas;
- quick mark dengan target besar;
- filter status dan search melalui sheet/chips;
- summary hadir/sakit/izin/alpha terlihat sebelum list.

### Desktop/tablet

- table tetap tepat untuk scan kelas;
- sticky identifier bila matrix digunakan;
- bulk action memiliki review sebelum commit.

### Backend/data

- satu attendance per siswa/tanggal;
- bulk mutation atomik atau mengembalikan result per item secara eksplisit;
- idempotency dan audit reason wajib;
- future date dan inactive student divalidasi server.

## 6. Nilai dan Assignment

### Mobile strategy

Jangan memaksa grade matrix penuh menjadi cards. Gunakan assignment-first:

```text
Daftar assignment → pilih assignment → ringkasan progress
→ daftar siswa + nilai → edit satu/bulk melalui workspace khusus
```

### Desktop strategy

- grade matrix tetap tersedia;
- sticky student column;
- horizontal scroll dengan affordance;
- bulk grading workspace dipisahkan dari list assignment.

### Code change

- pecah `GradesPage`, `AssignmentList`, dan `BulkGradingModal` menjadi workspace terpisah;
- assignment option menggunakan server search, bukan 1000 item;
- chart/import/export di-lazy-load.

### Negative cases

- duplicate grade;
- inactive student;
- assignment closed/deleted;
- partial bulk failure;
- unauthorized grader;
- stale edit/concurrent update.

## 7. Uang Kas

Fitur ini menjadi vertical slice high-risk kedua dan dijabarkan penuh pada [dokumen khusus](./05-cash-vertical-slice.md).

Mobile membagi halaman menjadi:

- Ringkasan;
- Transaksi;
- Piutang;
- Laporan.

Ledger, piutang, payment method, audit, dan export tidak boleh dihitung hanya di frontend.

Subtab Laporan wajib memiliki adapter tersendiri:

- siswa menunggak: card/list pada mobile, table pada desktop;
- rincian pemasukan: grouped transaction cards pada mobile, table pada desktop;
- rincian pengeluaran: grouped transaction cards pada mobile, table pada desktop;
- aktivitas harian: stacked visualization pada layar dan table khusus print;
- horizontal scroll tidak boleh menjadi fallback untuk rincian transaksi biasa.

## 8. Peralatan

### Mobile card

- thumbnail;
- nama alat;
- kode;
- kondisi;
- status ketersediaan;
- action detail/edit/borrow sesuai permission.

### Detail

- image gallery;
- kondisi dan status;
- riwayat borrowing/audit;
- primary action kontekstual.

### Code change

- `EquipmentPage` menjadi composition + adapters;
- pecah `EquipmentFormDialog` menjadi general info dan image manager;
- validasi upload/protocol dan lazy-load image;
- option endpoint untuk borrowing mengirim compact projection.

### Negative cases

- kode duplikat;
- alat sedang dipinjam diedit menjadi tersedia secara ilegal;
- upload gagal sebagian;
- file invalid/terlalu besar;
- concurrent handover/booking.

## 9. Peminjaman

### Mobile card

- nama peminjam;
- jumlah/nama alat ringkas;
- status lifecycle;
- tanggal pinjam dan jatuh tempo;
- overdue indicator;
- action sesuai status dan permission.

### Detail

Gunakan timeline:

```text
Diajukan → Disetujui/Ditolak → Diserahkan → Dikembalikan
```

Setiap tahap menampilkan aktor, waktu, catatan, kondisi alat, denda, dan audit link bila diizinkan.

### Code change

- pecah `BorrowingPage`, filters, collection, lifecycle detail, dan dialogs;
- `CreateBorrowingModal` menjadi full-screen mobile jika equipment selection panjang;
- dialog approve/reject dan handover menggunakan component UI, bukan native confirm;
- server-search siswa/alat;
- satu mutation handler per lifecycle transition.

### Backend/data

- operasi atomik dan unique active equipment dipertahankan;
- endpoint guard berdasarkan capability;
- status transition divalidasi server;
- notification failure tidak boleh membuat lifecycle ambigu;
- error constraint dipetakan menjadi pesan domain.

## 10. Lomba

### Mobile card

- judul;
- tanggal/periode;
- status;
- jumlah anggota/film;
- deadline penting.

### Detail

- overview;
- anggota;
- karya/film;
- assignment dan status;
- audit.

### Code/backend

- pecah `ContestsPage` per composition;
- hindari N+1 anggota/film;
- projection list dan detail dipisah;
- edit nested relation memakai transaksi yang jelas dan audit operation ID.

## 11. Notifikasi

### Mobile presentation

- grouped “Hari ini”, “Sebelumnya”;
- unread indicator tekstual dan visual;
- tap membuka `metadata.link_url` yang sudah divalidasi sebagai internal path;
- mark read optimistis dengan rollback;
- mark all read meminta action yang jelas, bukan native alert.

### Backend/data

- pagination/cursor;
- filter unread;
- unique event key tetap menjamin deduplikasi;
- pengguna hanya membaca notifikasi miliknya;
- metadata tidak boleh menjadi open redirect.

## 12. Audit Trail

### Mobile card

- waktu;
- nama/role aktor;
- aksi yang sudah dimasking;
- modul/entitas yang sudah dimasking;
- alasan perubahan ringkas.

### Detail

- before/after diff terstruktur;
- changed fields;
- request/operation ID;
- record ID dan raw entity hanya untuk role berwenang;
- nilai rahasia tetap ter-redact.

### Backend/data

- cursor atau indexed pagination pada `(created_at, id)`;
- filter actor/table/record/date;
- projection list tidak mengirim old/new JSON besar;
- detail endpoint mengambil snapshot hanya saat dibuka;
- log immutable dan service-role-only write.

## 13. Auth dan Ganti Password

### Flow

```text
Login berhasil
→ jika first login: route ganti password yang benar-benar tersedia
→ ganti password atomik
→ session lama direvoke/auth_version berubah
→ login kembali atau session baru sesuai policy
→ masuk dashboard role
```

Pengguna biasa juga dapat membuka “Keamanan akun” dari account menu tanpa dipaksa keluar dari pekerjaan lain sampai submit sukses.

### Security

- secure cookie target;
- rate limit login/change/reset;
- generic auth error;
- current password diverifikasi;
- password policy dan confirmation;
- audit tanpa password;
- no redirect loop;
- return URL hanya internal path.

## Parity Checklist per Fitur

Sebelum feature dinyatakan selesai:

- [ ] semua field keputusan dari table tersedia pada card atau detail;
- [ ] seluruh table/list pada page, tab, report, dialog, dan sheet telah diinventarisasi;
- [ ] setiap data surface diklasifikasikan adaptive, matrix exception, print-only, atau key-value detail;
- [ ] semua action berizin tersedia pada mobile;
- [ ] semua action terlarang ditolak backend;
- [ ] loading, empty, no-results, error, dan retry tersedia;
- [ ] filter/page/scroll bertahan setelah detail/mutation;
- [ ] labels tidak menampilkan enum/database code mentah;
- [ ] touch target, keyboard, focus, dan screen reader diperiksa;
- [ ] payload/query count dibandingkan baseline;
- [ ] negative/edge cases ditest;
- [ ] desktop tidak mengalami regresi.
