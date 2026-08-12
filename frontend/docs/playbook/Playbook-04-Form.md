# Playbook 04 - Form

# Enterprise Form Playbook

## Purpose

Panduan implementasi form enterprise yang konsisten, mudah dipelihara,
dan aman.

------------------------------------------------------------------------

# Workflow

``` text
Requirement
↓
Schema
↓
Default Values
↓
React Hook Form
↓
UI Components
↓
Mutation
↓
Success/Error Handling
↓
Review
```

------------------------------------------------------------------------

# Folder Structure

``` text
features/users
├── compositions
│   └── UserFormSection.tsx
├── components
│   ├── UserForm.tsx
│   ├── UserFormActions.tsx
│   └── UserFormFields.tsx
├── schemas
├── mutations
├── hooks
└── services
```

------------------------------------------------------------------------

# Responsibilities

## Page

-   Orchestrasi
-   Menentukan mode (create/edit)

## Composition

-   Menghubungkan form, query, dan mutation.

## Form

-   Render field.
-   Tidak melakukan HTTP.

## Schema

-   Single source of truth untuk validasi.

------------------------------------------------------------------------

# Validation

-   Gunakan React Hook Form + schema.
-   Jangan menduplikasi aturan validasi.
-   Tampilkan error di dekat field terkait.

------------------------------------------------------------------------

# Default Values

-   Selalu eksplisit.
-   Hindari `undefined` bila nilai kosong memang valid.

------------------------------------------------------------------------

# Submit Flow

``` text
Submit
 ↓
Validate
 ↓
Mutation
 ↓
Invalidate Query
 ↓
Navigate / Toast
```

------------------------------------------------------------------------

# States

Sediakan:

-   Initial
-   Dirty
-   Submitting
-   Success
-   Error

------------------------------------------------------------------------

# Performance

-   Pecah form besar menjadi section.
-   Gunakan `Controller` hanya bila diperlukan.
-   Hindari state ganda.

------------------------------------------------------------------------

# Memory Safety

Jika form memakai listener, timer, subscription, atau async tambahan,
sediakan cleanup dan jelaskan skenario unmount.

------------------------------------------------------------------------

# Accessibility

-   Label untuk setiap input.
-   Error mudah dibaca.
-   Focus ke field pertama yang gagal validasi.
-   Keyboard friendly.

------------------------------------------------------------------------

# Mobile Layout dan Reachability

-   Satu kolom pada mobile.
-   `input`, `select`, date control, dan uploader memakai `w-full min-w-0`.
-   Tinggi control mobile 48px dan font input minimum 16px.
-   Gunakan `w-full sm:max-w-*`; jangan membatasi mobile dengan `max-w-*` saja.
-   Form panjang memakai full-screen route atau overlay dengan sticky footer.
-   Hanya body form yang boleh `overflow-y-auto`; dialog parent dan child tidak
    boleh sama-sama menjadi scroll owner.
-   Submit/cancel minimum 48px pada mobile dan tidak tertutup keyboard, bottom
    navigation, atau safe-area.
-   Error server mempertahankan nilai dan posisi konteks pengguna.

------------------------------------------------------------------------

# Anti Patterns

-   useState untuk setiap input.
-   HTTP langsung dari komponen field.
-   Validasi tersebar di banyak tempat.
-   Form ratusan baris tanpa dipecah.
-   Control `h-7`, `h-8`, atau `h-9` pada mobile.
-   Field menyusut karena `w-fit` atau `max-w-*` tanpa `w-full` mobile.
-   Footer submit berada di ujung body scroll tanpa keyboard/safe-area handling.

------------------------------------------------------------------------

# Checklist

-   [ ] Schema tersedia
-   [ ] RHF digunakan
-   [ ] Mutation terpisah
-   [ ] Error handling konsisten
-   [ ] Accessibility diperiksa
-   [ ] Cleanup diperiksa bila ada resource
-   [ ] Seluruh field mobile full-width, minimum 48px, dan font minimum 16px
-   [ ] Keyboard virtual tidak menutup field aktif atau submit
-   [ ] Form overlay hanya memiliki satu scroll body dan footer safe-area aware

------------------------------------------------------------------------

# Next

Playbook 05 - Pagination
