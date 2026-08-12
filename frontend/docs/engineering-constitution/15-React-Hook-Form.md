# 15-React-Hook-Form.md

# React Hook Form Rules

## Status

Mandatory

## Purpose

Menetapkan standar pengelolaan form menggunakan React Hook Form sebagai
solusi utama untuk form state.

------------------------------------------------------------------------

# Core Principles

-   Form state dikelola oleh React Hook Form.
-   Validasi menggunakan schema (misalnya Zod).
-   UI tidak menyimpan duplikasi form state.
-   Business logic tetap berada di feature.

------------------------------------------------------------------------

# Architecture

``` text
Page
  │
  ▼
Feature Form
  │
  ▼
React Hook Form
  │
  ▼
Schema Validation
  │
  ▼
Mutation
  │
  ▼
Service
```

------------------------------------------------------------------------

# Folder Structure

``` text
features/users
├── components
│   └── UserForm.tsx
├── schemas
│   └── user.schema.ts
├── mutations
└── services
```

------------------------------------------------------------------------

# Rules

## Validation

Gunakan schema sebagai sumber kebenaran.

``` text
Form
  │
  ▼
Schema
```

Jangan menduplikasi aturan validasi di banyak tempat.

------------------------------------------------------------------------

## Default Values

-   Berikan default value yang eksplisit.
-   Hindari `undefined` bila nilai kosong memang diharapkan.

------------------------------------------------------------------------

## Submission

Submit hanya bertugas:

-   validasi
-   memanggil mutation
-   menangani hasil

Business rule kompleks ditempatkan di layer yang sesuai.

------------------------------------------------------------------------

## Controlled vs Uncontrolled

-   Gunakan input bawaan React Hook Form bila memungkinkan.
-   Gunakan `Controller` hanya untuk komponen yang memang memerlukannya.

------------------------------------------------------------------------

# Anti Patterns

❌ useState untuk setiap input.

❌ Validasi manual di banyak handler.

❌ Mengirim request langsung dari field.

❌ Menyimpan hasil server sebagai form state tanpa alasan.

------------------------------------------------------------------------

# Performance

-   Manfaatkan optimasi React Hook Form.
-   Hindari re-render seluruh form.
-   Pecah form besar menjadi section/component.

------------------------------------------------------------------------

# Memory Safety

Jika form membuat subscription, listener, atau async process tambahan,
pastikan resource tersebut dibersihkan ketika komponen di-unmount.

------------------------------------------------------------------------

# Decision Tree

``` text
Need form?
   │
   ▼
User input?
   │
 Yes ▼
React Hook Form
   │
Need schema?
   │
 Yes ▼
Zod (atau schema pilihan proyek)
```

------------------------------------------------------------------------

# Code Review Checklist

-   [ ] React Hook Form digunakan?
-   [ ] Schema dipisahkan?
-   [ ] Mutation terpisah?
-   [ ] Tidak ada useState per field tanpa alasan?
-   [ ] Form mudah dipecah menjadi section?

------------------------------------------------------------------------

# AI Checklist

-   Tentukan schema.
-   Tentukan default values.
-   Tentukan mutation.
-   Hubungkan ke UI.
-   Pastikan validasi konsisten.

------------------------------------------------------------------------

# Next

16-Dashboard-Architecture.md
