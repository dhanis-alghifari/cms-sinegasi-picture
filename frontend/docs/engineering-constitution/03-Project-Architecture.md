# 03-Project-Architecture.md

# Project Architecture

## Purpose

Dokumen ini mendefinisikan struktur project React Enterprise Dashboard
CMS dari awal hingga production.

------------------------------------------------------------------------

# Golden Rule

> Architecture sebelum implementation.

Selalu tentukan:

1.  Ownership
2.  Folder
3.  Data Flow
4.  Component Hierarchy

baru mulai coding.

------------------------------------------------------------------------

# Evolution

``` text
Planning
    ↓
Bootstrap
    ↓
Feature Skeleton
    ↓
Routing
    ↓
Layout
    ↓
Design System
    ↓
Dashboard
    ↓
CRUD
    ↓
Production
```

------------------------------------------------------------------------

# Final Folder Structure

``` text
src
├── app
│   ├── main.tsx
│   ├── App.tsx
│   ├── providers
│   ├── router
│   └── config
├── layouts
├── components
│   ├── layout
│   ├── navigation
│   ├── ui
│   ├── common
│   └── feedback
├── shared
│   ├── api
│   ├── hooks
│   ├── constants
│   ├── schemas
│   ├── lib
│   ├── types
│   └── utils
├── features
│   ├── dashboard
│   ├── users
│   ├── products
│   ├── purchase-orders
│   ├── customers
│   └── settings
├── styles
└── assets
```

------------------------------------------------------------------------

# Layer Responsibility

  Layer        Responsibility
  ------------ --------------------
  app          Bootstrap aplikasi
  layouts      Template halaman
  components   Reusable UI
  shared       Shared utilities
  features     Business modules

------------------------------------------------------------------------

# Dependency Direction

``` text
App
 ↓
Layouts
 ↓
Features
 ↓
Components
 ↓
Shared
```

Feature tidak boleh bergantung langsung pada feature lain tanpa alasan
yang jelas.

------------------------------------------------------------------------

# Page Rule

Page hanya bertugas:

-   Composition
-   Query / Mutation orchestration
-   Routing integration

Page tidak boleh berisi business logic kompleks.

------------------------------------------------------------------------

# Dashboard Architecture

``` text
DashboardPage
    │
    ├── DashboardOverview
    ├── DashboardAnalytics
    └── DashboardMonitoring
```

DashboardOverview:

``` text
DashboardOverview
├── DashboardHeader
├── DashboardStats
├── DashboardCharts
├── DashboardSummary
└── DashboardActivity
```

------------------------------------------------------------------------

# AI Decision Flow

``` text
Requirement
    ↓
Business Analysis
    ↓
Folder Ownership
    ↓
Architecture
    ↓
Data Flow
    ↓
Component Hierarchy
    ↓
Implementation
```

------------------------------------------------------------------------

# Checklist

-   [ ] Folder benar
-   [ ] Ownership benar
-   [ ] Feature First
-   [ ] Page hanya composition
-   [ ] Layout tanpa business logic
-   [ ] Shared tidak bergantung feature
-   [ ] Query & Mutation terpisah
-   [ ] Memory safety diperiksa
