# 05-Naming-Convention.md

# Naming Convention

## Purpose

Dokumen ini menetapkan aturan penamaan agar seluruh codebase konsisten.

------------------------------------------------------------------------

# General Rules

-   Gunakan bahasa Inggris.
-   Nama harus menjelaskan tujuan.
-   Hindari singkatan yang tidak umum.
-   Konsisten di seluruh project.

------------------------------------------------------------------------

# Folder

Gunakan kebab-case.

``` text
purchase-orders
customer-assets
dashboard-overview
```

------------------------------------------------------------------------

# React Component

Gunakan PascalCase.

``` text
UserTable.tsx
DashboardHeader.tsx
PurchaseOrderDialog.tsx
```

------------------------------------------------------------------------

# Hooks

Selalu diawali `use`.

``` text
useUsersQuery.ts
useCreateUserMutation.ts
useUserDialog.ts
useDashboardFilter.ts
```

------------------------------------------------------------------------

# Query & Mutation

Pisahkan berdasarkan tanggung jawab.

``` text
queries/
├── useUsersQuery.ts
├── useUserDetailQuery.ts

mutations/
├── useCreateUserMutation.ts
├── useUpdateUserMutation.ts
└── useDeleteUserMutation.ts
```

------------------------------------------------------------------------

# Service

``` text
user.service.ts
dashboard.service.ts
purchase-order.service.ts
```

Service hanya berisi komunikasi HTTP.

------------------------------------------------------------------------

# Types

``` text
user.ts
dashboard.ts
purchase-order.ts
```

------------------------------------------------------------------------

# Constants

``` text
user.constants.ts
dashboard.constants.ts
```

------------------------------------------------------------------------

# Schema

``` text
user.schema.ts
login.schema.ts
```

------------------------------------------------------------------------

# Variables

Gunakan nama yang deskriptif.

✅

``` ts
selectedUser
filteredUsers
isDeleteDialogOpen
```

❌

``` ts
data
temp
item
obj
```

Kecuali pada callback sederhana.

------------------------------------------------------------------------

# Boolean

Gunakan prefix:

-   is
-   has
-   can
-   should

Contoh:

``` ts
isLoading
hasPermission
canEdit
shouldRefresh
```

------------------------------------------------------------------------

# Event Handler

``` ts
handleSubmit
handleDelete
handleSearch
handleDialogClose
```

------------------------------------------------------------------------

# AI Checklist

-   [ ] Nama menjelaskan tujuan?
-   [ ] Konsisten dengan feature?
-   [ ] Tidak menggunakan singkatan?
-   [ ] Hook diawali use?
-   [ ] Boolean menggunakan prefix yang benar?
-   [ ] Service sesuai domain?
