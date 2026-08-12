# Borrowing module

Alur baca berada di `borrowing.read.*`; perubahan state berada di
`borrowing.mutations.*`. Route menangani auth, schema, dan audit. Service menjaga
ownership, state transition, dan idempotency. Repository menyembunyikan RPC
atomic/Supabase serta memory adapter lokal. Untuk bug pengembalian, mulai dari
mutations route → service → repository → migration/RPC.
