# 17-Feature-Development.md

# Feature Development Lifecycle

## Status

Mandatory

## Purpose

Menetapkan urutan pengembangan setiap feature agar konsisten dari
analisis hingga siap diproduksi.

------------------------------------------------------------------------

# Golden Rule

Jangan mulai dari component.

Mulailah dari kebutuhan bisnis.

------------------------------------------------------------------------

# Development Flow

``` text
Requirement
    ↓
Business Analysis
    ↓
Folder Design
    ↓
Route Design
    ↓
Data Model
    ↓
API Service
    ↓
TanStack Query
    ↓
Form & Validation
    ↓
Composition
    ↓
UI Components
    ↓
Testing
    ↓
Code Review
```

------------------------------------------------------------------------

# Feature Skeleton

``` text
features/
└── users
    ├── pages
    ├── compositions
    ├── components
    ├── hooks
    ├── queries
    ├── mutations
    ├── services
    ├── schemas
    ├── constants
    ├── utils
    ├── types
    ├── routes.tsx
    └── index.ts
```

------------------------------------------------------------------------

# Ownership Matrix

  Layer         Responsibility
  ------------- -----------------------------
  Page          Composition & orchestration
  Composition   Menggabungkan widget
  Component     UI
  Hook          UI behavior
  Query         Read server state
  Mutation      Write server state
  Service       HTTP
  Schema        Validation
  Utils         Pure function

------------------------------------------------------------------------

# Feature Checklist

Sebelum implementasi:

-   Tentukan route.
-   Tentukan data flow.
-   Tentukan state ownership.
-   Tentukan query key.
-   Tentukan reusable component.

------------------------------------------------------------------------

# CRUD Flow

``` text
List
 ↓
Detail
 ↓
Create
 ↓
Update
 ↓
Delete
```

Setiap operasi memiliki query/mutation yang terpisah.

------------------------------------------------------------------------

# State Ownership

-   Server State → TanStack Query
-   Form State → React Hook Form
-   UI State → Local State
-   Shared App State → Provider bila benar-benar diperlukan

------------------------------------------------------------------------

# Performance

-   Hindari duplicate request.
-   Gunakan pagination untuk data besar.
-   Pecah widget kompleks.
-   Lazy load halaman besar.

------------------------------------------------------------------------

# Memory Safety

Setiap feature harus memastikan:

-   listener dibersihkan
-   timer dibersihkan
-   observer dihentikan
-   async tidak memperbarui UI setelah unmount

AI wajib menjelaskan strategi cleanup bila menggunakan resource
tersebut.

------------------------------------------------------------------------

# Anti Patterns

❌ Feature saling bergantung langsung.

❌ Business logic di reusable component.

❌ Query di Page tanpa hook.

❌ Service memakai React Hook.

------------------------------------------------------------------------

# Code Review Checklist

-   [ ] Struktur feature lengkap?
-   [ ] Ownership jelas?
-   [ ] Query & mutation terpisah?
-   [ ] State ownership tepat?
-   [ ] Memory safety diperiksa?
-   [ ] Mudah diperluas?

------------------------------------------------------------------------

# Next

18-Performance.md
