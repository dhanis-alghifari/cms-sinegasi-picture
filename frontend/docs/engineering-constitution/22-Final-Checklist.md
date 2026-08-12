# 22-Final-Checklist.md

# Final Engineering Quality Gate

## Status

Mandatory

## Purpose

Dokumen ini adalah **quality gate terakhir** sebelum kode dianggap siap
di-review, di-merge, atau dirilis.

------------------------------------------------------------------------

# Golden Rule

Kode **belum selesai** hanya karena:

-   Berhasil di-compile
-   Tidak ada TypeScript error
-   Lulus linting

Kode baru dianggap selesai jika memenuhi seluruh quality gate berikut.

------------------------------------------------------------------------

# 1. Architecture Gate

-   [ ] Feature First Architecture dipatuhi
-   [ ] Folder ownership benar
-   [ ] Dependency direction benar
-   [ ] Page hanya orchestration/composition
-   [ ] Business logic berada di layer yang tepat

------------------------------------------------------------------------

# 2. React Gate

-   [ ] Component memiliki satu tanggung jawab
-   [ ] useEffect hanya digunakan untuk sinkronisasi eksternal
-   [ ] Derived state tidak disimpan tanpa alasan
-   [ ] Custom hook memiliki tanggung jawab yang jelas

------------------------------------------------------------------------

# 3. TypeScript Gate

-   [ ] Tidak menggunakan `any` tanpa alasan kuat
-   [ ] Return type jelas pada API publik
-   [ ] Domain type terpisah dari API type
-   [ ] Props memiliki tipe yang jelas

------------------------------------------------------------------------

# 4. Data Layer Gate

-   [ ] Service bebas React
-   [ ] Query & Mutation dipisahkan
-   [ ] Query key konsisten
-   [ ] Tidak ada fetch manual di component

------------------------------------------------------------------------

# 5. Performance Gate

-   [ ] Tidak ada duplicate request
-   [ ] Tidak ada premature optimization
-   [ ] Lazy loading dievaluasi
-   [ ] Memoization digunakan hanya bila memberi manfaat

------------------------------------------------------------------------

# 6. Memory Safety Gate

-   [ ] Event listener dibersihkan
-   [ ] Timer & interval dibersihkan
-   [ ] Observer di-disconnect
-   [ ] Subscription dilepas
-   [ ] Async dibatalkan bila memungkinkan
-   [ ] Risiko update setelah unmount dievaluasi
-   [ ] Skenario unmount dijelaskan bila relevan

------------------------------------------------------------------------

# 7. Accessibility Gate

-   [ ] Semantic HTML
-   [ ] Keyboard navigation
-   [ ] Focus management
-   [ ] Label form lengkap
-   [ ] Informasi tidak hanya bergantung pada warna
-   [ ] Target mobile minimum 44px; action utama/coarse pointer 48px
-   [ ] Search, filter, input, select, dan date control full-width pada mobile
-   [ ] Tabs memenuhi target dan tidak membuat scroll vertikal kedua
-   [ ] Satu scroll owner per page/overlay
-   [ ] Safe-area, sticky action, bottom navigation, dan keyboard tidak overlap

------------------------------------------------------------------------

# 8. Readability Gate

-   [ ] Nama jelas dan konsisten
-   [ ] Struktur file mudah dipahami
-   [ ] Tidak ada duplikasi yang tidak perlu
-   [ ] Komponen tidak menjadi God Component

------------------------------------------------------------------------

# AI Final Review Protocol

Sebelum mengirim jawaban:

1.  Review arsitektur.
2.  Review ownership.
3.  Review React rules.
4.  Review TypeScript.
5.  Review server state.
6.  Review performa.
7.  Review memory safety.
8.  Review accessibility.
9.  Refactor bila diperlukan.
10. Baru kirim implementasi.

------------------------------------------------------------------------

# Definition of Done

Implementasi dianggap selesai jika:

-   Seluruh quality gate terpenuhi.
-   Tidak ada pelanggaran Mandatory Rules.
-   Mudah dipelihara.
-   Mudah diuji.
-   Mudah dikembangkan.
-   Konsisten dengan seluruh Engineering Constitution.

------------------------------------------------------------------------

# Constitution Complete

Dokumen ini menutup seri **AI Engineering Constitution v1.0**.

Dokumen berikutnya (opsional) dapat berupa:

-   Engineering Playbook
-   Reference Implementation
-   Dashboard Pattern Catalog
-   React Pattern Catalog
-   AI Prompt Library
