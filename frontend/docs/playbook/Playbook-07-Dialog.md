# Playbook 07 - Dialog

# Enterprise Dialog Playbook

## Purpose

Standar implementasi dialog dan modal pada Enterprise Dashboard CMS.

------------------------------------------------------------------------

# Workflow

``` text
User Action
↓
Open Dialog
↓
Load Data (optional)
↓
Interaction
↓
Confirm / Cancel
↓
Mutation
↓
Close Dialog
```

------------------------------------------------------------------------

# Dialog Types

-   Confirmation
-   Create
-   Edit
-   Detail Preview
-   Destructive Action
-   Wizard Dialog

------------------------------------------------------------------------

# Folder Structure

``` text
features/users
├── components
│   ├── UserDialog.tsx
│   ├── DeleteDialog.tsx
│   └── UserDialogActions.tsx
├── hooks
│   └── useUserDialog.ts
└── compositions
```

------------------------------------------------------------------------

# Responsibilities

## Page

-   Mengontrol kapan dialog dibuka.

## Dialog

-   Menampilkan UI.
-   Tidak melakukan HTTP langsung.

## Hook

-   Mengelola open/close state.
-   Menyimpan selected item bila diperlukan.

------------------------------------------------------------------------

# State Ownership

Open State → Local State

Selected Entity → Local State

Server Data → TanStack Query

Mutation → TanStack Mutation

------------------------------------------------------------------------

# UX Rules

-   Dialog dapat ditutup dengan Cancel.
-   Konfirmasi sebelum aksi destruktif.
-   Disable tombol saat mutation berjalan.
-   Tampilkan loading dan error dengan jelas.
-   Mobile form sederhana boleh memakai bottom/full-height sheet; pekerjaan
    panjang memakai full-screen route.
-   Header dan footer sticky berada di luar satu scroll body.
-   Tombol mobile minimum 44px; primary action 48px.
-   Footer menghormati keyboard dan `env(safe-area-inset-bottom)`.
-   Footer adalah flex item `shrink-0`; jangan memakai margin bawah negatif di
    dalam `DialogContent` yang menggunakan `overflow-hidden` karena tombol dapat
    terpotong pada viewport pendek.
-   Tombol langsung di `DialogFooter` full-width dan minimum 48px pada mobile,
    lalu boleh kembali `w-auto` dan 36px mulai breakpoint `md` pada desktop fine
    pointer. Rentang `sm` masih diperlakukan sebagai mobile/tablet.
-   Urutan mobile mengikuti DOM: secondary/cancel di atas, primary/submit di
    bawah agar action utama berada paling dekat area jempol.

------------------------------------------------------------------------

# Accessibility

-   Focus trap.
-   Escape untuk menutup jika sesuai.
-   Focus kembali ke pemicu saat dialog ditutup.
-   Gunakan semantic dialog.

------------------------------------------------------------------------

# Memory Safety

Jika dialog membuat listener, timer, observer, atau subscription,
cleanup wajib tersedia.

------------------------------------------------------------------------

# Anti Patterns

-   HTTP langsung di dialog.
-   Dialog mengandung business logic kompleks.
-   Tidak mengembalikan focus.
-   Tidak ada konfirmasi untuk delete.
-   `DialogContent overflow-y-auto` ditambah child `overflow-y-auto`.
-   Tinggi `100vh` tanpa fallback `100dvh`/safe-area pada mobile.
-   Submit berada di bawah keyboard atau bottom navigation.
-   Footer diberi `-mb-*`, transform, atau posisi absolut untuk menempel ke sisi
    bawah dialog yang menjadi clipping container.

------------------------------------------------------------------------

# Checklist

-   [ ] Hook mengelola state dialog
-   [ ] Mutation terpisah
-   [ ] Focus trap tersedia
-   [ ] Keyboard friendly
-   [ ] Cleanup diperiksa
-   [ ] Loading/Error state tersedia
-   [ ] Hanya satu body overlay menjadi scroll owner
-   [ ] Header/footer stabil dan safe-area/keyboard aware
-   [ ] Target action mobile memenuhi 44/48px
-   [ ] Footer tidak memakai offset negatif dan tetap terlihat pada viewport pendek
-   [ ] Dialog form panjang mempunyai tinggi terukur serta satu body `min-h-0 overflow-y-auto`

Guard statis sebelum merge:

```bash
npm run check:dialogs
```

Guard memeriksa seluruh consumer `DialogContent`, kepemilikan scroll dialog
panjang, offset footer terlarang, safe-area, dan kontrak ukuran tombol footer.

------------------------------------------------------------------------

# Next

Playbook 08 - Upload
