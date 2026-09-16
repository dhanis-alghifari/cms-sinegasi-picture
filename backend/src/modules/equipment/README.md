# Equipment module

Route menjaga schema dan role `equipment_team`. Service memvalidasi enum,
pagination, foto, dan konflik borrowing. Repository memakai select eksplisit,
summary count, reservation lookup, report snapshot, serta memory adapter. Endpoint
`GET /api/equipment/report` mengembalikan summary, breakdown, item perhatian, dan
rows dengan batas 2.000 unit. URL foto tidak pernah di-fetch server sehingga tidak
membuka jalur SSRF.

Pemulihan alat memakai `equipment_recovery_cases`: kasus `repair` wajib ditutup
dengan minimal dua foto verifikasi dan checklist pemeriksaan akhir, lalu
mengembalikan unit ke `tersedia`; kasus
`replacement` mendaftarkan unit fisik baru (minimal tiga foto) dan menandai unit
lama `lost` atau `retired`. Tagihan kerusakan/penggantian dicatat di
`equipment_charge_settlements`; trigger database menolak persetujuan peminjaman
saat tagihan siswa masih `unpaid` atau `partial`. Jalankan migration
`063_equipment_recovery_and_charges.sql` setelah migration 060 dan 062.

Pembayaran dicatat sebagai event incremental melalui
`POST /api/equipment/charges/:id/payments`. Setiap event membutuhkan minimal satu
bukti pembayaran; bukti perbaikan atau penggantian dapat dilampirkan pada event
yang sama. File disimpan sebagai metadata private R2 dan diverifikasi dengan
HEAD sebelum transaksi atomic dijalankan. Jalankan migration
`064_equipment_charge_payment_evidence.sql` setelah migration 063.
Frontend mengirim `X-Idempotency-Key` pada event pembayaran agar retry request
yang sama diputar ulang dari cache idempotency, bukan diproses dua kali.

Endpoint PATCH pembayaran lama tetap dipertahankan hanya untuk memberi respons
deprecation dan tidak lagi menulis data. Jalankan migration
`065_disable_legacy_mutation_paths.sql` setelah 064 untuk menonaktifkan RPC lama
di database.
