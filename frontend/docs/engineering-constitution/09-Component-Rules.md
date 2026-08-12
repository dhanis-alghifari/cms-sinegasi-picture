# 09-Component-Rules.md

# Component Rules

## Purpose

Menetapkan standar pembuatan React Component agar konsisten, reusable
bila tepat, dan mudah dipelihara.

------------------------------------------------------------------------

# Core Principles

1.  Component memiliki satu tanggung jawab.
2.  UI dipisahkan dari business logic.
3.  Reuse dilakukan karena kebutuhan, bukan asumsi.
4.  Composition lebih diutamakan daripada component yang sangat
    kompleks.

------------------------------------------------------------------------

# Component Classification

``` text
components/
├── ui          # Generic UI
├── common      # Shared lintas feature
├── layout      # Layout system
└── navigation  # Navigation

features/
└── users/
    └── components/   # Khusus feature users
```

------------------------------------------------------------------------

# Ownership Decision

``` text
Need new component?
        │
        ▼
Business specific?
   │            │
 Yes           No
 │              │
 ▼              ▼
Feature      Shared UI
      │
Used by ≥3 features?
      │
   Yes ▼
Move to components/common
```

------------------------------------------------------------------------

# Component Responsibilities

## Page

-   Compose feature
-   Call query/mutation
-   Route integration

Tidak boleh: - Validasi kompleks - Mapping besar - Business rule

------------------------------------------------------------------------

## Composition

Menggabungkan beberapa widget menjadi satu unit.

Contoh:

``` text
DashboardOverview
├── DashboardHeader
├── DashboardStats
├── DashboardCharts
└── DashboardActivity
```

------------------------------------------------------------------------

## Widget

Menampilkan satu bagian UI.

Contoh:

-   UserTable
-   DashboardStats
-   OrderSummary

------------------------------------------------------------------------

## UI Component

Generic:

-   Button
-   Input
-   Modal
-   Card
-   Table
-   Tabs

Tidak mengetahui domain bisnis.

Shared primitive adalah deep seam. `Button`, `Input`, `Select`, `Tabs`,
`Dialog`, `Sheet`, dan `Pagination` wajib memiliki kontrak touch geometry dan
scroll behavior yang aman sehingga feature tidak mengulang override ukuran.

- target sentuh mobile minimum 44px;
- action utama/coarse pointer minimum 48px;
- ikon visual boleh lebih kecil, tetapi parent hit-area wajib memenuhi target;
- mode compact desktop hanya untuk ruang cukup dan fine pointer;
- field mobile default `w-full min-w-0` dalam form;
- dialog/sheet mengekspos header, satu scroll body, dan footer secara jelas.

Spesifikasi lengkap mengikuti
`docs/responsive-webapp/10-mobile-reachability-and-control-spec.md`.

------------------------------------------------------------------------

## Responsive Presentation Adapter

Collection yang memiliki banyak field wajib memisahkan orchestration data dari
cara penyajiannya:

- desktop table untuk perbandingan antarkolom;
- tablet compact table atau grid kartu;
- mobile card/list dengan detail progresif;
- query, mutation, permission, dan action handler tetap satu sumber.

Aturan ini berlaku untuk collection pada page utama maupun yang bersarang di
tab, report, dialog, sheet, dan widget. Komponen report tidak boleh dianggap
selesai hanya karena container luarnya responsif.

Hanya satu adapter interaktif yang boleh aktif pada satu viewport. Tabel khusus
print/export boleh berada di DOM jika benar-benar tersembunyi dari layar dan
accessibility tree.

------------------------------------------------------------------------

# Props Rules

-   Props seminimal mungkin.
-   Hindari prop drilling berlebihan.
-   Gunakan children bila membuat layout/container.
-   Hindari boolean props yang saling bertentangan.

------------------------------------------------------------------------

# Component Size

Ideal: - \<100 baris

Evaluasi: - 100--200 baris

Refactor: - \>200 baris

------------------------------------------------------------------------

# Memory Safety

Jika component memakai:

-   event listener
-   observer
-   timer
-   subscription

Cleanup wajib.

AI harus menjelaskan skenario unmount.

------------------------------------------------------------------------

# Anti Patterns

❌ God Component

❌ Reusable terlalu dini

❌ Business logic di UI

❌ Widget melakukan fetch sendiri-sendiri

❌ Props terlalu banyak

------------------------------------------------------------------------

# Code Review Checklist

-   [ ] Ownership benar?
-   [ ] UI bebas business logic?
-   [ ] Perlu composition?
-   [ ] Reusable memang diperlukan?
-   [ ] Props sederhana?
-   [ ] Cleanup tersedia?
-   [ ] Mudah diuji?
-   [ ] Mudah dipelihara?
-   [ ] Seluruh collection langsung dan bersarang memiliki adapter viewport yang tepat?
-   [ ] Domain state dan action tidak digandakan antar-adapter?
-   [ ] Primitive interaktif memenuhi hit-area 44/48px tanpa override feature kecil?
-   [ ] Field mobile full-width dan scroll owner tunggal?

------------------------------------------------------------------------

# Next

10-Compound-Component.md
