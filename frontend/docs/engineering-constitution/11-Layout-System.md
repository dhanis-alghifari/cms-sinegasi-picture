# 11-Layout-System.md

# Layout System

## Status

Mandatory

## Purpose

Menetapkan arsitektur layout untuk seluruh Enterprise Dashboard CMS.

------------------------------------------------------------------------

# Goals

Layout harus:

-   Konsisten
-   Reusable
-   Mudah dikembangkan
-   Tidak memiliki business logic
-   Menjadi fondasi seluruh halaman

------------------------------------------------------------------------

# Layout Types

``` text
layouts/
├── DashboardLayout.tsx
├── AuthLayout.tsx
└── BlankLayout.tsx
```

## DashboardLayout

Digunakan setelah login.

``` text
DashboardLayout
├── Header
├── Sidebar
├── Main
└── Outlet
```

## AuthLayout

Untuk login, register, forgot password.

## BlankLayout

Untuk halaman khusus seperti 404, maintenance, print.

------------------------------------------------------------------------

# Layout Flow

``` text
Browser
   │
Router
   │
DashboardLayout
   │
Layout.Root
├── Layout.Header
├── Layout.Sidebar
└── Layout.Main
        │
      Outlet
        │
   Feature Page
```

------------------------------------------------------------------------

# Folder Structure

``` text
layouts/
└── DashboardLayout.tsx

components/
└── layout/
    └── Layout/
        ├── Root.tsx
        ├── Header.tsx
        ├── Sidebar.tsx
        ├── Main.tsx
        └── index.ts
```

------------------------------------------------------------------------

# Responsibilities

DashboardLayout:

-   Menyusun layout
-   Menempatkan Outlet
-   Menyediakan shell aplikasi

Tidak boleh:

-   Fetch API feature
-   Mutation
-   Validasi
-   Business rules

------------------------------------------------------------------------

# Decision Tree

``` text
Need new UI?
      │
      ▼
Global application shell?
      │
 Yes  │  No
      ▼
Layout
      │
Feature specific?
      │
 Yes ▼
Feature Component
```

------------------------------------------------------------------------

# Performance

-   Hindari state yang tidak perlu di layout.
-   Lazy load halaman melalui router.
-   Jangan membuat seluruh layout re-render saat data halaman berubah.

------------------------------------------------------------------------

# Mobile Reachability dan Scroll Ownership

Layout mobile membagi layar menjadi:

- top: context, back, status, dan rare action;
- middle: search, content, selection, dan detail;
- bottom: frequent primary action dan role-aware navigation.

Aturan mandatory:

- `Layout.Main` menjadi satu-satunya pemilik scroll vertikal page;
- overlay dialog/sheet boleh memiliki scroll sendiri karena menutup page, tetapi
  hanya satu body overlay yang scrollable;
- tab strip hanya boleh scroll horizontal dan wajib `overflow-y-hidden`;
- sticky action berada di atas bottom navigation;
- content padding memperhitungkan tinggi sticky action, bottom navigation, dan
  `env(safe-area-inset-bottom)`;
- landscape mempertimbangkan safe-area top/right/left;
- shell memakai fallback `100vh` lalu `100dvh`;
- keyboard virtual tidak boleh menutup field aktif atau submit.

Ukuran dan pola lengkap mengikuti
`docs/responsive-webapp/10-mobile-reachability-and-control-spec.md`.

------------------------------------------------------------------------

# Memory Safety

Jika layout menggunakan:

-   resize listener
-   media query
-   observer

wajib cleanup saat unmount.

AI harus menjelaskan skenario unmount.

------------------------------------------------------------------------

# Anti Patterns

❌ DashboardLayout melakukan fetch data bisnis.

❌ Sidebar berisi logika CRUD.

❌ Header mengetahui detail feature.

❌ Outlet dibungkus logika business.

------------------------------------------------------------------------

# Code Review Checklist

-   [ ] Layout hanya application shell?
-   [ ] Outlet berada di Layout.Main?
-   [ ] Tidak ada business logic?
-   [ ] Compound Component digunakan dengan tepat?
-   [ ] Cleanup tersedia jika memakai listener?
-   [ ] Mudah diperluas?
-   [ ] Hanya satu scroll owner vertikal aktif per page/overlay?
-   [ ] Sticky action, bottom navigation, safe-area, dan keyboard tidak overlap?
-   [ ] Action utama berada pada reach zone yang sesuai?

------------------------------------------------------------------------

# Next

12-Routing.md
