# Aplikasi PWA Responsif & Offline

Aplikasi dapat dipasang di HP sebagai PWA, antarmuka menyesuaikan otomatis antara desktop dan mobile, serta tetap dapat digunakan di lapangan dengan dukungan offline.

## Spesifikasi

### Tujuan
Agar aplikasi dapat dipasang di perangkat HP pengguna dan tetap bisa dipakai di lapangan dengan tampilan yang otomatis menyesuaikan antara desktop dan mobile serta dukungan offline.

### Selesai bila
- Pengguna dapat menginstal aplikasi ke homescreen HP melalui menu browser dan aplikasi terbuka dengan ikon serta splash screen khas sinematografi.
- Antarmuka otomatis berubah: di desktop/tablet muncul sidebar permanen dan tabel, sedangkan di mobile muncul bottom navigation dan kartu yang bisa di-scroll; grid dashboard menyesuaikan 4/2/1 kolom sesuai lebar layar.
- Aplikasi tetap bisa dibuka dan menampilkan data yang terakhir dimuat saat koneksi terputus (offline), berkat service worker dan caching aset statis serta data API kritis.
- Semua elemen interaktif (tombol, form) memiliki target sentuh minimal 44x44px dan form memakai inputmode yang sesuai (numerik, tel, dll) di perangkat mobile.

## Task

### 1. Setup Backend Fastify & Audit Middleware

Setup server Fastify dengan TypeScript, PostgreSQL (library 'postgres'), dan middleware audit trail.

**Prompt:**

```
Di folder /backend, inisialisasi Fastify project dengan TypeScript. Install library 'postgres' untuk koneksi Supabase. Buat middleware global yang menangkap 'x-change-reason' dan 'user-id' dari header, lalu jalankan 'SET LOCAL app.current_user_id' dan 'SET LOCAL app.change_reason' dalam setiap transaksi database untuk mematuhi Zero Silent Edits. Konfigurasi CORS agar bisa diakses dari folder /frontend.
```

### 2. Pasang PWA manifest, ikon, dan splash screen

### 3. Buat dashboard grid 4/2/1 kolom responsif

### 4. Buat tabel desktop dan kartu mobile

### 5. Tambahkan service worker untuk caching offline

### 6. Terapkan touch target dan inputmode mobile

### 7. Buat skema Supabase dan migrasi data

### 8. Buat API data kritis dengan cache headers

### 9. Setup Frontend React Vite SPA

Setup project React Vite dengan TanStack Query, Zustand, Zod, dan PWA di folder terpisah.

**Prompt:**

```
Di folder /frontend, inisialisasi React Vite project. Install TanStack Query, Zustand, Zod, Tailwind, dan shadcn/ui. Buat wrapper Fetch API yang mengirimkan 'x-change-reason' di header pada setiap mutasi. Pastikan base URL API mengarah ke server Fastify di folder /backend. Konfigurasi PWA.
```

### 10. Frontend Step 1: Init & UI Framework

Inisialisasi folder /frontend dengan React Vite, TypeScript, Tailwind CSS, dan Shadcn/UI.

**Prompt:**

```
Di folder /frontend: 1. Jalankan 'npm create vite@latest . -- --template react-ts'. 2. Install tailwindcss, postcss, autoprefixer, dan inisialisasi. 3. Setup shadcn/ui (npx shadcn-ui@latest init). 4. Pastikan folder terstruktur dengan folder 'src/components', 'src/hooks', 'src/lib', dan 'src/store'.
```

### 11. Frontend Step 2: API Client & Audit Wrapper

Setup TanStack Query dan custom Fetch wrapper untuk mendukung Audit Trail Zero-Silent-Edits.

**Prompt:**

```
Di folder /frontend: 1. Install @tanstack/react-query. 2. Buat file src/lib/api.ts yang berisi wrapper function 'apiFetch'. 3. Fungsi ini harus otomatis menyertakan header 'Authorization: Bearer <token>' dan 'x-change-reason' (diambil dari session storage) pada setiap request POST/PUT/DELETE. 4. Konfigurasi QueryClientProvider di App.tsx.
```

### 12. Frontend Step 3: Auth Store & Session

Implementasi global state menggunakan Zustand untuk manajemen sesi login dan role pengguna.

**Prompt:**

```
Di folder /frontend: 1. Install zustand. 2. Buat src/store/useAuthStore.ts untuk menyimpan data user (id, nama, role) dan token. 3. Implementasikan fungsi login dan logout yang memperbarui state dan menyimpan token di cookies/localStorage. 4. Pastikan role pengguna sesuai dengan 8 tingkatan akses di PRD.
```

### 13. Frontend Step 4: PWA Configuration

Konfigurasi Vite PWA agar aplikasi dapat diinstal di HP dan memiliki fitur offline dasar.

**Prompt:**

```
Di folder /frontend: 1. Install vite-plugin-pwa. 2. Konfigurasi vite.config.ts dengan manifest yang berisi nama aplikasi 'Cinema Studio Manager', ikon 192x192 dan 512x512, serta theme_color. 3. Pastikan service worker terdaftar untuk mendukung caching aset dasar agar aplikasi bisa dibuka saat offline sesuai spesifikasi PRD.
```
