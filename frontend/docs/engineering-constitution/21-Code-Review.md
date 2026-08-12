# 21-Code-Review.md

# Code Review Playbook

## Status

Mandatory

## Purpose

Dokumen ini menjadi standar review sebelum kode di-merge.

------------------------------------------------------------------------

# Review Order

``` text
Correctness
    ↓
Architecture
    ↓
Folder Ownership
    ↓
Type Safety
    ↓
React Rules
    ↓
Performance
    ↓
Memory Safety
    ↓
Accessibility
    ↓
Readability
```

------------------------------------------------------------------------

# Architecture Checklist

-   [ ] Feature First dipatuhi
-   [ ] Ownership file benar
-   [ ] Business logic berada di layer yang tepat
-   [ ] Page hanya orchestration/composition
-   [ ] Shared tidak bergantung feature

------------------------------------------------------------------------

# React Checklist

-   [ ] State seminimal mungkin
-   [ ] useEffect benar-benar diperlukan
-   [ ] Cleanup tersedia
-   [ ] Tidak ada derived state yang disimpan tanpa alasan
-   [ ] Component tidak menjadi God Component

------------------------------------------------------------------------

# TanStack Query Checklist

-   [ ] Query dan Mutation dipisahkan
-   [ ] Query key konsisten
-   [ ] Service digunakan
-   [ ] Tidak ada fetch manual di component
-   [ ] Invalidation dievaluasi

------------------------------------------------------------------------

# Form Checklist

-   [ ] React Hook Form digunakan
-   [ ] Schema dipisahkan
-   [ ] Default values jelas
-   [ ] Error handling konsisten

------------------------------------------------------------------------

# Performance Checklist

-   [ ] Duplicate render dievaluasi
-   [ ] Duplicate request dihindari
-   [ ] Lazy loading sesuai
-   [ ] Optimasi berdasarkan kebutuhan

------------------------------------------------------------------------

# Memory Safety Checklist

-   [ ] Event listener dibersihkan
-   [ ] Timer dibersihkan
-   [ ] Observer dihentikan
-   [ ] Subscription dilepas
-   [ ] Async dibatalkan bila memungkinkan
-   [ ] Skenario unmount dijelaskan

------------------------------------------------------------------------

# Accessibility Checklist

-   [ ] Keyboard friendly
-   [ ] Semantic HTML
-   [ ] Label form lengkap
-   [ ] Focus management benar
-   [ ] Dialog dapat dioperasikan
-   [ ] Target mobile minimum 44px; primary/coarse-pointer control 48px
-   [ ] Ukuran ikon tidak disalahartikan sebagai ukuran hit-area
-   [ ] Search/filter/form field full-width pada mobile
-   [ ] Tabs tidak menimbulkan scroll vertikal tambahan
-   [ ] Page/overlay hanya memiliki satu scroll owner vertikal
-   [ ] Safe-area dan keyboard virtual tidak menutup action

------------------------------------------------------------------------

# AI Review Protocol

Sebelum mengirim jawaban:

1.  Review sendiri.
2.  Temukan potensi masalah.
3.  Refactor bila diperlukan.
4.  Baru kirim implementasi.

------------------------------------------------------------------------

# Merge Criteria

Kode hanya boleh dianggap siap merge bila seluruh checklist terpenuhi.

------------------------------------------------------------------------

# Next

22-Final-Checklist.md
