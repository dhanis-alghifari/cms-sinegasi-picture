import type { FilmWorkRecord } from './film-works.types.js';
import type { DatabaseRow } from '../../shared/database/database.types.js';

export const DEFAULT_FILMS: FilmWorkRecord[] = [
  {
    id: 'fw-001', judul: 'Bayangan Masa', durasiMenit: 12.5, genre: 'short_film',
    sinopsis: 'Kisah seorang remaja yang menemukan buku harian kakeknya yang mengubah pandangannya tentang keberanian.',
    tahunProduksi: 2026, status: 'dilombakan',
    crew: [
      { nama: 'Budi Santoso', role: 'Director of Photography' },
      { nama: 'Siti Aminah', role: 'Editor & Color Grader' },
      { nama: 'Rizky Pratama', role: 'Penulis Naskah / Sutradara' },
    ],
  },
  {
    id: 'fw-002', judul: 'Dokumentasi HUT Sekolah', durasiMenit: 8, genre: 'dokumenter',
    sinopsis: 'Rekaman momen terbaik perayaan HUT ke-25 SMKN 1 Sinegasi dengan 300 peserta.',
    tahunProduksi: 2026, status: 'selesai',
    crew: [{ nama: 'Maya Kusuma', role: 'Camera Operator' }],
  },
];

export function normalizeFilmStatus(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const status = value.trim().slice(0, 32);
  return status && status !== 'all' ? status : undefined;
}

function textValue(value: unknown): string | undefined {
  return value == null ? undefined : String(value);
}

function nullableTextValue(value: unknown): string | null {
  return value == null ? null : String(value);
}

export function mapFilmWorkRow(row: DatabaseRow): FilmWorkRecord {
  const crewRows = Array.isArray(row.film_crew) ? row.film_crew as unknown[] : [];
  const crew = crewRows.length > 0
    ? crewRows.map((memberValue) => {
      const member = memberValue && typeof memberValue === 'object' ? memberValue as DatabaseRow : {};
      const students = member.students && typeof member.students === 'object' ? member.students as DatabaseRow : {};
      return {
      nama: String(students.nama ?? member.nama ?? ''),
      role: String(member.role ?? ''),
      };
    }).filter((member: { nama: string; role: string }) => member.nama || member.role)
    : [];
  return {
    id: String(row.id), judul: String(row.judul ?? ''), durasiMenit: row.durasi_menit == null ? null : Number(row.durasi_menit),
    genre: nullableTextValue(row.genre), sinopsis: nullableTextValue(row.sinopsis), tahunProduksi: Number(row.tahun_produksi ?? 0),
    thumbnailUrl: nullableTextValue(row.thumbnail_url), videoUrl: nullableTextValue(row.video_url), status: String(row.status ?? 'draft'), crew, createdAt: textValue(row.created_at),
  };
}
