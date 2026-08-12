# Contests module

Route menggabungkan authentication, capability, schema, dan audit. Service
menjaga aturan submission dan status kontes. Repository menangani query bounded,
summary aggregate, win-rate view, serta unique constraint film. Perubahan
kontrak submission harus additive dan dicatat di OpenAPI.
