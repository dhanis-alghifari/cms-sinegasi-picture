# Playbook 02 - CRUD Page

# CRUD Page Playbook

## Purpose

Standar implementasi halaman CRUD (Create, Read, Update, Delete) pada
Enterprise Dashboard CMS.

------------------------------------------------------------------------

# Workflow

``` text
Requirement
↓
Route
↓
Page
↓
Composition
↓
Query
↓
Table
↓
Form
↓
Mutation
↓
Review
```

------------------------------------------------------------------------

# Folder Structure

``` text
features/users
├── pages
│   ├── UserListPage.tsx
│   ├── UserCreatePage.tsx
│   └── UserEditPage.tsx
├── compositions
│   ├── UserList.tsx
│   └── UserForm.tsx
├── components
├── queries
├── mutations
├── services
├── schemas
├── hooks
├── routes.tsx
└── index.ts
```

------------------------------------------------------------------------

# Standard Page Flow

``` text
UserListPage
      │
      ▼
UserList Composition
      ├── Filter
      ├── Table
      ├── Pagination
      └── Bulk Actions
```

------------------------------------------------------------------------

# CRUD Responsibilities

## List

-   Fetch data
-   Filter
-   Sort
-   Pagination

## Detail

-   Read only
-   Reuse detail query

## Create

-   React Hook Form
-   Schema validation
-   Create mutation

## Edit

-   Detail query
-   Form
-   Update mutation

## Delete

-   Confirmation dialog
-   Delete mutation
-   Query invalidation

------------------------------------------------------------------------

# Data Flow

``` text
Page
 ↓
Composition
 ↓
Query / Mutation
 ↓
Service
 ↓
HTTP Client
 ↓
Backend
```

------------------------------------------------------------------------

# Rules

-   Pisahkan query dan mutation.
-   Form tidak melakukan HTTP langsung.
-   Page hanya orchestration.
-   Service bebas React.
-   UI bebas business logic kompleks.

------------------------------------------------------------------------

# Loading Strategy

-   Skeleton untuk halaman besar.
-   Spinner untuk aksi singkat.
-   Disable tombol saat mutation berjalan.

------------------------------------------------------------------------

# Empty & Error State

Sediakan:

-   Empty state
-   Error state
-   Retry action
-   Loading state

------------------------------------------------------------------------

# Performance

-   Pagination untuk dataset besar.
-   Hindari duplicate query.
-   Lazy load halaman CRUD.

------------------------------------------------------------------------

# Memory Safety

Cleanup wajib untuk listener, timer, observer, subscription, atau
resource lain yang dibuat selama lifecycle komponen.

------------------------------------------------------------------------

# Checklist

-   [ ] Route dibuat
-   [ ] Query terpisah
-   [ ] Mutation terpisah
-   [ ] Schema tersedia
-   [ ] Table reusable bila sesuai
-   [ ] Form tervalidasi
-   [ ] Error & Empty state ada
-   [ ] Cleanup diperiksa

------------------------------------------------------------------------

# Next

Playbook 03 - Table
