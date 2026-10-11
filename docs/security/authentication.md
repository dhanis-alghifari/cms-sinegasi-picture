# Batas percobaan login

Login menggunakan dua hitungan kegagalan: username yang sudah di-trim dan
dinormalisasi ke huruf kecil, serta kombinasi IP dan username tersebut. Mengganti
IP tidak menghapus hitungan akun. Kunci penyimpanan di-hash; limiter tidak
menyimpan password maupun username/IP mentah dalam kuncinya.

Defaultnya 10 kegagalan dalam 5 menit. Setelah batas tercapai, respons login adalah
429 dengan `Retry-After`. Batas ini menghitung kegagalan yang telah selesai, bukan
reservasi atomik sebelum verifikasi password: sejumlah permintaan bersamaan masih
dapat lolos pemeriksaan awal. Pembatasan API umum melengkapi kontrol ini.

Deployment publik memerlukan RPC migration
`027_resilience_stores.sql`: `is_login_rate_limited`,
`record_login_failure`, dan `clear_login_rate_limit`. Saat pemeriksaan, pencatatan,
atau penghapusan hitungan gagal, login ditolak sementara dengan 503 dan
`Retry-After: 5`; tidak ada token yang dikirim. Setiap RPC dibatasi 2 detik.
Fallback memori hanya diperbolehkan untuk development lokal yang terisolasi.
Memori dibatasi dan menolak kunci baru saat penuh, bukan membuang hitungan aktif.

Hitungan akun global mengurangi brute force dari banyak IP, tetapi penyerang yang
mengetahui username dapat sengaja mengunci login pengguna sementara. Jendela
5 menit membatasi durasinya; pemantauan lonjakan kegagalan dan pemulihan akun
yang terverifikasi tetap perlu. Pembatasan ini tidak menggantikan MFA atau
penjagaan di reverse proxy. Prinsip dan trade-off ini mengikuti
[OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#account-lockout).

Perubahan namespace kunci tidak memindahkan hitungan legacy per-IP yang sudah ada;
hitungan versi baru mulai saat rilis ini dipasang. Tidak ada data Supabase lama
yang diubah atau dihapus oleh pekerjaan kode lokal ini.
