# Contests module

Route menggabungkan authentication, capability, schema, dan audit. Service
menjaga aturan submission dan status kontes. Repository menangani query bounded,
summary aggregate, win-rate view, serta unique constraint film. Perubahan
kontrak submission harus additive dan dicatat di OpenAPI.

Pencatatan hasil lama (`POST /api/contest-entries/:id/results`) hanya tersedia
sebagai respons deprecation dan tidak mengubah data. Gunakan alur transisi
pipeline lalu `POST /api/contest-entries/:id/finalize` dengan bukti R2 yang
terverifikasi; migration `065_disable_legacy_mutation_paths.sql` menonaktifkan
RPC lama setelah migration 053 terpasang.
