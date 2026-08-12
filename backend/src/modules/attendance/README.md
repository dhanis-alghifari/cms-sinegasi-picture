# Attendance module

`attendance.routes.ts` adalah pintu HTTP. Ia memeriksa auth/schema lalu
memanggil `attendance.service.ts`. Service memvalidasi use case dan
`attendance.repository.ts` menjalankan query atau RPC. Query list memakai
kolom eksplisit dan pagination; summary memakai aggregate RPC dengan fallback
rollout yang aman.

Untuk bug, baca route → service → repository → migration `026_*`.
