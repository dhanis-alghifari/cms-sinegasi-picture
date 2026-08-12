# Playbook 01 - Dashboard

# Dashboard Playbook

## Purpose

Panduan implementasi dashboard enterprise dari requirement hingga
production.

## Workflow

``` text
Requirement
↓
Wireframe
↓
Data Contract
↓
Route
↓
Layout
↓
Composition
↓
Widgets
↓
Queries
↓
Services
↓
QA
```

## Folder

``` text
features/dashboard
├── pages/
├── compositions/
├── components/
├── queries/
├── mutations/
├── hooks/
├── services/
├── schemas/
├── constants/
├── types/
├── routes.tsx
└── index.ts
```

## Composition

``` text
DashboardPage
└── DashboardOverview
    ├── Header
    ├── Filters
    ├── KPI Cards
    ├── Charts
    ├── Table
    └── Activity
```

## Ownership

-   Page: orchestration
-   Composition: menyusun widget
-   Widget: satu tanggung jawab
-   Query: server state
-   Service: HTTP
-   UI: presentasi

## Data Flow

``` text
Page
 ↓
Composition
 ↓
Query
 ↓
Service
 ↓
HTTP Client
 ↓
Backend
```

## Rules

-   Satu dashboard = satu composition utama.
-   Hindari duplicate query.
-   Widget tidak saling mengetahui implementasi internal.
-   Gunakan props atau composition untuk berbagi data.
-   Jangan fetch langsung di widget jika data sudah dimiliki
    composition.

## Performance

-   Lazy load dashboard.
-   Virtualisasi tabel besar.
-   Evaluasi memoisasi berdasarkan profiling.

## Memory Safety

Jika widget memakai listener, timer, observer, atau subscription, wajib
cleanup dan jelaskan skenario unmount.

## Checklist

-   [ ] Folder benar
-   [ ] Composition jelas
-   [ ] Query terpusat
-   [ ] Widget independen
-   [ ] Cleanup tersedia
-   [ ] Accessibility diperiksa

## Next

Playbook 02 - CRUD Page
