Selalu gunakan repository guideline berikut sebagai source of truth.

docs/engineering-constitution/
docs/playbook/

Ikuti seluruh aturan yang relevan.

Jika ada konflik:

Engineering Constitution selalu memiliki prioritas lebih tinggi daripada Playbook.

Rencana perubahan aplikasi menjadi responsive web app tersedia di:

`docs/responsive-webapp/README.md`

Untuk setiap perubahan mobile control, tab, filter, form, dialog, sheet, sticky
action, atau pagination, baca dan ikuti:

`docs/responsive-webapp/10-mobile-reachability-and-control-spec.md`

Selalu:

- analisis requirement dahulu
- tentukan architecture
- tentukan folder ownership
- tentukan data flow
- baru mulai coding
- inventarisasi seluruh permukaan data, termasuk tabel/list di page, tab,
  report, dialog, dan sheet; jangan hanya memeriksa tabel utama
- ikuti `docs/playbook/Playbook-03-Table.md` untuk setiap collection dan
  pastikan presentasi mobile bukan tabel desktop yang sekadar dapat digeser
- ukur hit-area rendered UI, bukan hanya ukuran ikon; target mobile minimum 44px
  dan action utama/coarse pointer 48px
- tetapkan satu pemilik scroll vertikal per page atau overlay; tab strip hanya
  boleh melakukan scroll horizontal jika pola equal-width tidak memadai
- pastikan search/filter/form full-width pada mobile, aman dari keyboard virtual,
  bottom navigation, dan safe-area

Sebelum selesai, lakukan self-review menggunakan Final Checklist.
