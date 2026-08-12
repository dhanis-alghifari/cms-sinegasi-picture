# 07-TypeScript-Rules.md

# TypeScript Rules

## Purpose

Menetapkan standar penggunaan TypeScript agar type system menjadi alat
desain, bukan sekadar pelengkap.

------------------------------------------------------------------------

# Core Principles

1.  Type safety lebih penting daripada kecepatan menulis.
2.  Hindari `any`.
3.  Gunakan inference jika sudah jelas.
4.  Gunakan interface untuk kontrak objek yang akan diperluas.
5.  Gunakan type untuk union, utility type, dan komposisi tipe.

------------------------------------------------------------------------

# Preferred Order

Requirement ↓ Domain Model ↓ Type Definition ↓ Implementation

Jangan menulis implementasi sebelum tipe utama jelas.

------------------------------------------------------------------------

# Rules

## Avoid `any`

❌

``` ts
const user: any = {}
```

✅

``` ts
interface User {
  id: string
  name: string
}
```

------------------------------------------------------------------------

## Explicit Return Type

Tambahkan return type pada fungsi publik, service, hook, dan utility.

``` ts
export function formatPrice(value: number): string {
  return value.toLocaleString()
}
```

### Numeric and monetary display

Jangan memformat angka langsung di JSX dengan `toLocaleString`, `toFixed`, atau
`Intl.NumberFormat` yang berbeda-beda. Gunakan utilitas bersama:

``` ts
formatNumber(10000.75) // "10,000.75"
formatCurrency(3450000) // "Rp 3,450,000"
```

Payload API tetap menggunakan `number`; separator hanya untuk display dan input
yang terlihat oleh pengguna. Komponen input numerik harus mem-parsing kembali
nilai ke `number` sebelum submit.

------------------------------------------------------------------------

## Domain Types

Simpan type berdasarkan domain.

``` text
features/users/types/user.ts
features/orders/types/order.ts
```

------------------------------------------------------------------------

## API Types

Pisahkan request dan response.

``` text
CreateUserRequest
CreateUserResponse

UpdateUserRequest
UpdateUserResponse
```

------------------------------------------------------------------------

## Props

Gunakan interface.

``` ts
interface UserCardProps {
  user: User
}
```

------------------------------------------------------------------------

## Enums

Gunakan string union bila memungkinkan.

✅

``` ts
type Status = "draft" | "published"
```

------------------------------------------------------------------------

# Anti Patterns

-   any
-   as any
-   Object
-   Function
-   Type yang terlalu umum
-   Mencampur domain type dengan API type

------------------------------------------------------------------------

# Decision Tree

``` text
Need a new type?
      │
      ▼
Domain?
 │          │
Yes        No
 │          │
 ▼          ▼
Feature     Shared
```

------------------------------------------------------------------------

# AI Checklist

-   [ ] Tidak menggunakan any?
-   [ ] Return type jelas?
-   [ ] Domain type dipisahkan?
-   [ ] Props menggunakan interface?
-   [ ] Request & Response dipisahkan?
-   [ ] Type mudah dibaca enam bulan lagi?

------------------------------------------------------------------------

# Next

08-React-Rules.md
