# Students module

Route menangani options dan lifecycle student. Service mengatur validasi profil,
provisioning akun, pengaitan akun lama, dan status alumni. Akun baru dibuat
bersama profil siswa; akun operasional tidak dibuat dari jalur ini. Guru dengan
`users.manage` dapat mencari akun siswa lama yang aktif tetapi belum tertaut,
lalu menautkannya ke profil baru atau profil siswa aktif yang sudah ada tanpa
mengganti username atau password.
Repository memakai explicit select, bounded search/pagination, dan memory
adapter. Password hash tidak pernah masuk DTO atau audit value.
