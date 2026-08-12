# 18-Performance.md

# Performance Guidelines

## Status

Mandatory

## Purpose

Menetapkan standar performa React Enterprise Dashboard agar cepat,
efisien, dan mudah diskalakan.

------------------------------------------------------------------------

# Performance Philosophy

Optimalkan berdasarkan kebutuhan nyata.

Prioritas:

1.  Correctness
2.  Readability
3.  Maintainability
4.  Measured Performance
5.  Micro-optimization

Jangan melakukan optimasi prematur.

------------------------------------------------------------------------

# Rendering Strategy

Gunakan urutan berikut sebelum melakukan optimasi:

``` text
Can render directly?
        │
        ▼
Need derived value?
        │
        ▼
useMemo (jika mahal)
        │
        ▼
Need stable callback?
        │
        ▼
useCallback (jika memberi manfaat)
```

------------------------------------------------------------------------

# State Rules

-   Simpan state sedekat mungkin dengan pemiliknya.
-   Hindari global state tanpa alasan.
-   Jangan menduplikasi server state ke local state.

------------------------------------------------------------------------

# React Rules

Gunakan:

-   React.memo bila komponen benar-benar sering menerima props stabil.
-   useMemo untuk komputasi mahal.
-   useCallback bila mencegah re-render yang berarti.

Jangan gunakan ketiganya secara default.

------------------------------------------------------------------------

# Dashboard Performance

-   Lazy load halaman besar.
-   Virtualisasi tabel panjang.
-   Hindari duplicate query.
-   Gunakan pagination atau infinite query bila sesuai.
-   Kelompokkan widget melalui composition.

------------------------------------------------------------------------

# Bundle Strategy

-   Lazy load route.
-   Dynamic import untuk modul besar.
-   Hindari import library yang tidak dipakai.

------------------------------------------------------------------------

# Decision Tree

``` text
Performance issue?
      │
      ▼
Already measured?
   │         │
 No        Yes
 │           │
 ▼           ▼
Measure   Optimize
```

------------------------------------------------------------------------

# Anti Patterns

-   useMemo di semua tempat.
-   useCallback tanpa manfaat.
-   React.memo pada komponen yang selalu berubah.
-   Query berulang untuk endpoint yang sama.
-   Render list besar tanpa strategi.

------------------------------------------------------------------------

# Performance Checklist

-   [ ] Duplicate render dievaluasi?
-   [ ] Duplicate request dihindari?
-   [ ] Pagination dipertimbangkan?
-   [ ] Lazy loading sesuai?
-   [ ] Bundle tetap kecil?
-   [ ] Optimasi berdasarkan hasil pengukuran?

------------------------------------------------------------------------

# AI Checklist

-   Jelaskan alasan optimasi.
-   Hindari premature optimization.
-   Jelaskan trade-off bila menggunakan memoization.

------------------------------------------------------------------------

# Next

19-Memory-Safety.md
