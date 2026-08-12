# 23-CRUD-Synchronization-and-Images.md

# Standar Sinkronisasi CRUD dan Gambar

Dokumen ini adalah checklist wajib untuk fitur tambah/edit yang datanya harus langsung tampil.

## Alur sumber kebenaran

```text
Form → Mutation → Backend persistence → invalidate active query → refetch API → Table
```

- Mutation wajib menunggu (`await`) invalidasi dan refetch query aktif.
- Jangan prepend/update semua varian cache paginasi secara manual.
- Query key list, detail, summary, dan dashboard harus terdaftar di `QUERY_KEYS`.
- Backend GET dan mutation harus memakai sumber data yang sama; jangan mencampur database dengan in-memory store.
- Endpoint data terautentikasi dan mutable menggunakan `Cache-Control: private, no-store`.
- Setelah tambah, reset filter/page bila filter aktif dapat menyembunyikan record baru.
- Saat dialog dibuka ulang, reset error mutation agar error operasi sebelumnya tidak terbawa.

## Upload gambar

- Validasi MIME dan ukuran file di client serta backend.
- Kompres gambar sebelum dikirim; batas frontend saat ini 5 MB sumber dan 600 KB hasil.
- Simpan preview pada field form yang sama dengan payload API.
- Sediakan preview, hapus, error, dan status pemrosesan.
- Bersihkan object URL dan reset input file saat dialog ditutup.
- Pastikan kolom database gambar kompatibel dengan payload API dan memiliki fallback untuk data lama.

## Diagnosis masalah data tidak langsung muncul

Periksa urutan berikut:

1. Response mutation berhasil dan data benar-benar tersimpan di backend.
2. GET list membaca sumber data yang sama dengan POST/PUT/PATCH.
3. Browser/API response tidak memakai cache lama.
4. Query key invalidasi sama dengan query key yang dirender halaman.
5. Invalidation ditunggu sampai refetch selesai.
6. Filter, pagination, atau sort tidak menyembunyikan record baru.

