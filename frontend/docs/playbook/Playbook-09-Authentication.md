# Playbook 09 - Authentication

# Enterprise Authentication Playbook

## Purpose

Standar implementasi autentikasi untuk Enterprise Dashboard CMS.

------------------------------------------------------------------------

# Workflow

``` text
Login
↓
Validate Credentials
↓
Receive Token
↓
Store Session
↓
Protected Routes
↓
Refresh Session (bila digunakan)
↓
Logout
```

------------------------------------------------------------------------

# Folder Structure

``` text
features/auth
├── pages
├── components
├── hooks
├── queries
├── mutations
├── services
├── schemas
├── routes.tsx
└── types
```

------------------------------------------------------------------------

# Responsibilities

## Login Page

-   Render form
-   Memanggil login mutation

## Auth Service

-   Login
-   Logout
-   Refresh session (bila ada)

## Protected Route

-   Memastikan pengguna berhak mengakses halaman.

------------------------------------------------------------------------

# Session Strategy

-   Jangan menyimpan password.
-   Pisahkan autentikasi dari otorisasi.
-   HTTP client menangani penyematan token sesuai kebutuhan proyek.

------------------------------------------------------------------------

# Routing

``` text
Public
├── Login
└── Forgot Password

Protected
├── Dashboard
├── Users
├── Products
└── Settings
```

------------------------------------------------------------------------

# UX Rules

-   Loading saat login.
-   Error jelas.
-   Redirect setelah login berhasil.
-   Logout menghapus sesi.

------------------------------------------------------------------------

# Performance

-   Hindari pengecekan autentikasi berulang yang tidak perlu.
-   Cache profil pengguna bila sesuai.

------------------------------------------------------------------------

# Memory Safety

Batalkan request login yang tidak lagi diperlukan bila mekanisme HTTP
mendukung.

------------------------------------------------------------------------

# Accessibility

-   Label lengkap.
-   Keyboard friendly.
-   Focus ke error pertama.

------------------------------------------------------------------------

# Anti Patterns

-   Token tersebar di banyak tempat.
-   Login logic di UI component.
-   Protected Route berisi business logic.

------------------------------------------------------------------------

# Checklist

-   [ ] Login mutation
-   [ ] Protected Route
-   [ ] Logout flow
-   [ ] Error handling
-   [ ] Session lifecycle
-   [ ] Accessibility

------------------------------------------------------------------------

# Next

Playbook 10 - Authorization
