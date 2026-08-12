# 20-Accessibility.md

# Accessibility Guidelines

## Status

Mandatory

## Purpose

Menetapkan standar aksesibilitas agar seluruh Dashboard CMS dapat
digunakan dengan keyboard, screen reader, dan berbagai perangkat bantu.

------------------------------------------------------------------------

# Core Principles

-   Accessibility adalah bagian dari kualitas produk.
-   Komponen reusable harus accessibility-first.
-   Jangan mengorbankan aksesibilitas demi visual.

------------------------------------------------------------------------

# Keyboard Support

Seluruh interaksi penting harus dapat dilakukan menggunakan keyboard.

Checklist:

-   Tab
-   Shift + Tab
-   Enter
-   Escape
-   Arrow Keys (bila relevan)

------------------------------------------------------------------------

# Semantic HTML

Gunakan elemen HTML sesuai fungsinya.

✅ button untuk aksi

✅ form untuk input

✅ nav untuk navigasi

❌ div sebagai tombol tanpa alasan.

------------------------------------------------------------------------

# Forms

-   Setiap input memiliki label.
-   Error mudah dibaca.
-   Required field jelas.
-   Focus berpindah ke error pertama bila submit gagal.

------------------------------------------------------------------------

# Dialog

Dialog harus:

-   Trap focus.
-   Dapat ditutup dengan Escape (jika sesuai).
-   Mengembalikan focus ke pemicu saat ditutup.

------------------------------------------------------------------------

# Tables

-   Gunakan table semantic.
-   Header jelas.
-   Caption bila diperlukan.
-   Jangan gunakan table hanya untuk layout.
-   Gunakan table interaktif pada layar yang cukup lebar untuk membaca dan
    membandingkan kolomnya.
-   Pada mobile, ubah collection biasa menjadi list/card semantic; jangan hanya
    membungkus table dengan horizontal scroll.
-   Card mobile wajib mempertahankan nama record, status, nilai keputusan, dan
    akses menuju detail lengkap.
-   Horizontal scroll hanya untuk matrix/perbandingan intrinsik dan wajib
    memiliki affordance, sticky identifier bila perlu, serta alternatif detail.
-   Tabel print/export yang tersembunyi tidak boleh dapat difokuskan atau dibaca
    screen reader pada mode layar.

------------------------------------------------------------------------

# Icons

Ikon dekoratif disembunyikan dari screen reader.

Ikon bermakna harus memiliki label yang sesuai.

------------------------------------------------------------------------

# Color

Jangan mengandalkan warna saja untuk menyampaikan informasi.

Tambahkan teks, ikon, atau indikator lain.

------------------------------------------------------------------------

# Focus Management

-   Focus selalu terlihat.
-   Jangan menghilangkan outline tanpa pengganti.
-   Perpindahan focus harus logis.

------------------------------------------------------------------------

# Target Size dan Touch

WCAG 2.2 SC 2.5.8 level AA menetapkan minimum 24×24 CSS px dengan sejumlah
pengecualian. Proyek memakai baseline ergonomi yang lebih tinggi:

- seluruh target sentuh mobile minimum 44×44 CSS px;
- primary action dan control utama pada coarse pointer minimum 48px;
- jarak antartarget berdekatan minimum 8px;
- ukuran diukur pada parent interaktif rendered UI, bukan dari ukuran ikon;
- label checkbox/radio menjadi bagian target;
- tidak ada aksi yang hanya tersedia melalui hover atau gesture kompleks.

Mode compact desktop tidak boleh aktif hanya karena viewport lebar jika perangkat
masih memakai coarse pointer.

------------------------------------------------------------------------

# Tabs, Filter, dan Form Mobile

- tab 2–3 item menggunakan trigger equal-width minimum 48px;
- horizontal tab strip tidak boleh memiliki overflow vertikal;
- search/filter/input/select/date control full-width pada mobile;
- font input minimum 16px;
- bottom sheet filter mengembalikan focus ke trigger;
- keyboard virtual tidak menutup field aktif atau action submit;
- hanya satu body dalam dialog/sheet yang menjadi scroll owner.

------------------------------------------------------------------------

# Performance

Accessibility tidak boleh dihilangkan demi optimasi kecil.

------------------------------------------------------------------------

# Anti Patterns

❌ Clickable div.

❌ Input tanpa label.

❌ Dialog tanpa focus trap.

❌ Warna sebagai satu-satunya indikator.

------------------------------------------------------------------------

# Code Review Checklist

-   [ ] Keyboard friendly?
-   [ ] Semantic HTML?
-   [ ] Label tersedia?
-   [ ] Focus management benar?
-   [ ] Dialog dapat dioperasikan?
-   [ ] Informasi tidak hanya bergantung pada warna?
-   [ ] Collection mobile dapat dipahami tanpa membaca tabel desktop terkompresi?
-   [ ] Field dan action penting tetap dapat ditemukan melalui card atau detail?
-   [ ] Hit-area mobile minimum 44px dan primary/coarse control 48px?
-   [ ] Target dinilai dari parent interaktif rendered UI?
-   [ ] Tabs, filter, form, keyboard, dan scroll ownership dapat digunakan?

------------------------------------------------------------------------

# AI Checklist

Saat membuat UI:

-   Evaluasi keyboard navigation.
-   Evaluasi focus.
-   Evaluasi label.
-   Evaluasi semantic HTML.
-   Jelaskan trade-off bila menyimpang.

------------------------------------------------------------------------

# Next

21-Code-Review.md
