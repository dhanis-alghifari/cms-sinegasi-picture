# Playbook 03 - Table

# Enterprise Adaptive Collection Playbook

## Purpose

Panduan implementasi collection enterprise yang scalable, konsisten,
responsif, dan mudah dipelihara. `Table` adalah salah satu presentation
adapter, bukan bentuk wajib untuk seluruh viewport.

------------------------------------------------------------------------

# Workflow

``` text
Requirement
↓
Inventory seluruh data surface
↓
Decision fields dan actions
↓
Pilih adapter mobile / tablet / desktop
↓
Query
↓
Filter
↓
Sorting
↓
Pagination
↓
Selection
↓
Actions
↓
Review
```

------------------------------------------------------------------------

# Folder Structure

``` text
features/users
├── compositions
│   └── UserCollectionSection.tsx
├── components
│   ├── UserTable.tsx
│   ├── UserMobileList.tsx
│   ├── UserMobileCard.tsx
│   ├── UserDetailSheet.tsx
│   ├── UserTableToolbar.tsx
│   ├── UserTableFilters.tsx
│   ├── UserTablePagination.tsx
│   └── UserRowActions.tsx
├── queries
├── hooks
└── services
```

------------------------------------------------------------------------

# Component Hierarchy

``` text
UserCollectionSection
├── Toolbar
├── Filters
├── Active presentation adapter
│   ├── Desktop Table
│   ├── Tablet Compact View
│   └── Mobile Card/List
├── Pagination
└── BulkActions
```

------------------------------------------------------------------------

# Responsibilities

## Composition

-   Menghubungkan query dengan widget.
-   Menyimpan UI state (misalnya filter lokal bila diperlukan).

## Table

-   Render data.
-   Tidak melakukan HTTP.
-   Digunakan ketika perbandingan kolom penting dan ruang mencukupi.

## Mobile List/Card

-   Render record dari query result dan handler yang sama dengan table.
-   Tampilkan maksimal empat nilai yang diperlukan untuk membuat keputusan.
-   Prioritaskan identity, primary value, status, dan context utama.
-   Buka detail sheet/route untuk field sekunder dan history.
-   Jangan menaruh lebih dari satu primary dan satu secondary action pada card.

## Detail

-   Menjamin seluruh field/action penting yang ada pada desktop tetap dapat
    ditemukan di mobile.
-   Sheet digunakan untuk inspeksi singkat; route/full-screen untuk tugas panjang.

## Toolbar

-   Search
-   Refresh
-   Export
-   Create Button

Pada mobile, search full-width dan advanced filter dibuka melalui tombol minimum
48px. Active filter chips melakukan wrap. Toolbar tidak boleh memaksa action
sekunder menjadi tombol kecil; pindahkan ke overflow/detail.

## Row Actions

-   Detail
-   Edit
-   Delete

------------------------------------------------------------------------

# Query Strategy

-   Server-side pagination untuk dataset besar.
-   Query key mencakup page, pageSize, search, sort, filter.

Contoh:

``` text
["users", { page, pageSize, search, sort, filters }]
```

Desktop, tablet, dan mobile wajib memakai query key, pagination, filter, mutation,
dan permission yang sama. Jangan melakukan fetch kedua hanya untuk mobile.

------------------------------------------------------------------------

# Adapter Decision

| Viewport/kebutuhan | Adapter default |
|---|---|
| `< 768px`, mencari satu record lalu bertindak | card/list satu kolom |
| `768–1023px`, data ringkas | compact table atau card grid dua kolom |
| `≥ 1024px`, membandingkan banyak kolom | semantic table |
| matrix/perbandingan intrinsik | table dengan sticky identifier dan scroll affordance |
| print/export | document/table terpisah dari presentation layar |

Breakpoint mengikuti kebutuhan konten. Lebar perangkat bukan alasan untuk
menyembunyikan field kritis tanpa detail alternatif.

------------------------------------------------------------------------

# Data Surface Inventory

Sebelum implementasi dan sebelum Definition of Done, cari seluruh collection di:

-   page utama;
-   setiap tab;
-   report dan dashboard widget;
-   dialog, sheet, drawer, dan nested detail;
-   empty/loading/error state;
-   print/export layout.

Setiap surface diklasifikasikan sebagai:

1. adaptive collection;
2. matrix dengan horizontal-scroll exception;
3. print/export only;
4. static key-value detail, bukan collection.

Container responsif tidak otomatis membuat tabel di dalamnya responsif.

------------------------------------------------------------------------

# States

Selalu sediakan:

-   Loading
-   Empty
-   Error
-   Success

------------------------------------------------------------------------

# Performance

-   Virtualisasi bila ribuan baris.
-   Hindari render ulang seluruh tabel.
-   Memoisasi hanya berdasarkan hasil profiling.

------------------------------------------------------------------------

# Memory Safety

Jika tabel menggunakan ResizeObserver, IntersectionObserver, shortcut
keyboard, atau listener lain, cleanup wajib disediakan.

------------------------------------------------------------------------

# Accessibility

-   Header tabel jelas.
-   Keyboard navigation.
-   Focus indicator.
-   Aksi dapat diakses tanpa mouse.
-   Mobile card memakai list/article/button/link semantic sesuai fungsi.
-   Seluruh card tidak boleh menjadi clickable `div` tanpa keyboard semantics.
-   Tabel print-only tidak masuk accessibility tree pada mode layar.
-   Seluruh action card/list dan pagination memiliki hit-area minimum 44px;
    primary action/coarse pointer minimum 48px.

------------------------------------------------------------------------

# Horizontal Scroll Exception

Horizontal scroll bukan fallback umum. Hanya gunakan jika perubahan menjadi card
menghilangkan makna perbandingan, misalnya grade matrix. Exception wajib memiliki:

-   alasan tertulis;
-   sticky identifier/first column bila relevan;
-   visual affordance bahwa konten dapat digeser;
-   touch dan keyboard access;
-   detail alternatif untuk membaca satu record;
-   test pada 320px, landscape, dan 200% zoom.

------------------------------------------------------------------------

# Anti Patterns

-   Fetch di dalam komponen tabel.
-   Query berulang untuk data yang sama.
-   Semua aksi ditaruh di Page.
-   Tidak ada empty state.
-   Membungkus table desktop dengan `overflow-x-auto` lalu menyebutnya mobile-ready.
-   Hanya mengadaptasi tabel utama tetapi melewatkan tabel di tab/report/dialog.
-   Merender table dan card interaktif bersamaan lalu menyembunyikan salah satunya.
-   Membuat query, mutation, atau permission khusus viewport.
-   Memadatkan tujuh kolom menjadi teks kecil pada layar ponsel.
-   Menaruh pagination/action `h-7` atau `h-8` pada mobile.
-   Menambah scroll horizontal untuk toolbar/chips di atas collection tanpa
    alasan dan affordance.

------------------------------------------------------------------------

# Checklist

-   [ ] Query terpisah
-   [ ] Pagination tersedia
-   [ ] Sorting konsisten
-   [ ] Filter dipisah
-   [ ] Row action jelas
-   [ ] Loading / Empty / Error tersedia
-   [ ] Cleanup diperiksa
-   [ ] Accessibility diperiksa
-   [ ] Seluruh data surface langsung dan bersarang sudah diinventarisasi
-   [ ] Adapter mobile/tablet/desktop dipilih dengan alasan
-   [ ] Mobile card menampilkan maksimal empat nilai keputusan dan akses detail
-   [ ] Field/action parity mobile-desktop diperiksa
-   [ ] Tidak ada horizontal scroll kecuali exception terdokumentasi
-   [ ] Hanya satu adapter interaktif aktif pada viewport
-   [ ] Query, mutation, filter, pagination, dan permission tidak digandakan
-   [ ] Toolbar mobile memiliki search full-width dan Filter yang mudah dijangkau
-   [ ] Action/pagination memenuhi target 44/48px dan gap aman

------------------------------------------------------------------------

# Next

Playbook 04 - Form
