# 12-Routing.md

# Routing Strategy

## Status

Mandatory

## Purpose

Menetapkan arsitektur routing untuk Enterprise Dashboard CMS agar
scalable, modular, dan mudah dikembangkan.

------------------------------------------------------------------------

# Core Principles

-   Root router hanya menggabungkan route.
-   Setiap feature memiliki `routes.tsx`.
-   Layout dipilih melalui Layout Route.
-   Gunakan lazy loading untuk halaman.
-   Routing tidak berisi business logic.

------------------------------------------------------------------------

# Folder Structure

``` text
app/
└── router/
    ├── index.tsx
    ├── ProtectedRoute.tsx
    └── PublicRoute.tsx

features/
├── dashboard/routes.tsx
├── users/routes.tsx
├── products/routes.tsx
├── customers/routes.tsx
└── purchase-orders/routes.tsx
```

------------------------------------------------------------------------

# Ownership

Root Router bertugas:

-   membuat createBrowserRouter
-   menggabungkan seluruh feature route
-   memasang layout
-   memasang protected/public route

Feature Route bertugas:

-   mendefinisikan halaman milik feature
-   nested route feature
-   metadata route

------------------------------------------------------------------------

# Route Flow

``` text
Browser
   │
Root Router
   │
Protected Route
   │
Dashboard Layout
   │
Feature Route
   │
Page
```

------------------------------------------------------------------------

# Route Hierarchy

``` text
/
├── dashboard
├── users
│   ├── /
│   ├── create
│   ├── :userId
│   └── :userId/edit
├── products
└── settings
```

------------------------------------------------------------------------

# Route Metadata

Setiap route dapat memiliki metadata:

-   title
-   breadcrumb
-   permission
-   icon
-   layout

Metadata tidak boleh berisi business logic.

------------------------------------------------------------------------

# Lazy Loading

Gunakan lazy loading untuk page.

Jangan lazy load komponen kecil yang sering dipakai.

------------------------------------------------------------------------

# Protected Route

Tanggung jawab:

-   autentikasi
-   otorisasi
-   redirect

Tidak boleh:

-   fetch data feature
-   validasi form

------------------------------------------------------------------------

# Decision Tree

``` text
Need new page?
      │
      ▼
Belongs to feature?
      │
 Yes  │  No
      ▼
Feature routes.tsx
      │
Need authentication?
      │
 Yes ▼
Protected Route
```

------------------------------------------------------------------------

# Anti Patterns

❌ Semua route dalam satu file.

❌ Route mengetahui detail business logic.

❌ Feature mengubah root router.

❌ Page tanpa lazy loading ketika memang besar.

------------------------------------------------------------------------

# Code Review Checklist

-   [ ] Route berada di feature?
-   [ ] Root router hanya composition?
-   [ ] Layout route benar?
-   [ ] Lazy loading dievaluasi?
-   [ ] Metadata dipisahkan?
-   [ ] Tidak ada business logic?

------------------------------------------------------------------------

# AI Checklist

Sebelum membuat route:

-   Tentukan ownership.
-   Tentukan layout.
-   Tentukan protection.
-   Tentukan nesting.
-   Tentukan metadata.

------------------------------------------------------------------------

# Next

13-API-Layer.md
