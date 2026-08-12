# 02-Engineering-Principles.md

# Engineering Principles

> Dokumen ini berisi prinsip desain yang wajib menjadi dasar setiap
> keputusan implementasi.

# Purpose

Tujuan dokumen ini adalah memastikan seluruh codebase tetap konsisten,
mudah dipelihara, dan dapat berkembang tanpa refactor besar.

------------------------------------------------------------------------

# Core Principles

## 1. Architecture Before Implementation

Jangan mulai dari kode.

Urutan wajib:

Requirement → Architecture → Folder → Data Flow → Component Hierarchy →
Implementation

------------------------------------------------------------------------

## 2. Feature First

Business logic selalu berada di dalam feature.

Good

features/users/services

Bad

services/user.service.ts (global tanpa alasan)

------------------------------------------------------------------------

## 3. Separation of Concerns

Pisahkan tanggung jawab.

-   Page = composition
-   Component = UI
-   Hook = UI behavior
-   Query = server state
-   Mutation = write server state
-   Service = HTTP
-   Schema = validation
-   Utils = pure function

------------------------------------------------------------------------

## 4. Single Responsibility

Setiap file memiliki satu tanggung jawab.

Bad

UserPage - fetch - form - table - dialog - validation - mapping

Good

UserPage → UserTable → UserFilter → UserDialog

------------------------------------------------------------------------

## 5. Composition Over Complexity

Jika sebuah page mulai membesar, pecah menjadi composition.

DashboardPage └── DashboardOverview ├── DashboardStats ├──
DashboardCharts └── DashboardActivity

------------------------------------------------------------------------

## 6. Business Logic Tidak di UI

UI tidak boleh:

-   fetch API
-   mapping kompleks
-   validation
-   business rules

------------------------------------------------------------------------

## 7. Shared vs Feature

Gunakan shared hanya jika dipakai lintas feature.

Decision:

Used by one feature? → tetap di feature

Used by three atau lebih feature? → evaluasi pindah ke shared/components

------------------------------------------------------------------------

## 8. Abstraction Rule

Jangan membuat abstraction terlalu cepat.

Hindari reusable component yang baru dipakai satu kali.

------------------------------------------------------------------------

## 9. Dependency Direction

Arah dependency:

app ↓ layouts ↓ features ↓ components ↓ shared

Feature tidak boleh saling bergantung langsung tanpa alasan yang jelas.

------------------------------------------------------------------------

## 10. Page Rules

Page bertugas:

-   compose component
-   memanggil query/mutation
-   menghubungkan state

Page tidak boleh menjadi tempat seluruh logika aplikasi.

Target ukuran:

30--80 baris (ideal) \<150 baris (masih dapat diterima)

Jika lebih besar, evaluasi composition.

------------------------------------------------------------------------

# Engineering Checklist

Sebelum membuat kode:

-   [ ] Sudah memilih ownership?
-   [ ] Tanggung jawab file jelas?
-   [ ] Ada business logic di UI?
-   [ ] Perlu composition?
-   [ ] Perlu shared?
-   [ ] Terlalu banyak abstraction?
-   [ ] Mudah dibaca enam bulan lagi?

------------------------------------------------------------------------

# Common Anti-Patterns

❌ Massive Page Component

❌ Fetch di banyak widget dashboard

❌ Reusable component terlalu dini

❌ useEffect untuk derived state

❌ Utility berisi business logic

❌ Shared menjadi tempat semua kode

------------------------------------------------------------------------

# AI Reminder

Setiap implementasi harus lebih mengutamakan:

Architecture → Readability → Maintainability → Scalability → Performance

Bukan jumlah baris kode.

------------------------------------------------------------------------

# Next Document

03-Project-Architecture.md

Fokus: - Struktur project dari kosong - Evolusi folder per fase -
Dashboard architecture - Data flow - Composition flow
