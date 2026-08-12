# 04-Folder-Structure.md

# Folder Structure & Ownership

## Purpose

Dokumen ini menjelaskan tanggung jawab setiap folder dalam project. AI
wajib menentukan ownership sebelum membuat file baru.

------------------------------------------------------------------------

# Golden Rule

> Every file must have one clear owner.

Jangan membuat file hanya karena "bisa diletakkan di mana saja".

------------------------------------------------------------------------

# Root Structure

``` text
src
├── app
├── assets
├── components
├── features
├── layouts
├── shared
├── styles
└── types
```

------------------------------------------------------------------------

# Ownership Matrix

  Folder       Responsibility       Business Logic
  ------------ -------------------- ----------------
  app          Bootstrap aplikasi   ❌
  layouts      Template halaman     ❌
  components   Reusable UI          ❌
  features     Business module      ✅
  shared       Shared utilities     ❌
  styles       Global styles        ❌
  assets       Static assets        ❌

------------------------------------------------------------------------

# app

Berisi:

-   main.tsx
-   App.tsx
-   providers
-   router
-   config

Tidak boleh:

-   Fetch API
-   Business rule
-   Feature logic

------------------------------------------------------------------------

# layouts

Contoh:

``` text
layouts
├── DashboardLayout.tsx
├── AuthLayout.tsx
└── BlankLayout.tsx
```

Tugas:

-   Menyusun header
-   Sidebar
-   Outlet
-   Footer

Tidak boleh:

-   Mutation
-   Validasi
-   Query business

------------------------------------------------------------------------

# components

``` text
components
├── ui
├── layout
├── navigation
├── common
└── feedback
```

Rule:

Reusable minimal digunakan oleh 3 feature atau benar-benar bersifat
generic.

------------------------------------------------------------------------

# features

``` text
features
└── users
    ├── pages
    ├── components
    ├── compositions
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

Semua business logic berada di sini.

------------------------------------------------------------------------

# shared

Hanya berisi utilitas lintas feature.

``` text
shared
├── api
├── constants
├── hooks
├── lib
├── schemas
├── types
└── utils
```

Shared tidak boleh mengimpor feature.

------------------------------------------------------------------------

# Decision Tree

``` text
Need new file?
      │
      ▼
Business specific?
   │          │
 Yes         No
 │            │
 ▼            ▼
Feature     Shared/UI
      │
Reusable?
 │          │
No         Yes (>=3 features)
 │            │
 ▼            ▼
Feature     components/shared
```

------------------------------------------------------------------------

# Common Mistakes

❌ Menaruh UserTable di components/ui padahal hanya dipakai Users.

❌ Menaruh helper global di feature.

❌ Shared mengimpor feature.

❌ Layout melakukan fetch data.

------------------------------------------------------------------------

# AI Checklist

-   [ ] Ownership sudah benar?
-   [ ] File berada di folder paling tepat?
-   [ ] Bisa dipindah ke shared?
-   [ ] Terlalu dini membuat reusable?
-   [ ] Feature tetap terisolasi?
