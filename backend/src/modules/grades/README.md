# Grades module

Route menjaga RBAC, schema, dan audit. Service memvalidasi assignment, bounded
bulk payload, distribusi, serta lifecycle raport semester. Repository memakai
select/pagination eksplisit dan RPC `record_grades_bulk_atomic`.

Raport hanya menerbitkan predikat A–E. Nilai akhir dihitung dari bukti nilai
tugas dan presensi efektif; periode PKL yang berstatus `approved` atau
`completed` dikelola di `student_pkl_periods` dan dikeluarkan dari penalti alpha.
Raport dibuat sebagai draft, ditinjau, lalu disahkan guru. Query distribusi
tetap harus aggregate di database, bukan memindahkan seluruh nilai ke Node.
