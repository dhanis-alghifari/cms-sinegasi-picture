# 08-React-Rules.md

# React Rules

## Purpose

Dokumen ini menetapkan aturan penggunaan React agar komponen konsisten,
mudah dirawat, aman dari memory leak, dan sesuai arsitektur Enterprise
Dashboard CMS.

------------------------------------------------------------------------

# React Philosophy

React digunakan untuk membangun UI melalui composition.

Prioritas:

1.  Composition
2.  Readability
3.  Maintainability
4.  Performance

------------------------------------------------------------------------

# Component Principles

-   Satu komponen memiliki satu tanggung jawab.
-   Pecah komponen sebelum menjadi terlalu besar.
-   Gunakan composition dibanding inheritance.
-   Jangan menaruh business logic kompleks di reusable UI.

------------------------------------------------------------------------

# State Rules

Gunakan state sekecil mungkin.

Prioritas:

``` text
Props
 ↓
Derived Value
 ↓
Local State
 ↓
Context
```

Jangan menyimpan derived state yang bisa dihitung saat render.

------------------------------------------------------------------------

# useEffect Rules

## Golden Rule

Jangan gunakan `useEffect` secara default.

Gunakan hanya untuk sinkronisasi dengan sistem eksternal:

-   Event listener
-   WebSocket
-   Timer
-   Observer
-   Integrasi library
-   API yang tidak dikelola TanStack Query

Hindari `useEffect` untuk:

-   Filter array
-   Mapping data
-   Derived state
-   Menggabungkan props
-   Perhitungan sederhana

------------------------------------------------------------------------

# Memory Safety

Setiap komponen React harus bebas dari memory leak.

Jika menggunakan:

-   addEventListener
-   setTimeout
-   setInterval
-   ResizeObserver
-   MutationObserver
-   IntersectionObserver
-   WebSocket
-   Subscription

maka cleanup wajib.

Contoh:

``` tsx
useEffect(() => {
  const onResize = () => {};

  window.addEventListener("resize", onResize);

  return () => {
    window.removeEventListener("resize", onResize);
  };
}, []);
```

AI wajib menjelaskan:

-   Mengapa cleanup diperlukan.
-   Apa yang terjadi saat unmount.
-   Risiko jika cleanup tidak dilakukan.

------------------------------------------------------------------------

# Custom Hooks

Gunakan custom hook bila logika dipakai ulang atau membuat komponen
lebih mudah dibaca.

Contoh:

``` text
useUserDialog
useDashboardFilter
useInfiniteTable
```

Hook harus memiliki satu tanggung jawab.

------------------------------------------------------------------------

# Component Size

Panduan umum:

-   \<100 baris: ideal

-   100--200: evaluasi

-   200: pecah menjadi composition

------------------------------------------------------------------------

# Event Handler

Gunakan nama:

-   handleSubmit
-   handleDelete
-   handleSearch
-   handleClose

------------------------------------------------------------------------

# Anti Patterns

-   useEffect untuk derived state.
-   State duplikat.
-   God Component.
-   Fetch langsung di widget.
-   Update state setelah unmount.
-   Cleanup tidak ada.

------------------------------------------------------------------------

# Decision Tree

``` text
Need logic?
      │
      ▼
External system?
   │         │
 Yes        No
 │           │
 ▼           ▼
useEffect  Render / Memo / Handler
```

------------------------------------------------------------------------

# AI Checklist

-   [ ] Perlu useEffect?
-   [ ] Cleanup tersedia?
-   [ ] Ada potensi memory leak?
-   [ ] State benar-benar diperlukan?
-   [ ] Komponen terlalu besar?
-   [ ] Perlu custom hook?
-   [ ] Business logic berada di layer yang benar?

------------------------------------------------------------------------

# Next

09-Component-Rules.md
