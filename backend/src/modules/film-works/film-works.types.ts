export interface FilmCrewMember {
  nama: string;
  role: string;
}

export interface FilmWorkRecord {
  id: string;
  judul: string;
  durasiMenit: number | null;
  genre: string | null;
  sinopsis: string | null;
  tahunProduksi: number;
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
  status: string;
  crew: FilmCrewMember[];
  createdAt?: string;
}

export interface FilmWorksMemoryState {
  films: FilmWorkRecord[];
}

export interface FilmWorksRepository {
  isConfigured(): boolean;
  list(status?: string): Promise<{ data: FilmWorkRecord[] } | { error: unknown }>;
}
