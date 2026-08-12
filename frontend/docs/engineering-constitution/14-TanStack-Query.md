# 14-TanStack-Query.md

# TanStack Query Rules

## Status

Mandatory

## Purpose

Menetapkan standar penggunaan TanStack Query sebagai satu-satunya
pengelola server state pada aplikasi.

------------------------------------------------------------------------

# Core Principles

-   Server state bukan local state.
-   Query untuk membaca data.
-   Mutation untuk mengubah data.
-   Semua request melalui Service Layer.
-   Jangan fetch manual di component jika dapat menggunakan TanStack
    Query.

------------------------------------------------------------------------

# Architecture

``` text
Page
  │
  ▼
Query / Mutation
  │
  ▼
Service
  │
  ▼
HTTP Client
  │
  ▼
Backend
```

------------------------------------------------------------------------

# Folder Structure

``` text
features/users
├── queries
│   ├── useUsersQuery.ts
│   └── useUserDetailQuery.ts
├── mutations
│   ├── useCreateUserMutation.ts
│   ├── useUpdateUserMutation.ts
│   └── useDeleteUserMutation.ts
└── services
```

------------------------------------------------------------------------

# Query Key Convention

``` text
QUERY_KEYS
├── USERS
├── USER_DETAIL
├── PRODUCTS
└── DASHBOARD
```

Gunakan struktur yang konsisten agar invalidation mudah dipahami.

------------------------------------------------------------------------

# Responsibilities

## Query

-   Fetch data
-   Cache
-   Refetch

## Mutation

-   Create
-   Update
-   Delete
-   Invalidate query yang relevan

------------------------------------------------------------------------

# Rules

-   Pisahkan query dan mutation.
-   Jangan mencampur HTTP di hook.
-   Gunakan `select` bila perlu membentuk data untuk UI.
-   Hindari duplikasi query dengan key yang berbeda tetapi data sama.

------------------------------------------------------------------------

# Pagination

Gunakan query key yang menyertakan parameter.

``` text
["users", { page, pageSize, search }]
```

------------------------------------------------------------------------

# Anti Patterns

❌ fetch() di component

❌ axios di page

❌ Query dan mutation dalam satu file

❌ Query key tidak konsisten

❌ Menyimpan server state ke local state tanpa alasan

------------------------------------------------------------------------

# Performance

-   Manfaatkan cache.
-   Gunakan invalidation yang spesifik.
-   Hindari refetch yang tidak diperlukan.
-   Evaluasi prefetch untuk navigasi yang sering.

------------------------------------------------------------------------

# Memory Safety

TanStack Query mengelola lifecycle request, namun komponen tetap harus
menghindari efek manual yang menyebabkan update setelah unmount.

------------------------------------------------------------------------

# Decision Tree

``` text
Need data?
    │
    ▼
Server data?
 │          │
Yes         No
 │           │
 ▼           ▼
TanStack   Local State
Query
```

------------------------------------------------------------------------

# Code Review Checklist

-   [ ] Query & Mutation dipisahkan?
-   [ ] Service digunakan?
-   [ ] Query key konsisten?
-   [ ] Invalidation tepat?
-   [ ] Tidak ada fetch manual?

------------------------------------------------------------------------

# AI Checklist

-   Tentukan query key.
-   Tentukan service.
-   Buat query.
-   Buat mutation bila diperlukan.
-   Hubungkan ke page.

------------------------------------------------------------------------

# Next

15-React-Hook-Form.md
