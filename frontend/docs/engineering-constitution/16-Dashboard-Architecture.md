# 16-Dashboard-Architecture.md

# Dashboard Architecture

## Status

Mandatory

## Purpose

Dokumen ini mendefinisikan blueprint arsitektur Dashboard CMS
Enterprise.

------------------------------------------------------------------------

# Golden Rule

Dashboard adalah **composition of features**, bukan satu komponen besar.

------------------------------------------------------------------------

# High Level Flow

``` text
Browser
  ↓
Router
  ↓
DashboardLayout
  ↓
DashboardPage
  ↓
DashboardOverview (Composition)
  ├── DashboardHeader
  ├── DashboardFilters
  ├── DashboardStats
  ├── DashboardCharts
  ├── DashboardTable
  └── DashboardActivity
```

------------------------------------------------------------------------

# Folder Structure

``` text
features/dashboard
├── pages
├── compositions
├── components
├── queries
├── mutations
├── services
├── hooks
├── schemas
├── types
├── constants
├── routes.tsx
└── index.ts
```

------------------------------------------------------------------------

# Responsibilities

## Page

-   Compose
-   Wire query/mutation
-   Route integration

## Composition

-   Menggabungkan widget terkait.
-   Tidak berisi business rule kompleks.

## Widget

-   Satu tanggung jawab.
-   Tidak melakukan fetch yang sama berulang.

------------------------------------------------------------------------

# Data Flow

``` text
DashboardPage
      │
      ▼
DashboardOverview
      │
      ▼
useDashboardQuery
      │
      ▼
dashboard.service.ts
      │
      ▼
HTTP Client
      │
      ▼
Backend
```

Distribusikan hasil query ke widget melalui props atau composition.

------------------------------------------------------------------------

# Widget Rules

-   Header
-   Filters
-   KPI Cards
-   Charts
-   Table
-   Activity

Masing-masing independen dan mudah diuji.

------------------------------------------------------------------------

# Performance

-   Lazy load halaman dashboard.
-   Hindari duplicate query.
-   Memoisasi hanya jika terbukti diperlukan.
-   Virtualisasi tabel besar bila dibutuhkan.

------------------------------------------------------------------------

# State Ownership

Server State → TanStack Query

Form State → React Hook Form

UI State → Local State

Global UI (tema, auth) → Provider/Context bila diperlukan

------------------------------------------------------------------------

# Memory Safety

Jika widget memakai: - event listener - observer - timer - subscription

cleanup wajib dan jelaskan skenario unmount.

------------------------------------------------------------------------

# Anti Patterns

-   DashboardPage \>300 baris.
-   Widget fetch endpoint yang sama.
-   Business logic di Header.
-   Shared state tidak jelas kepemilikannya.

------------------------------------------------------------------------

# AI Checklist

-   [ ] Page hanya composition?
-   [ ] Widget memiliki satu tanggung jawab?
-   [ ] Query tidak duplikat?
-   [ ] Ownership state jelas?
-   [ ] Cleanup tersedia?

------------------------------------------------------------------------

# Next

17-Feature-Development.md
