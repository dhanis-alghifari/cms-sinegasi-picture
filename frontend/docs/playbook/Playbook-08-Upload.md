# Playbook 08 - Upload

# Enterprise Upload Playbook

## Purpose

Standar implementasi upload file pada Enterprise Dashboard CMS.

------------------------------------------------------------------------

# Workflow

``` text
Select File
↓
Client Validation
↓
Preview (optional)
↓
Upload Mutation
↓
Progress
↓
Success / Error
↓
Invalidate Query
```

------------------------------------------------------------------------

# Upload Types

-   Single File
-   Multiple Files
-   Drag & Drop
-   Image Upload
-   Document Upload
-   CSV/Excel Import

------------------------------------------------------------------------

# Folder Structure

``` text
features/import
├── components
│   ├── UploadDropzone.tsx
│   ├── UploadPreview.tsx
│   ├── UploadProgress.tsx
│   └── UploadActions.tsx
├── hooks
│   └── useUpload.ts
├── mutations
├── services
└── schemas
```

------------------------------------------------------------------------

# Responsibilities

## Component

-   Pilih file
-   Preview
-   Progress

## Hook

-   UI state upload
-   File list

## Mutation

-   Upload request
-   Retry
-   Success handling

## Service

-   HTTP upload
-   Tidak bergantung React

------------------------------------------------------------------------

# Validation

Periksa sebelum upload:

-   Tipe file
-   Ukuran file
-   Jumlah file
-   Nama file bila diperlukan

------------------------------------------------------------------------

# UX Rules

-   Progress bar
-   Cancel upload bila didukung
-   Retry saat gagal
-   Preview sebelum upload bila relevan
-   Pesan error yang jelas

------------------------------------------------------------------------

# Performance

-   Jangan membaca seluruh file ke memori bila tidak perlu.
-   Gunakan streaming/chunk upload jika backend mendukung.
-   Hindari upload ulang file yang sama tanpa alasan.

------------------------------------------------------------------------

# Memory Safety

-   Batalkan upload yang masih berjalan saat komponen tidak aktif bila
    mekanisme HTTP mendukung.
-   Bersihkan object URL hasil `URL.createObjectURL()` dengan
    `URL.revokeObjectURL()`.
-   Cleanup listener/timer bila digunakan.

------------------------------------------------------------------------

# Accessibility

-   Input dapat diakses keyboard.
-   Dropzone tetap memiliki alternatif klik.
-   Status upload diumumkan dengan jelas.

------------------------------------------------------------------------

# Anti Patterns

-   Validasi hanya di backend.
-   Object URL tidak direvoke.
-   Upload langsung dari UI tanpa mutation.
-   Tidak ada progress atau error state.

------------------------------------------------------------------------

# Checklist

-   [ ] Validasi client
-   [ ] Mutation terpisah
-   [ ] Progress tersedia
-   [ ] Retry tersedia
-   [ ] Cleanup object URL
-   [ ] Accessibility diperiksa

------------------------------------------------------------------------

# Next

Playbook 09 - Authentication
