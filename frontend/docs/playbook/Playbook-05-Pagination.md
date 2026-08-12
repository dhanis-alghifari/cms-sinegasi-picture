# Playbook 05 - Pagination

# Enterprise Pagination Playbook

## Purpose

Standar implementasi pagination untuk dataset besar agar konsisten dan
efisien.

------------------------------------------------------------------------

# Workflow

``` text
Requirement
↓
API Contract
↓
Query Key
↓
Pagination State
↓
Table
↓
Review
```

------------------------------------------------------------------------

# Strategy

Pilih salah satu:

-   Server-side Pagination (default)
-   Client-side Pagination (dataset kecil)
-   Infinite Query (timeline/feed)

------------------------------------------------------------------------

# Folder Structure

``` text
features/users
├── hooks
│   └── useUserPagination.ts
├── queries
│   └── useUsersQuery.ts
├── components
│   ├── UserPagination.tsx
│   └── UserTable.tsx
└── compositions
    └── UserTableSection.tsx
```

------------------------------------------------------------------------

# Query Key

``` text
["users", {
  page,
  pageSize,
  search,
  sort,
  filters
}]
```

Seluruh parameter yang memengaruhi hasil harus menjadi bagian dari query
key.

------------------------------------------------------------------------

# State Ownership

Server data → TanStack Query

Current page → Local UI State

Filter → Local UI State atau URL

Total items → Response API

------------------------------------------------------------------------

# API Contract

Respons ideal:

``` json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 200,
    "totalPages": 10
  }
}
```

------------------------------------------------------------------------

# UX Rules

-   Pertahankan page saat refetch bila masih valid.
-   Reset ke halaman pertama saat filter atau search berubah.
-   Tampilkan total item bila tersedia.

------------------------------------------------------------------------

# Performance

-   Hindari memuat seluruh dataset.
-   Prefetch halaman berikutnya bila memberi manfaat.
-   Jangan invalidate seluruh cache tanpa alasan.

------------------------------------------------------------------------

# Memory Safety

Jika menggunakan IntersectionObserver untuk infinite scroll atau
listener lain, cleanup wajib tersedia.

------------------------------------------------------------------------

# Anti Patterns

-   Mengambil semua data lalu dipotong di client untuk dataset besar.
-   Query key tidak menyertakan page.
-   Menyimpan salinan server state ke local state.

------------------------------------------------------------------------

# Checklist

-   [ ] Server-side dipilih bila sesuai
-   [ ] Query key lengkap
-   [ ] Reset page saat filter berubah
-   [ ] Total item ditampilkan
-   [ ] Empty / Error state tersedia
-   [ ] Cleanup diperiksa

------------------------------------------------------------------------

# Next

Playbook 06 - Filter
