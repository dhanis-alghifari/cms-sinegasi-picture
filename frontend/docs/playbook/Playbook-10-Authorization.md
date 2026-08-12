# Playbook 10 - Authorization

# Enterprise Authorization Playbook

## Purpose

Standar implementasi otorisasi agar setiap pengguna hanya dapat
mengakses resource sesuai izin.

------------------------------------------------------------------------

# Workflow

``` text
Authenticate User
↓
Load Roles & Permissions
↓
Protect Route
↓
Protect Feature
↓
Protect Action
↓
Render UI
```

------------------------------------------------------------------------

# Authorization Layers

-   Route
-   Page
-   Component
-   Action
-   API

Defense in depth: jangan hanya mengandalkan UI.

------------------------------------------------------------------------

# Folder Structure

``` text
features/auth
├── permissions.ts
├── hooks
│   └── usePermission.ts
├── components
│   └── PermissionGuard.tsx
└── types
```

------------------------------------------------------------------------

# Responsibilities

## PermissionGuard

-   Menampilkan atau menyembunyikan UI berdasarkan izin.

## usePermission

-   Menyediakan utilitas pengecekan izin.

## Route Guard

-   Mencegah akses ke halaman yang tidak diizinkan.

------------------------------------------------------------------------

# Permission Model

Contoh:

``` text
users.read
users.create
users.update
users.delete

products.read
products.update
```

------------------------------------------------------------------------

# UI Rules

-   Sembunyikan aksi yang tidak diizinkan.
-   Disable aksi bila lebih sesuai daripada menyembunyikan (sesuai
    kebutuhan produk).
-   Selalu tampilkan pesan yang jelas jika akses ditolak.

------------------------------------------------------------------------

# Route Rules

``` text
Login
  ↓
Protected Route
  ↓
Permission Check
  ↓
Allowed ? Page : Forbidden
```

------------------------------------------------------------------------

# Component Rules

Gunakan PermissionGuard untuk membungkus aksi sensitif.

Contoh:

``` tsx
<PermissionGuard permission="users.delete">
  <DeleteButton />
</PermissionGuard>
```

------------------------------------------------------------------------

# Performance

-   Muat permission sekali per sesi bila memungkinkan.
-   Hindari pengecekan berulang yang identik.

------------------------------------------------------------------------

# Memory Safety

Jika mengambil permission secara async, hindari update UI setelah
komponen tidak aktif dan batalkan proses bila mekanisme yang digunakan
mendukung.

------------------------------------------------------------------------

# Accessibility

-   Pesan "akses ditolak" dapat dibaca screen reader.
-   Fokus berpindah ke konten yang relevan setelah redirect.

------------------------------------------------------------------------

# Anti Patterns

-   Permission hanya di UI.
-   Hardcode role di banyak tempat.
-   Business rule tersebar.

------------------------------------------------------------------------

# Checklist

-   [ ] Route terlindungi
-   [ ] PermissionGuard digunakan
-   [ ] Permission terpusat
-   [ ] UI konsisten
-   [ ] Error/Forbidden page tersedia
-   [ ] Accessibility diperiksa

------------------------------------------------------------------------

# Playbook Series Complete

Lanjutkan dengan Pattern Catalog atau Reference Implementation untuk
contoh implementasi lengkap.
