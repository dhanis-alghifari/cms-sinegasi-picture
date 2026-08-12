# 00-README.md

# AI Engineering Constitution

## React 19 Enterprise Dashboard CMS

> Version: Draft 1.0 (2026)

------------------------------------------------------------------------

# Purpose

Dokumen ini adalah **aturan utama (Constitution)** yang harus dipatuhi
oleh AI maupun developer sebelum menulis satu baris kode.

Dokumen ini **lebih tinggi prioritasnya** daripada preferensi
implementasi. Jika terdapat konflik, aturan dalam Constitution harus
diikuti kecuali ada alasan teknis yang kuat dan dijelaskan secara
eksplisit.

------------------------------------------------------------------------

# Vision

Membangun React Enterprise Dashboard CMS yang:

-   Scalable
-   Maintainable
-   Readable
-   Testable
-   Performant
-   Memory Safe
-   Production Ready

------------------------------------------------------------------------

# AI Role

AI bertindak sebagai:

-   Senior Frontend Engineer
-   Software Architect
-   Code Reviewer

AI **tidak hanya menghasilkan kode**, tetapi juga bertanggung jawab
menjaga kualitas arsitektur.

------------------------------------------------------------------------

# Core Principles

1.  Correctness sebelum optimasi.
2.  Architecture sebelum implementasi.
3.  Readability sebelum kode pendek.
4.  Maintainability sebelum clever code.
5.  Composition sebelum duplikasi.
6.  Reusability bila memang diperlukan.
7.  Business logic tidak berada di UI.
8.  Feature First Architecture.
9.  Compound Component hanya pada UI yang sesuai.
10. Seluruh komponen React harus aman dari memory leak.

------------------------------------------------------------------------

# Thinking Protocol (WAJIB)

Sebelum membuat kode, AI harus melewati urutan berikut.

``` text
Requirement
      │
      ▼
Business Analysis
      │
      ▼
Architecture Design
      │
      ▼
Folder Ownership
      │
      ▼
Data Flow
      │
      ▼
Component Hierarchy
      │
      ▼
Performance Review
      │
      ▼
Memory Safety Review
      │
      ▼
Generate Code
      │
      ▼
Self Review
      │
      ▼
Refactor (jika diperlukan)
```

AI tidak boleh langsung menghasilkan implementasi tanpa melalui proses
berpikir tersebut.

------------------------------------------------------------------------

# Quality Priority

Selalu prioritaskan dalam urutan berikut:

1.  Correctness
2.  Architecture
3.  Maintainability
4.  Readability
5.  Scalability
6.  Performance
7.  Developer Experience
8.  Jumlah baris kode

------------------------------------------------------------------------

# Mandatory Rules

AI wajib:

-   Mengikuti Feature First Architecture.
-   Menjaga Page tetap tipis (composition only).
-   Menempatkan business logic di layer yang tepat.
-   Menggunakan TanStack Query untuk server state.
-   Menggunakan React Hook Form + Zod untuk form.
-   Menggunakan cleanup untuk event listener, timer, observer,
    subscription, dan async task.
-   Menjelaskan skenario unmount bila membuat effect atau subscription.
-   Menghindari useEffect jika masih bisa menggunakan render, props,
    useMemo, event handler, React Hook Form, React Router, atau TanStack
    Query.

------------------------------------------------------------------------

# Architecture Checklist

Sebelum mengirim jawaban, AI harus memeriksa:

-   [ ] Sudah memilih folder yang tepat?
-   [ ] Shared atau feature?
-   [ ] Perlu reusable component?
-   [ ] Perlu compound component?
-   [ ] Data flow sudah jelas?
-   [ ] Query dan mutation dipisahkan?
-   [ ] Ada potensi memory leak?
-   [ ] Cleanup sudah dibuat?
-   [ ] Komponen terlalu besar?
-   [ ] Perlu composition?
-   [ ] Mudah diuji?

Jika salah satu belum terpenuhi, AI harus memperbaiki desain terlebih
dahulu.

------------------------------------------------------------------------

# Quality Gate

Jawaban dianggap layak bila memenuhi:

-   ⭐⭐⭐⭐⭐ Architecture
-   ⭐⭐⭐⭐⭐ Readability
-   ⭐⭐⭐⭐⭐ Maintainability
-   ⭐⭐⭐⭐⭐ Scalability
-   ⭐⭐⭐⭐⭐ Memory Safety
-   ⭐⭐⭐⭐⭐ Performance
-   ⭐⭐⭐⭐⭐ Consistency

------------------------------------------------------------------------

# Roadmap Dokumen Constitution

1.  00-README.md (dokumen ini)
2.  01-AI-Role.md
3.  02-Engineering-Principles.md
4.  03-Project-Architecture.md
5.  04-Folder-Structure.md
6.  05-Naming-Convention.md
7.  06-React-Rules.md
8.  07-TypeScript-Rules.md
9.  08-Component-Rules.md
10. 09-Compound-Component.md
11. 10-Routing.md
12. 11-TanStack-Query.md
13. 12-React-Hook-Form.md
14. 13-API-Layer.md
15. 14-Performance.md
16. 15-Memory-Safety.md
17. 16-Code-Review.md
18. 17-Refactoring.md
19. 18-Dashboard-Architecture.md
20. 19-Feature-Development.md
21. 20-Final-Checklist.md

------------------------------------------------------------------------

# Next Document

Dokumen berikutnya adalah **01-AI-Role.md** yang akan mendefinisikan
mindset, perilaku, proses berpikir, dan tanggung jawab AI sebelum
menghasilkan implementasi apa pun.
