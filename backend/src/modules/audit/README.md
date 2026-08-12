# Audit module

Route audit hanya expose read endpoint teacher. Service memvalidasi filter,
UUID, tanggal, dan pagination; repository mengambil log dengan select eksplisit
serta RPC write yang immutable. Jangan menaruh password, token, atau data rahasia
di `newValues` audit.

Semua response domain tetap menyertakan UUID `*_by` sebagai sumber kebenaran dan
dapat menambahkan proyeksi `*_actor` berisi nama, username, serta role. Hook
aplikasi menyelesaikan seluruh aktor dalam satu query batch per response dan
mempertahankan snapshot immutable untuk riwayat lama. Jalankan migration 035–037
sebelum memakai audit RBAC atau audit mutasi password/nilai.

Repository audit juga melakukan redaction rekursif saat membaca `old_values` dan
`new_values`. Ini melindungi response dari baris legacy sebelum migration 017;
database trigger memastikan baris baru sudah ter-redact sebelum disimpan.
