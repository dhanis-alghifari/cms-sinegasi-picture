# 10-Compound-Component.md

# Compound Component Rules

## Status

Mandatory

## Purpose

Menetapkan kapan Compound Component digunakan dan kapan harus dihindari.

------------------------------------------------------------------------

# Philosophy

Compound Component bertujuan membuat API komponen lebih mudah dibaca dan
lebih fleksibel.

Gunakan hanya bila benar-benar meningkatkan pengalaman penggunaan
komponen.

------------------------------------------------------------------------

# Good Candidates

-   Layout
-   Modal
-   Table
-   Tabs
-   Accordion
-   Dropdown
-   Navigation
-   Card (kompleks)

------------------------------------------------------------------------

# Avoid Compound Component

Jangan gunakan untuk:

-   Services
-   Hooks
-   TanStack Query
-   Router
-   API Layer
-   Utility
-   Schema

------------------------------------------------------------------------

# Example

``` tsx
<Layout.Root>
  <Layout.Header />
  <Layout.Sidebar />
  <Layout.Main>
    <Outlet />
  </Layout.Main>
</Layout.Root>
```

``` tsx
<Modal.Root open={open} onOpenChange={setOpen}>
  <Modal.Header />
  <Modal.Body />
  <Modal.Footer />
</Modal.Root>
```

------------------------------------------------------------------------

# Decision Tree

``` text
Need new component?
        │
        ▼
Has multiple semantic sections?
        │
   Yes  │  No
        ▼
Need flexible composition?
        │
   Yes  │  No
        ▼
Compound Component
        │
Otherwise
        ▼
Regular Component
```

------------------------------------------------------------------------

# Folder Structure

``` text
components/
└── layout/
    └── Layout/
        ├── Root.tsx
        ├── Header.tsx
        ├── Sidebar.tsx
        ├── Main.tsx
        ├── context.ts
        ├── hooks.ts
        └── index.ts
```

------------------------------------------------------------------------

# Rules

-   Root menjadi entry point.
-   Sub-component hanya menangani UI masing-masing.
-   Shared state menggunakan Context hanya jika memang diperlukan.
-   Jangan memindahkan business logic ke compound component.

------------------------------------------------------------------------

# Performance

-   Hindari re-render seluruh subtree.
-   Memoisasi bila dibutuhkan.
-   Context harus sekecil mungkin.

------------------------------------------------------------------------

# Memory Safety

Jika compound component memiliki:

-   listener
-   observer
-   timer
-   subscription

cleanup wajib.

Jelaskan:

-   kapan cleanup dijalankan
-   skenario unmount
-   risiko memory leak

------------------------------------------------------------------------

# Anti Patterns

❌ Compound component hanya karena tren.

❌ Root berisi seluruh business logic.

❌ Context menyimpan state yang tidak relevan.

❌ API terlalu rumit.

------------------------------------------------------------------------

# Code Review Checklist

-   [ ] Compound component memang diperlukan?
-   [ ] API mudah dibaca?
-   [ ] Root sederhana?
-   [ ] Business logic berada di layer yang benar?
-   [ ] Cleanup tersedia bila memakai resource eksternal?
-   [ ] Mudah diuji?
-   [ ] Mudah diperluas?

------------------------------------------------------------------------

# Next

11-Layout-System.md
