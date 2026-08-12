# 10 — Mobile Reachability dan Control Specification

## Status dan Scope

Dokumen ini bersifat normatif untuk responsive web app Sinegasi CMS. Ia berlaku
untuk browser iOS dan Android, tablet sentuh, serta desktop. PWA, offline write,
dan native application tidak termasuk scope.

Audit yang mendasari dokumen ini adalah audit source code dan struktur
komponen. Audit visual pada rendered UI, perangkat nyata, VoiceOver, dan TalkBack
tetap menjadi release gate; dokumen ini bukan pengganti usability test.

### Implementation snapshot — 2026-08-10

Foundation yang sudah diterapkan:

- token interaksi mobile dan guard CSS untuk shared/raw button, input, select,
  menu item, dan tabs pada viewport di bawah 768px atau coarse pointer;
- `Input`, `SelectTrigger`, `Tabs`, `Dialog`, `Sheet`, dan
  `DashboardLayout` memakai kontrak tinggi, safe-area, dan viewport dinamis;
- tab Kas memakai label ringkas equal-width pada mobile;
- filter transaksi Kas hanya tampil pada panel Transaksi, bukan di luar seluruh
  tab;
- collection utama sudah memilih mobile list/card melalui `useIsMobile`.

Patch cash yang telah diterapkan pada vertical slice:

- action header desktop dipindahkan menjadi icon-only FAB dan bottom action sheet
  pada mobile; FAB memiliki hit-area minimal 56px dan tidak berada di bawah
  bottom navigation;
- filter report memakai compact summary + bottom sheet dengan draft state, field
  full-width, preset 7/30/90 hari, Reset, dan Terapkan;
- form FastCashIn memakai full-height mobile dialog, `overflow-x-hidden`, satu
  body `overflow-y-auto`, dan footer fixed-flow di luar body scroll;
- student picker memakai searchable combobox dengan debounce 300ms dan endpoint
  options berprojection minimal, bukan mengambil seluruh tabel siswa.

Yang masih menjadi release gate, bukan asumsi dari source code:

- pengukuran `getBoundingClientRect()` pada 320/360/390/412px;
- verifikasi satu pemilik scroll pada browser nyata, keyboard virtual,
  VoiceOver/TalkBack, landscape, dan 200% zoom;
- visual review untuk setiap dialog/sheet panjang dan raw control yang belum
  memiliki adapter khusus.

Implementasi di atas belum dianggap lulus sampai browser QA membuktikan bahwa
FAB, sheet, filter, combobox, keyboard, dan footer tetap reachable pada 320px,
390px, 412px, landscape, serta saat bottom navigation aktif.

## Outcome

Pada ponsel, pengguna harus dapat:

- menyelesaikan tugas utama dengan satu tangan tanpa mengejar tombol kecil;
- membaca dan mengganti tab tanpa scroll vertikal bersarang;
- mencari data terlebih dahulu, lalu membuka filter lanjutan tanpa memenuhi layar;
- mengisi form dengan field selebar container tanpa terpotong keyboard;
- menemukan action utama dekat area jempol dan di atas bottom navigation;
- menggulir halaman dalam satu arah dengan satu pemilik scroll vertikal;
- memakai semua kontrol melalui touch, keyboard, dan screen reader.

### Kontrak spacing dan breakpoint tab

Semua `TabsList` default memakai jarak antartarget minimal `gap-2` (8px).
Untuk 2–3 tab, implementasi feature wajib mengikuti pola berikut:

- di bawah `md`: `grid` dengan kolom sesuai jumlah tab, `gap-2`, padding `p-2`,
  trigger minimum 48px, dan label ringkas;
- mulai `md`: `flex` dengan label lengkap, `whitespace-nowrap`, trigger
  `flex-none`, serta lebar minimum yang cukup untuk label terpanjang;
- label panjang tidak boleh diaktifkan pada `sm` jika trigger masih 36–40px atau
  masih memakai `whitespace-normal`;
- teks tab tidak boleh dipaksa overlap atau terpotong; jika label tidak muat,
  ringkas labelnya atau ubah pola menjadi menu/select;
- tab list tidak menjadi pemilik scroll vertikal. Jika strip horizontal adalah
  pengecualian, gunakan `overflow-x-auto overflow-y-hidden` secara eksplisit.

Pola ini mencegah regresi pada tablet 640–767px, ketika layout masih sempit
tetapi class `sm:` sudah aktif.

## Dasar Standar dan Keputusan Proyek

Standar eksternal tidak memakai satu unit yang sama. Karena itu implementasi
harus mengikuti baseline proyek berikut, bukan mengambil angka terendah.

| Referensi | Batas/pedoman | Keputusan proyek |
|---|---:|---|
| WCAG 2.2 SC 2.5.8, level AA | 24×24 CSS px, dengan pengecualian | Hanya compliance floor, bukan target ergonomi |
| Apple Human Interface Guidelines | 44×44 pt hit region | Baseline minimum proyek 44×44 CSS px |
| Android accessibility | 48×48 dp touch target | Gunakan 48px untuk kontrol utama dan coarse pointer |
| web.dev tap targets | sekitar 48 independent px | Validasi target dan spacing pada mobile web |

Sumber resmi:

- [W3C WCAG 2.2 — Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)
- [Apple HIG — Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)
- [Apple HIG — Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [Android Developers — Make apps more accessible](https://developer.android.com/guide/topics/ui/accessibility/apps)
- [web.dev — Accessible tap targets](https://web.dev/articles/accessible-tap-targets)

## Control Geometry Contract

### Ukuran minimum

| Control | Mobile/coarse pointer | Desktop fine pointer | Catatan |
|---|---:|---:|---|
| primary button | 48px | 36–40px | full-width bila berdiri sendiri pada mobile |
| secondary/destructive button | minimum 44px | 32–36px | destructive tidak ditempatkan tanpa jarak dari primary |
| icon-only button | hit-area minimum 44px | minimum 32px | ikon visual tetap 20–24px |
| input/select/date/search | 48px | 36–40px | font input minimum 16px pada mobile |
| tab trigger | 48px | minimum 36px | label tidak dipaksa menjadi dua baris |
| pagination | minimum 44px | minimum 32px | Previous/Next lebih penting dari nomor rapat |
| checkbox/radio/switch row | seluruh row minimum 44px | minimum 32px | label menjadi bagian target |
| list/card action | minimum 44px | minimum 32px | maksimal dua action terlihat pada mobile |

Jarak antartarget berdekatan minimum 8px. Control visual boleh lebih kecil hanya
jika elemen interaktif pembungkus tetap memenuhi hit-area dan tidak overlap.

### Breakpoint bukan satu-satunya sinyal densitas

Jangan mengecilkan semua kontrol hanya karena viewport mencapai `sm:`. Tablet
dan layar lebar dapat tetap memakai touch. Densitas desktop boleh dipakai jika:

```css
@media (min-width: 768px) and (pointer: fine) {
  /* compact desktop control */
}
```

Tailwind breakpoint boleh mengatur layout. Ukuran hit-area harus tetap aman pada
`pointer: coarse`. Jika utility pointer belum tersedia, gunakan CSS global atau
variant yang teruji; jangan menyalin media query ke setiap feature.

### Token target

Implementasi foundation sebaiknya menyediakan token semantik, bukan angka acak:

```css
:root {
  --touch-target-min: 2.75rem;       /* 44px */
  --control-height-mobile: 3rem;     /* 48px */
  --control-height-desktop: 2.25rem; /* 36px */
  --touch-target-gap: 0.5rem;        /* 8px */
}
```

Nama token dapat mengikuti convention proyek. Nilai tidak boleh diturunkan oleh
feature melalui `h-7`, `h-8`, atau `h-9` pada mobile tanpa exception tertulis.

## Reachability dan Thumb Zones

```text
┌──────────────────────────────┐
│ Context / status / rare action│  sulit dijangkau satu tangan
├──────────────────────────────┤
│ Search / content / selection  │  area kerja
├──────────────────────────────┤
│ Frequent primary action       │  area jempol
├──────────────────────────────┤
│ Bottom navigation + safe area │  navigasi global
└──────────────────────────────┘
```

Aturan:

- top bar hanya memuat context, back, notifikasi, dan overflow ringan;
- action yang sering dipakai berada pada card/list atau sticky action bar bawah;
- sticky action bar berada di atas bottom navigation dan safe-area;
- konten mendapat bottom padding sebesar tinggi kedua layer tersebut;
- destructive action tidak menjadi tombol terbesar di area jempol tanpa
  konfirmasi dan pemisahan visual;
- action yang jarang dipakai masuk menu overflow atau detail.

## Tabs

Tabs adalah navigasi antar-view, bukan container scroll bebas.

### Decision tree

| Jumlah/kondisi tab | Pola mobile |
|---|---|
| 2–3 label pendek | segmented tabs, lebar sama, tanpa horizontal scroll |
| 4–5 label pendek | tab strip horizontal terkontrol bila benar-benar tidak muat |
| >5 atau label panjang | select/menu/route navigation, bukan tab yang dipadatkan |
| tahapan proses berurutan | stepper, bukan tabs |

Untuk Kas yang memiliki tiga view, gunakan label ringkas `Laporan`, `Transaksi`,
dan `Tunggakan` dengan tiga trigger lebar sama. Deskripsi panjang berada di
heading panel, bukan pada tab.

### Kontrak tab strip horizontal

Jika horizontal scroll memang diperlukan:

- `overflow-x: auto` dan `overflow-y: hidden`;
- tinggi container minimum 48px dan tidak memiliki scrollbar vertikal;
- `touch-action: pan-x` hanya pada strip, bukan seluruh halaman;
- tampilkan edge fade atau potongan tab berikutnya sebagai affordance;
- tab aktif di-scroll ke area terlihat tanpa memindahkan scroll halaman;
- page tetap menjadi pemilik scroll vertikal;
- semantic `tablist`, `tab`, `tabpanel`, focus order, dan arrow-key behavior
  mengikuti [WAI-ARIA Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/).

## Filter dan Search

### Mobile collection filter

Default mobile toolbar:

```text
┌──────────────────────────────┐
│ Search full width            │ 48px
├──────────────────────┬───────┤
│ Ringkasan filter     │Filter │ 48px
├──────────────────────┴───────┤
│ chips aktif: Status × Metode ×│
└──────────────────────────────┘
```

- search utama selalu full-width;
- filter lanjutan dibuka melalui bottom sheet;
- badge pada tombol menunjukkan jumlah filter aktif;
- chips aktif melakukan wrap; jangan membuat scroll horizontal kedua;
- `Reset` tersedia, tetapi `Terapkan` menjadi CTA utama;
- filter hanya muncul di panel yang dipengaruhinya.

Pada Kas, filter transaksi harus berada dalam panel `Transaksi`, filter report
dalam panel `Laporan`, dan filter tunggakan dalam panel `Tunggakan`. Menaruh
filter transaksi di atas seluruh tab membuat scope filter ambigu.

### Filter sheet

```text
Sheet root (bukan scroll owner)
├── sticky header: title + close
├── scroll body: field satu kolom
└── sticky footer: Reset + Terapkan + safe-area
```

Ketentuan:

- lebar mobile 100%; tinggi maksimum sekitar `85dvh`;
- hanya body yang `overflow-y-auto`;
- header dan footer tidak ikut membentuk nested scroll;
- semua field `w-full min-w-0` dan tinggi 48px;
- footer action minimum 48px dan tidak tertutup keyboard;
- closing mengembalikan focus ke tombol Filter;
- applied state masuk URL/query key, draft sheet tetap lokal hingga diterapkan.

### Date range/report filters

- default ringkasan dapat berbunyi `30 hari • Semua metode`;
- preset seperti 7/30/90 hari memakai target 44–48px;
- date input ditumpuk pada mobile dan full-width;
- validasi range muncul sebelum request;
- panel dapat collapse setelah filter diterapkan agar report kembali dominan.

## Forms

### Layout

- satu kolom pada mobile;
- setiap `input`, `select`, date picker, dan uploader memakai `w-full min-w-0`;
- gunakan `w-full sm:max-w-*`, bukan `max-w-*` tanpa mobile override;
- dua kolom hanya saat lebar konten mencukupi, bukan semata karena device tablet;
- label selalu terlihat; helper/error tidak mengubah lebar field;
- nominal memakai numeric keyboard dan tidak kehilangan format saat error.

### Keyboard dan submit

- font input minimum 16px agar browser iOS tidak melakukan zoom otomatis;
- field aktif harus dapat di-scroll ke atas keyboard virtual;
- form panjang memakai sticky footer atau full-screen route;
- submit/cancel tidak berada di dalam body scroll yang sangat panjang;
- pending mencegah double submit dan mempertahankan nilai form saat gagal;
- gunakan `100dvh` secara hati-hati karena tinggi dapat berubah saat browser chrome
  atau keyboard bergerak.

### Dialog action breakpoint

Dialog footer mengikuti breakpoint yang sama dengan form mobile, bukan breakpoint
`sm`:

- di bawah `md`, action ditumpuk vertikal, full-width, dan minimal 48px;
- mulai `md`, action boleh horizontal dengan minimal 36px dan lebar sesuai isi;
- urutan mobile mengikuti DOM: secondary/cancel lebih dulu, primary/submit
  terakhir dan berada paling dekat area jempol;
- jangan menambahkan `sm:w-auto`, `sm:h-8`, atau `sm:min-h-9` pada action footer
  karena rentang 640–767px masih diperlakukan sebagai layout mobile/tablet;
- upload, hapus, dan action sekunder di dalam form mengikuti kontrak yang sama
  jika dipakai dengan touch/coarse pointer.

Referensi viewport:

- [MDN — Viewport concepts](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/CSSOM_view/Viewport_concepts)
- [MDN — CSS length units, termasuk `dvh`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length)

## Scroll Ownership

Golden rule: satu layar memiliki satu pemilik scroll vertikal aktif.

| Surface | Pemilik scroll vertikal | Scroll horizontal |
|---|---|---|
| page biasa | `DashboardLayout` main | tidak ada |
| bottom/side sheet | sheet body | hanya collection exception |
| dialog form | dialog body | tidak ada |
| tab strip | page, bukan tab strip | strip boleh `x` saja |
| matrix | page | matrix container `x` terkontrol |
| card/list | page | tidak ada |

Larangan:

- `DialogContent overflow-y-auto` ditambah child `overflow-y-auto`;
- page scroll ditambah panel report dengan tinggi tetap dan vertical scroll;
- container tab menggunakan `overflow-auto` sehingga arah x dan y sama-sama aktif;
- sticky footer tanpa `scroll-padding-bottom`/content padding;
- wheel/touch gesture terperangkap di nested container.

Overlay boleh memiliki scroll sendiri karena menutup page, tetapi tetap hanya satu
body overlay yang scrollable.

## Safe Area dan Viewport

Gunakan fallback dan dynamic viewport pada shell:

```css
.app-shell {
  min-height: 100vh;
  min-height: 100dvh;
  padding-inline: max(1rem, env(safe-area-inset-left));
}

.mobile-action-bar {
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
}
```

Pertimbangkan inset top/right/left untuk landscape dan perangkat ber-notch, tidak
hanya bottom inset. Lihat [MDN — `env()`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/env).

## Component Ownership dan Refactor Strategy

Perbaiki deep seam lebih dahulu:

1. `components/ui/Button`, `Input`, `SelectTrigger`, `Tabs`, dan common
   `Pagination` memiliki size contract yang aman;
2. `Dialog`/`Sheet` memiliki header, satu scroll body, dan footer yang eksplisit;
3. feature menghapus override `h-7/h-8/h-9` pada control mobile;
4. komponen lintas feature baru dibuat setelah minimal dua consumer membuktikan
   bentuk yang sama.

Kontrak `DialogFooter` bersama:

- merupakan flex item `shrink-0` dan tidak memakai `-mb-*` atau transform;
- tombol langsung otomatis `w-full` dengan tinggi minimum 48px di mobile;
- pada desktop tombol boleh kembali `w-auto` dengan tinggi minimum 36px;
- safe-area ditambahkan sebagai padding, bukan dengan menggeser footer keluar
  dari clipping container;
- dialog form panjang memakai tinggi terukur (`dvh`) agar browser dapat
  menghitung ruang body dan footer secara deterministik.

Candidate shared composition setelah pola terbukti:

- `MobileFilterSheet`;
- `StickyMobileActionBar`;
- `ResponsiveTabs` atau variant Tabs yang mendukung equal/scrollable mode.

Filter model, wording, validation, dan field tetap feature-owned. Jangan membuat
generic schema-driven UI framework hanya untuk mengurangi beberapa baris JSX.

## Cash Remediation Map

| Lokasi | Temuan | Target |
|---|---|---|
| `components/ui/input.tsx` | default 32px | 48px mobile, dense hanya fine pointer |
| `components/ui/select.tsx` | 32px dan `w-fit` | 48px, default `w-full min-w-0` dalam form |
| `components/ui/tabs.tsx` | list/trigger sekitar 32px | min 48px mobile, overflow-y hidden |
| `components/common/Pagination.tsx` | button 32px | minimum 44px mobile |
| `CashPage.tsx` | tiga tab memakai scroll strip dan tinggi 40px | equal-width 48px, label ringkas |
| `CashPage.tsx` | filter transaksi berada sebelum tab | pindah ke panel Transaksi |
| `CashReportPanel.tsx` | preset/export 32px; field 36px | 44–48px, report filter collapsible/full-width |
| `FastCashInModal.tsx` | beberapa field/action 36px | 48px, single scroll body, sticky footer |
| cash modals lain | override 36px | audit dan gunakan primitive/variant aman |
| shared dialog + feature child | potensi nested vertical scroll | satu explicit dialog body scroll owner |

## Guardrail Statis

Tambahkan pemeriksaan bertahap pada fase implementation:

- tandai raw `h-7`, `h-8`, `h-9`, `size-7`, `size-8`, `size-9` pada elemen
  interaktif sebagai candidate violation;
- allowlist hanya untuk desktop-only fine-pointer control atau elemen dekoratif;
- jangan menilai ikon dari ukuran visual saja; ukur parent hit-area;
- E2E memakai `getBoundingClientRect()` untuk memastikan target terlihat minimum
  44×44 pada viewport mobile;
- test gagal jika tab strip memiliki `scrollHeight > clientHeight`;
- test gagal jika field form utama memiliki clipping atau lebar melebihi container.
- test gagal jika tombol footer tidak sepenuhnya berada di dalam bounding box
  dialog atau tidak dapat dicapai setelah body digulir sampai akhir.

## QA Matrix Khusus Reachability

### Viewport minimum

- 320×568;
- 360×800;
- 390×844;
- 412×915;
- 768×1024;
- landscape phone;
- browser zoom/text scale sampai 200%.

### Skenario

1. Selesaikan transaksi Kas dengan satu tangan kanan lalu kiri.
2. Pindah seluruh tab tanpa menyebabkan page meloncat atau vertical scrollbar
   kedua muncul.
3. Buka filter, ubah seluruh field, buka keyboard, Terapkan, lalu buka kembali.
4. Pastikan semua filter/date/select full-width pada 320px dan teks panjang.
5. Scroll form panjang; header/footer tetap stabil dan submit tidak tertutup.
6. Putar orientation ketika sheet/form terbuka tanpa kehilangan state.
7. Uji VoiceOver/TalkBack dan keyboard pada tabs, filter, field, dan action.
8. Ukur target sentuh rendered UI; screenshot saja tidak cukup.

### Acceptance criteria

- tidak ada interactive target mobile di bawah 44×44px;
- primary control dan coarse-pointer control utama mencapai 48px;
- tidak ada target berdekatan dengan gap di bawah 8px tanpa grouping aman;
- tidak ada tab/filter/dialog yang membuat scroll vertikal kedua;
- setiap form field utama memenuhi lebar container dan tetap terlihat saat keyboard
  terbuka;
- sticky action tidak menutup data terakhir, pagination, atau bottom navigation;
- semua penyimpangan memiliki alasan, owner, test, dan batas waktu perbaikan.

## Urutan Implementasi

1. Baseline screenshot, target measurement, dan scroll trace.
2. Perbaiki shared primitive dan test kontraknya.
3. Terapkan pada Cash sebagai vertical slice.
4. Validasi rendered UI pada browser/perangkat nyata.
5. Migrasikan feature lain berdasarkan inventory, bukan search-and-replace buta.
6. Aktifkan static/E2E guardrail setelah false positive ditangani.
