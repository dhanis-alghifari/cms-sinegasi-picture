# Auth module

`auth.routes.ts` menangani login dan ganti password. `auth.service.ts` mengatur
verifikasi hash, JWT payload, dan policy password. `auth.repository.ts` adalah
satu-satunya adapter akun Supabase; `auth.identity.ts` menyelesaikan hubungan
user/student dan cache identitas. Mock login hanya boleh aktif pada development.

Untuk bug login, cek konfigurasi environment → route guard → service → repository.
