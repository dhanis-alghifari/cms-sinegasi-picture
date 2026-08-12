# Playbook 06 - Filter

# Enterprise Filter Playbook

## Purpose

Standar implementasi filtering data pada CMS enterprise agar konsisten,
mudah dipahami, dan terintegrasi dengan query.

------------------------------------------------------------------------

# Workflow

``` text
Requirement
↓
Filter Model
↓
UI
↓
Query Parameters
↓
TanStack Query
↓
Result
```

------------------------------------------------------------------------

# Filter Types

-   Search
-   Select
-   Multi Select
-   Date Range
-   Status
-   Numeric Range
-   Advanced Filter

------------------------------------------------------------------------

# Folder Structure

``` text
features/users
├── components
│   ├── UserFilters.tsx
│   ├── UserSearch.tsx
│   └── UserFilterDrawer.tsx
├── hooks
│   └── useUserFilters.ts
├── queries
└── compositions
```

------------------------------------------------------------------------

# State Ownership

Filter UI → Local State

Applied Filter → Query Params

Server Data → TanStack Query

------------------------------------------------------------------------

# Query Key

``` text
["users", {
  page,
  pageSize,
  search,
  filters,
  sort
}]
```

Filter yang berubah harus menghasilkan query key baru.

------------------------------------------------------------------------

# UX Rules

-   Reset page ke 1 saat filter berubah.
-   Tampilkan jumlah filter aktif.
-   Sediakan tombol Reset.
-   Pertahankan filter saat kembali ke halaman bila memang menjadi
    kebutuhan produk.
-   Mobile menampilkan search full-width dan tombol Filter minimum 48px.
-   Filter lanjutan berada pada bottom sheet dengan header, satu scroll body,
    dan sticky footer.
-   Field filter mobile `w-full min-w-0` dan tinggi 48px.
-   Filter aktif ditampilkan sebagai chips yang wrap dan dapat dihapus.
-   Filter ditempatkan dalam tab/panel yang dipengaruhinya agar scope jelas.
-   `Terapkan` mengubah applied state/query key; draft sheet tetap lokal.

------------------------------------------------------------------------

# Performance

-   Debounce search.
-   Hindari refetch untuk setiap ketikan tanpa debounce.
-   Hindari filter client-side untuk dataset besar.

------------------------------------------------------------------------

# Memory Safety

Jika menggunakan timer untuk debounce atau listener lain, cleanup wajib
tersedia.

------------------------------------------------------------------------

# Accessibility

-   Label jelas.
-   Keyboard friendly.
-   Focus kembali dengan benar setelah dialog/filter drawer ditutup.
-   Tombol, chips, close, Reset, dan Terapkan memenuhi target 44/48px.

------------------------------------------------------------------------

# Anti Patterns

-   Filter tersebar di banyak tempat.
-   Query key tidak menyertakan filter.
-   Filter client-side untuk data yang seharusnya difilter server.
-   Seluruh field filter dijejalkan berjajar pada layar ponsel.
-   Chips menggunakan scroll horizontal kedua tanpa kebutuhan.
-   Sheet root dan body sama-sama `overflow-y-auto`.

------------------------------------------------------------------------

# Checklist

-   [ ] Query key lengkap
-   [ ] Debounce diterapkan bila perlu
-   [ ] Reset tersedia
-   [ ] Page reset saat filter berubah
-   [ ] Cleanup diperiksa
-   [ ] Accessibility diperiksa
-   [ ] Search/field full-width dan target sentuh memenuhi 44/48px
-   [ ] Sheet hanya memiliki satu scroll body dan footer aman dari keyboard
-   [ ] Scope filter sesuai tab/panel dan chips aktif terlihat

------------------------------------------------------------------------

# Next

Playbook 07 - Dialog
