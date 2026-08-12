// Human-readable labels for technical enum/resource values.
// These helpers only affect presentation; API values and filter values stay unchanged.

const RESOURCE_LABELS: Record<string, string> = {
  users: 'Pengguna',
  students: 'Siswa',
  classes: 'Kelas',
  attendance: 'Absensi',
  assignments: 'Tugas',
  grades: 'Nilai',
  equipment: 'Peralatan',
  borrowings: 'Peminjaman',
  borrowing_items: 'Detail peminjaman alat',
  cash_transactions: 'Transaksi kas',
  cash_settings: 'Pengaturan kas',
  debt_records: 'Tunggakan kas',
  cash_disputes: 'Sanggahan kas',
  cash_billing_runs: 'Penagihan kas',
  contests: 'Lomba',
  contest_members: 'Anggota lomba',
  contest_films: 'Karya lomba',
  film_works: 'Karya film',
  film_crew: 'Kru film',
  activity_logs: 'Audit trail',
  notifications: 'Notifikasi',
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  INSERT: 'Menambahkan data',
  UPDATE: 'Mengubah data',
  UPSERT: 'Menyimpan atau memperbarui data',
  DELETE: 'Menghapus data',
  SYSTEM_CHECK: 'Pemeriksaan sistem',
};

const ROLE_LABELS: Record<string, string> = {
  teacher: 'Guru Pembina',
  leader: 'Ketua Ekskul',
  vice_leader: 'Wakil Ketua',
  treasurer: 'Bendahara',
  secretary: 'Sekretaris',
  equipment_team: 'Tim Alat',
  contest_team: 'Tim Lomba',
  member: 'Siswa / Anggota',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktif',
  inactive: 'Nonaktif',
  pending: 'Menunggu',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  borrowed: 'Dipinjam',
  returned: 'Dikembalikan',
  partial: 'Sebagian diproses',
  menunggu_persetujuan: 'Menunggu persetujuan',
  disetujui: 'Disetujui',
  ditolak: 'Ditolak',
  dipinjam: 'Dipinjam',
  dikembalikan: 'Dikembalikan',
  terlambat: 'Terlambat',
  tersedia: 'Tersedia',
  dipesan: 'Dipesan',
  maintenance: 'Dalam perbaikan',
  bagus: 'Bagus',
  sedikit_kerusakan: 'Sedikit rusak',
  rusak: 'Rusak',
  rusak_besar: 'Rusak berat',
  sedang_diperbaiki: 'Sedang diperbaiki',
  hilang: 'Hilang',
  hadir: 'Hadir',
  sakit: 'Sakit',
  izin: 'Izin',
  alpha: 'Alpha',
  unpaid: 'Belum lunas',
  paid: 'Lunas',
  resolved: 'Diselesaikan',
  buka: 'Buka pendaftaran',
  proses_penjurian: 'Proses penjurian',
  selesai: 'Selesai',
  progres: 'Sedang berjalan',
  dilombakan: 'Dilombakan',
};

const ENUM_LABELS: Record<string, string> = {
  class_task: 'Tugas kelas',
  crew_film: 'Kru film',
  event_participation: 'Partisipasi event',
  other: 'Lainnya',
  iuran_wajib: 'Iuran wajib',
  pemasukan: 'Pemasukan',
  pengeluaran: 'Pengeluaran',
  masuk: 'Pemasukan',
  keluar: 'Pengeluaran',
  cash: 'Cash',
  qris_dana: 'QRIS DANA',
  qris_gopay: 'QRIS GoPay',
  Lokal: 'Lokal',
  Regional: 'Regional',
  Nasional: 'Nasional',
  Internasional: 'Internasional',
};

const FIELD_LABELS: Record<string, string> = {
  id: 'ID',
  user_id: 'Pengguna',
  student_id: 'Siswa',
  student_nis: 'NIS siswa',
  student_nama: 'Nama siswa',
  borrower_id: 'Peminjam',
  assignment_id: 'Tugas',
  equipment_id: 'Alat',
  equipment_ids: 'Daftar alat',
  borrowing_id: 'Peminjaman',
  transaction_id: 'Transaksi',
  nama_alat: 'Nama alat',
  kode_alat: 'Kode alat',
  is_active: 'Status aktif',
  status: 'Status',
  type: 'Jenis',
  tipe: 'Jenis transaksi',
  category: 'Kategori',
  kelas: 'Kelas',
  role: 'Peran',
  change_reason: 'Alasan perubahan',
  created_by: 'Dibuat oleh',
  updated_by: 'Diubah oleh',
  created_at: 'Dibuat pada',
  updated_at: 'Diubah pada',
  record_id: 'ID data',
  old_values: 'Nilai sebelum perubahan',
  new_values: 'Nilai sesudah perubahan',
  changed_fields: 'Field yang berubah',
  ip_address: 'Alamat IP',
  user_agent: 'Perangkat',
  request_id: 'ID permintaan',
  operation_id: 'ID operasi',
  metadata: 'Metadata',
  due_at: 'Batas waktu',
  tanggal_pinjam: 'Tanggal peminjaman',
  rencana_kembali: 'Rencana pengembalian',
  tanggal_dikembalikan: 'Tanggal pengembalian',
  tanggal_diserahkan: 'Tanggal penyerahan',
  kondisi_awal: 'Kondisi awal',
  kondisi_kembali: 'Kondisi saat kembali',
  physical_condition: 'Kondisi fisik',
  availability_status: 'Ketersediaan',
  nominal: 'Nominal',
  jumlah: 'Jumlah',
  amount: 'Nominal',
  total_denda: 'Total denda',
  keterangan: 'Keterangan',
  catatan: 'Catatan',
  catatan_persetujuan: 'Catatan persetujuan',
  catatan_pengembalian: 'Catatan pengembalian',
  nominal_iuran_wajib: 'Nominal iuran wajib',
};

function normalize(value: unknown): string {
  return String(value ?? '').trim();
}

function titleCase(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatTechnicalLabel(value: unknown, fallback = '—'): string {
  const normalized = normalize(value);
  if (!normalized) return fallback;
  return ENUM_LABELS[normalized] ?? STATUS_LABELS[normalized] ?? titleCase(normalized);
}

export function formatResourceLabel(value: unknown, fallback = 'Modul'): string {
  const normalized = normalize(value).toLowerCase();
  if (!normalized) return fallback;
  return RESOURCE_LABELS[normalized] ?? formatTechnicalLabel(normalized, fallback);
}

export function formatAuditActionLabel(value: unknown, fallback = 'Perubahan'): string {
  const normalized = normalize(value).toUpperCase();
  return AUDIT_ACTION_LABELS[normalized] ?? formatTechnicalLabel(normalized, fallback);
}

export function formatRoleLabel(value: unknown, fallback = 'Peran tidak tersedia'): string {
  const original = normalize(value);
  const normalized = original.toLowerCase();
  if (!normalized) return fallback;
  if (ROLE_LABELS[normalized]) return ROLE_LABELS[normalized];
  return normalized.includes('_') ? formatTechnicalLabel(normalized, fallback) : original;
}

export function formatStatusLabel(value: unknown, fallback = 'Status tidak tersedia'): string {
  const normalized = normalize(value).toLowerCase();
  if (!normalized) return fallback;
  return STATUS_LABELS[normalized] ?? formatTechnicalLabel(normalized, fallback);
}

export function formatFieldLabel(value: unknown, fallback = 'Field'): string {
  const normalized = normalize(value).toLowerCase();
  if (!normalized) return fallback;
  return FIELD_LABELS[normalized] ?? formatTechnicalLabel(normalized, fallback);
}

export function formatEnumLabel(value: unknown, fallback = '—'): string {
  const normalized = normalize(value);
  if (!normalized) return fallback;
  return ENUM_LABELS[normalized] ?? formatTechnicalLabel(normalized, fallback);
}

export function formatPaymentMethodLabel(code: unknown, label?: unknown, fallback = 'Metode tidak tersedia'): string {
  const normalizedCode = normalize(code).toLowerCase();
  const providedLabel = normalize(label);
  // Older rows may return the stable code in the label column. Never expose
  // that technical value when a curated label is available.
  if (providedLabel && providedLabel.toLowerCase() !== normalizedCode) return providedLabel;

  if (!normalizedCode) return fallback;
  return ENUM_LABELS[normalizedCode] ?? formatTechnicalLabel(normalizedCode, fallback);
}

export function formatSourceLabel(value: unknown, fallback = 'Aplikasi'): string {
  const normalized = normalize(value).toLowerCase();
  if (!normalized) return fallback;
  const labels: Record<string, string> = {
    api: 'Aplikasi',
    worker: 'Proses otomatis',
    system: 'Sistem',
    import: 'Impor data',
  };
  return labels[normalized] ?? formatTechnicalLabel(normalized, fallback);
}
