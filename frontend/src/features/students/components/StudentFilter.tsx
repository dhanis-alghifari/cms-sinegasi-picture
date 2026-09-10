// src/features/students/components/StudentFilter.tsx
// Filter bar for students page — Search input, Kelas filter (X, XI, XII), Peminatan filter

import { Search, X } from 'lucide-react';
import { Input } from '@/shared/ui/primitives/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select';
import { Button } from '@/shared/ui/primitives/button';

interface StudentFilterProps {
  search: string;
  onSearchChange: (value: string) => void;
  kelas: string;
  onKelasChange: (value: string) => void;
  peminatan: string;
  onPeminatanChange: (value: string) => void;
  onReset: () => void;
}

export function StudentFilter({
  search,
  onSearchChange,
  kelas,
  onKelasChange,
  peminatan,
  onPeminatanChange,
  onReset,
}: StudentFilterProps) {
  const hasActiveFilters = Boolean(search || (kelas && kelas !== 'all') || (peminatan && peminatan !== 'all'));

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
      {/* Search Input */}
      <div className="relative flex-1">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
        <Input
          type="text"
          placeholder="Cari NIS atau Nama Siswa..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 bg-surface-1 border-hairline text-ink placeholder:text-ink-tertiary text-xs"
        />
      </div>

      {/* Kelas Filter (Fokus Kelas X, XI, XII) */}
      <Select value={kelas} onValueChange={(val) => val !== null && onKelasChange(val)}>
        <SelectTrigger className="w-full sm:w-36 bg-surface-1 border-hairline text-ink text-xs">
          <SelectValue placeholder="Pilih Kelas" />
        </SelectTrigger>
        <SelectContent className="bg-surface-3 border-hairline text-ink">
          <SelectItem value="all">Semua Kelas</SelectItem>
          <SelectItem value="X">Kelas X</SelectItem>
          <SelectItem value="XI">Kelas XI</SelectItem>
          <SelectItem value="XII">Kelas XII</SelectItem>
        </SelectContent>
      </Select>

      {/* Peminatan Filter */}
      <Select value={peminatan} onValueChange={(val) => val !== null && onPeminatanChange(val)}>
        <SelectTrigger className="w-full sm:w-40 bg-surface-1 border-hairline text-ink text-xs">
          <SelectValue placeholder="Peminatan" />
        </SelectTrigger>
        <SelectContent className="bg-surface-3 border-hairline text-ink">
          <SelectItem value="all">Semua Peminatan</SelectItem>
          <SelectItem value="kamera">Kamera</SelectItem>
          <SelectItem value="editing">Editing</SelectItem>
          <SelectItem value="naskah">Naskah</SelectItem>
        </SelectContent>
      </Select>

      {/* Reset Filter Button */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="text-ink-subtle hover:text-ink hover:bg-surface-2 text-xs h-9"
        >
          <X size={14} className="mr-1" />
          Reset
        </Button>
      )}
    </div>
  );
}
