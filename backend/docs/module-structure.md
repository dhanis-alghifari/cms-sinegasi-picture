# Module structure guide

The backend is a modular monolith. A module owns a business capability and
exposes a small interface to the application composition root.

## Deep-module rule

The application should learn as little as possible about an implementation.
The cash application seam is `createCashModule()` and `registerCashRoutes()`.
The application does not need to know which repository is Supabase-backed or
which arrays form the local memory adapter.

## When to create a subfolder

Create a subfolder when a feature has multiple stable business capabilities or
multiple independent reasons to change. Do not create folders only to satisfy a
line-count rule. A small feature with four files is easier to maintain flat.

## Public vs local code

Global code belongs in `src/shared` only when multiple modules use the same
contract. Feature-specific schemas, DTOs, mappers, and helpers stay inside the
feature. Cash HTTP schemas therefore live in `modules/cash/shared/http`, while
generic authenticated response schemas remain in `src/shared/http/schemas`.
