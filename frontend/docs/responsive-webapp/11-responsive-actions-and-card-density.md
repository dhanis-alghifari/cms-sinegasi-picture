# Responsive Actions dan Card Density

## Status

Fondasi implementasi diterapkan pada `ResponsivePageActions` dan dashboard.
Business logic, permission, query, mutation, dan API contract tetap dimiliki
oleh masing-masing feature.

## Kontrak Aksi

### Desktop

- Aksi utama berada di sisi kanan `PageHeader`.
- Aksi ditampilkan sebagai tombol biasa dengan label dan ikon.
- Aksi sekunder tetap terlihat jika jumlahnya maksimal tiga.

### Mobile

- Satu aksi utama memakai standard icon-only FAB di atas bottom navigation dan
  safe-area. Label tetap tersedia melalui `aria-label` dan `title`, tetapi tidak
  mengambil ruang horizontal dari konten.
- Beberapa aksi setara memakai satu FAB ikon `Plus` yang membuka bottom sheet.
  Label dan ikon setiap aksi tetap ditampilkan di dalam sheet.
- Aksi utilitas seperti refresh atau tandai semua dibaca tetap berada di header
  atau overflow; tidak dipromosikan menjadi FAB.
- Aksi destruktif tetap berada di konteks record/detail dan membutuhkan dialog
  konfirmasi.
- Permission menentukan daftar aksi sebelum komponen presentasi dirender.

```text
Page / feature
  ├── menentukan permission dan handler
  ├── menyusun ResponsivePageAction[]
  └── ResponsivePageActions
        ├── desktop: action group di PageHeader
        └── mobile: icon-only FAB atau bottom sheet
```

`ResponsivePageActions` tidak boleh memanggil API, membaca server state, atau
menentukan role. Komponen ini hanya mengatur presentasi, focus, hit-area,
safe-area, dan lifecycle bottom sheet.

## Breakpoint dan Reachability

- `md` (768px) menjadi batas utama antara mobile action adapter dan desktop
  header action.
- Hit-area mobile FAB utama berukuran 60px dengan `rounded-xl`; kontrol lain
  minimal 48px. Bentuk kotak membulat memberi area tekan lebih luas tanpa
  menutupi konten seperti FAB berlabel panjang.
- FAB memakai `bottom: calc(bottom-navigation-height + safe-area)`.
- Page shell mobile memakai bottom padding gabungan untuk bottom navigation,
  FAB, dan gap visual agar item terakhir tidak tertutup.
- Bottom sheet memiliki satu pemilik scroll vertikal dan tidak membuat scroll
  horizontal tambahan.

## Klasifikasi Halaman

| Kondisi | Pattern |
|---|---|
| Satu aksi create yang sering dipakai | Standard icon-only FAB |
| Dua atau tiga aksi feature yang setara | FAB + bottom sheet |
| Aksi utilitas | Header atau overflow |
| Aksi per row/card | Detail card atau menu record |
| Aksi destruktif | Menu record + confirmation dialog |

## Card Density

### Dashboard

- Maksimal tiga rich card pada baris desktop pertama.
- Tablet memakai dua kolom.
- Mobile memakai satu rich card per baris.
- Widget distribusi, chart, atau rincian A–E mengambil full-width pada desktop
  setelah ringkasan utama.

### Rich Card versus KPI Tile

Rich card berisi beberapa metrik, status, atau daftar sehingga tidak boleh
dipadatkan ke kolom sempit. KPI tile yang hanya berisi satu angka boleh memakai
grid lebih rapat jika label dan hit-area tetap terbaca.

### Distribusi A–E

Jangan menampilkan lima kotak kecil dalam satu baris. Gunakan daftar baris
dengan:

- label predikat;
- jumlah siswa;
- persentase;
- progress bar yang memiliki label aksesibel.

Nilai nol tetap ditampilkan sebagai `0`; jangan mengganti data kosong dengan
tanda yang membuat pengguna mengira datanya hilang.

## Checklist Implementasi Feature Baru

- [ ] Aksi utama sudah didefinisikan dan tidak lebih dari satu pada mobile.
- [ ] Permission dihitung di page/feature, bukan di shared component.
- [ ] Handler mutation memiliki loading/disabled state.
- [ ] FAB tidak menutupi bottom navigation, safe-area, keyboard, atau dialog.
- [ ] FAB mobile tidak memanjang selebar viewport dan tidak menampilkan label
      sebagai teks utama.
- [ ] Ikon FAB memiliki `aria-label`, `title`, focus ring, dan hit-area yang
      dapat digunakan dengan satu tangan.
- [ ] Aksi sekunder tidak dipaksa masuk ke tombol kecil.
- [ ] Rich card tidak lebih dari tiga kolom desktop dan satu kolom mobile.
- [ ] Tab, filter, dan list tetap mengikuti single-scroll-owner contract.
- [ ] Empty, error, loading, dan success feedback tetap tersedia.
- [ ] Verifikasi pada 320, 360, 390, 768, 1024, dan 1440px.
