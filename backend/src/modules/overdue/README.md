# Overdue module

Route manual hanya untuk leader; worker terjadwal memakai service yang sama.
Repository scan dalam batch maksimum 500, membuat notifikasi dengan event key
idempotent, dan menyimpan audit lookup bounded. Jangan menaikkan batch tanpa
melihat query plan staging.
