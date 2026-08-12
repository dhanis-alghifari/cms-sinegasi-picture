# Classes module

Route menyediakan options publik dan CRUD teacher. Service memvalidasi level,
duplikasi, pagination, dan soft-deactivation. Repository memakai select
eksplisit, membatasi options aktif hingga 500 baris, serta menyediakan adapter memory.
Perubahan data harus melewati audit callback;
periksa migration `033_*` bila query list melambat.
