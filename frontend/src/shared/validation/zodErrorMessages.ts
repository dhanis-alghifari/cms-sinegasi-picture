import { z } from 'zod';

const FIELD_LABELS: Record<string, string> = {
  username: 'Nama pengguna',
  password: 'Kata sandi',
  current_password: 'Kata sandi saat ini',
  new_password: 'Kata sandi baru',
  confirm_password: 'Konfirmasi kata sandi',
  student_id: 'Siswa',
  borrower_id: 'Peminjam',
  equipment_id: 'Alat',
  equipment_ids: 'Peralatan',
  tanggal: 'Tanggal',
  tanggal_pinjam: 'Tanggal peminjaman',
  rencana_kembali: 'Rencana pengembalian',
  tanggal_dikembalikan: 'Tanggal pengembalian',
  effective_at: 'Tanggal mulai berlaku',
  kelas: 'Kelas',
  change_reason: 'Alasan perubahan',
  jumlah: 'Nominal',
  nominal_iuran_wajib: 'Nominal iuran wajib',
  replacement_value: 'Nilai penggantian',
  keterangan: 'Keterangan',
  catatan: 'Catatan',
  keperluan: 'Keperluan peminjaman',
  reason: 'Alasan',
  nama: 'Nama',
  nama_lomba: 'Nama lomba',
  nama_alat: 'Nama alat',
  kode_alat: 'Kode alat',
  kota: 'Kota',
  title: 'Judul',
  date: 'Tanggal',
  deadline: 'Batas waktu',
  category: 'Kategori',
  role: 'Peran pengguna',
  status: 'Status',
  kondisi: 'Kondisi alat',
  foto_urls: 'Foto alat',
  bukti_sanggahan_url: 'Foto bukti pembayaran',
  link_video: 'Tautan video',
  contest_id: 'Lomba',
  sutradara_id: 'Sutradara atau pembuat karya',
  judul_film: 'Judul film',
  work_type_code: 'Jenis karya',
  tahun_event: 'Tahun event',
  assignment_id: 'Tugas atau kegiatan',
};

function getFieldLabel(path?: PropertyKey[]): string {
  if (!path) return 'Data ini';
  const key = path.at(-1);
  if (typeof key !== 'string') return 'Data ini';
  return FIELD_LABELS[key] ?? 'Data ini';
}

z.config({
  customError: (issue) => {
    const label = getFieldLabel(issue.path);

    if (issue.code === 'invalid_type' && issue.input === undefined) {
      return `${label} wajib diisi.`;
    }
    if (issue.code === 'invalid_value' && issue.input === undefined) {
      return `${label} wajib dipilih.`;
    }
    if (issue.code === 'invalid_type') {
      return `${label} memiliki jenis data yang tidak sesuai.`;
    }
    if (issue.code === 'invalid_format') {
      return `${label} memiliki format yang tidak valid.`;
    }
    if (issue.code === 'too_small') {
      return `${label} belum memenuhi batas minimal.`;
    }
    if (issue.code === 'too_big') {
      return `${label} melebihi batas yang diperbolehkan.`;
    }

    return `Periksa kembali ${label.toLowerCase()}.`;
  },
});
