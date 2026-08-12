# 13-API-Layer.md

# API Layer & Service Rules

## Status

Mandatory

## Purpose

Menetapkan standar komunikasi dengan backend agar seluruh akses API
konsisten, mudah diuji, dan terpisah dari UI.

------------------------------------------------------------------------

# Core Principles

-   UI tidak boleh memanggil HTTP secara langsung.
-   Semua komunikasi backend melalui Service Layer.
-   Query dan Mutation menggunakan Service.
-   Service tidak bergantung pada React.

------------------------------------------------------------------------

# Architecture

``` text
Page
  │
  ▼
Query / Mutation
  │
  ▼
Service
  │
  ▼
HTTP Client
  │
  ▼
Backend API
```

------------------------------------------------------------------------

# Folder Structure

``` text
features/
└── users
    ├── services
    │   └── user.service.ts
    ├── queries
    ├── mutations
    └── types
```

------------------------------------------------------------------------

# Responsibilities

## Service

Boleh:

-   GET
-   POST
-   PUT
-   PATCH
-   DELETE
-   Mapping request sederhana

Tidak boleh:

-   useState
-   useEffect
-   JSX
-   React Hook
-   Business UI

------------------------------------------------------------------------

# HTTP Client

Semua request menggunakan client yang sama.

Contoh:

``` text
shared/api/
├── client.ts
├── interceptors.ts
└── errors.ts
```

------------------------------------------------------------------------

# Error Handling

-   Gunakan error yang konsisten.
-   Jangan melakukan `alert()` di service.
-   UI yang menentukan bagaimana error ditampilkan.

------------------------------------------------------------------------

# Decision Tree

``` text
Need data?
    │
    ▼
Server data?
    │
 Yes ▼
Create Service
    │
Use Query / Mutation
```

------------------------------------------------------------------------

# Anti Patterns

❌ fetch()/axios langsung di component

❌ Business logic di service

❌ UI mengatur HTTP header

❌ Service mengakses DOM

------------------------------------------------------------------------

# Performance

-   Hindari request duplikat.
-   Gunakan cache melalui TanStack Query.
-   Jangan membuat instance HTTP client berulang.

------------------------------------------------------------------------

# Memory Safety

Jika request dapat dibatalkan, gunakan mekanisme pembatalan (misalnya
AbortController atau mekanisme library yang digunakan) ketika sesuai.

Jangan biarkan hasil async memperbarui UI setelah komponen sudah tidak
aktif.

------------------------------------------------------------------------

# Code Review Checklist

-   [ ] Semua request melalui service?
-   [ ] Service bebas React?
-   [ ] Error handling konsisten?
-   [ ] HTTP client digunakan bersama?
-   [ ] Tidak ada fetch langsung di UI?

------------------------------------------------------------------------

# AI Checklist

Sebelum membuat API:

-   Tentukan domain.
-   Buat service.
-   Pisahkan query & mutation.
-   Tentukan request/response type.
-   Baru implementasi UI.

------------------------------------------------------------------------

# Next

14-TanStack-Query.md
