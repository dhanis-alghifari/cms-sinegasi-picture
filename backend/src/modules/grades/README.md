# Grades module

Route menjaga RBAC, schema, dan audit. Service memvalidasi assignment, bounded
bulk payload, dan distribusi. Repository memakai select/pagination eksplisit dan
RPC `record_grades_bulk_atomic`. Query distribusi harus tetap aggregate di
database, bukan memindahkan seluruh nilai ke Node.
