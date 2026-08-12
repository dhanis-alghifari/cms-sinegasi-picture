# 06-Import-Convention.md

# Import Convention

## Purpose

Menetapkan aturan import agar dependency mudah dibaca, stabil, dan bebas
circular dependency.

------------------------------------------------------------------------

# Core Principles

1.  Gunakan absolute import (`@/`) untuk source internal.
2.  Hindari relative import panjang (`../../../`).
3.  Import hanya dari layer yang diizinkan.
4.  Jangan membuat circular dependency.
5.  Gunakan barrel export hanya bila meningkatkan DX dan tidak
    menyembunyikan dependency.

------------------------------------------------------------------------

# Import Order

``` ts
// 1. React
import { useMemo } from "react";

// 2. Third-party
import { useQuery } from "@tanstack/react-query";

// 3. App / Shared
import { api } from "@/shared/api";

// 4. Feature
import { useUsersQuery } from "@/features/users/queries";

// 5. Components
import { Table } from "@/components/ui";

// 6. Relative
import "./styles.css";
```

------------------------------------------------------------------------

# Absolute Import

✅

``` ts
import { Button } from "@/components/ui";
```

❌

``` ts
import { Button } from "../../../../components/ui";
```

------------------------------------------------------------------------

# Dependency Rules

Allowed

``` text
app
 ↓
layouts
 ↓
features
 ↓
components
 ↓
shared
```

Not Allowed

``` text
shared → features
feature A → feature B (tanpa kontrak yang jelas)
```

------------------------------------------------------------------------

# Barrel Export

Gunakan bila:

-   Mempermudah public API folder.
-   Tidak menimbulkan circular dependency.

Hindari barrel export yang mengekspor seluruh project.

------------------------------------------------------------------------

# Anti Patterns

-   Relative import bertingkat banyak.
-   Import private file dari feature lain.
-   Circular dependency.
-   Import business logic ke reusable UI.

------------------------------------------------------------------------

# AI Checklist

-   [ ] Absolute import digunakan?
-   [ ] Urutan import konsisten?
-   [ ] Tidak ada circular dependency?
-   [ ] Mengikuti dependency direction?
-   [ ] Barrel export digunakan dengan tepat?

------------------------------------------------------------------------

# Next

07-TypeScript-Rules.md
