# Refactor migration notes

This refactor changes source layout and composition only. It does not change
database tables, RPC signatures, URL paths, request bodies, or response
envelopes.

## What moved

- Cash implementation files moved into `modules/cash/{ledger,reports,payment-methods,disputes,shared}`.
- Cash route registration is now behind `modules/cash/cash.module.ts`.
- Application construction is grouped under `app/dependencies` and route
  registration under `app/routes`.
- Repeated service-error response mapping is centralized in
  `shared/http/sendServiceError.ts`.
- Cash schemas are local to the cash module; shared schemas remain in
  `shared/http/schemas` only when more than one module owns the contract.

## Database impact

There is no database migration for these moves. Existing migrations and RPCs
remain the source of truth. Query hardening migrations are additive and must be
applied separately through the normal backup, staging, and rollback process.

## Safe verification

Run from `backend/` after every extraction:

```bash
npm run typecheck
npm test
npm run api:check
npm run build
```

`api:check` compares route registrations with the checked-in OpenAPI contract.
For production-scale query changes, also capture `EXPLAIN (ANALYZE, BUFFERS)`
and a bounded load-test result on an authorized staging database. A source
refactor alone cannot prove million-row latency.

## Rollback

Rollback is a source deployment rollback: restore the previous application
artifact and leave the database unchanged. Do not delete migrations or run
down-migrations for this source-only change.
