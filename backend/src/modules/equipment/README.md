# Equipment module

Route menjaga schema dan role `equipment_team`. Service memvalidasi enum,
pagination, foto, dan konflik borrowing. Repository memakai select eksplisit,
summary count, reservation lookup, serta memory adapter. URL foto tidak pernah
di-fetch server sehingga tidak membuka jalur SSRF.
