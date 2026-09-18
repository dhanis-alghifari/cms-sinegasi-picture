
import { Search, X } from 'lucide-react';
import { Input } from '@/shared/ui/primitives/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select';
import { Button } from '@/shared/ui/primitives/button';
import { UI_CONSTANTS } from '@/shared/constants/ui';

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
  const hasActiveFilters = Boolean(search || (kelas && kelas !== UI_CONSTANTS.ALL_FILTER_VALUE) || (peminatan && peminatan !== UI_CONSTANTS.ALL_FILTER_VALUE));
  const handleKelasValueChange = (value: string | null) => {
    if (value === null) return;
    onKelasChange(value);
  };
  const handlePeminatanValueChange = (value: string | null) => {
    if (value === null) return;
    onPeminatanChange(value);
  };

  return (
    <div className="mb-4 flex flex-col gap-2.5 lg:flex-row lg:items-center">
      {/* Search Input */}
      <div className="relative min-w-0 flex-1">
        <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
        <Input
          type="text"
          aria-label="Cari siswa"
          placeholder="Cari NIS atau Nama Siswa..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 w-full min-w-0 bg-surface-1 pl-9 text-xs text-ink placeholder:text-ink-tertiary"
        />
      </div>

      {/* Kelas Filter (Fokus Kelas X, XI, XII) */}
      <Select value={kelas} onValueChange={handleKelasValueChange}>
        <SelectTrigger aria-label="Filter kelas siswa" className="h-9 w-full bg-surface-1 text-xs text-ink lg:w-36">
          <SelectValue placeholder="Pilih Kelas" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UI_CONSTANTS.ALL_FILTER_VALUE}>Semua Kelas</SelectItem>
          <SelectItem value="X">Kelas X</SelectItem>
          <SelectItem value="XI">Kelas XI</SelectItem>
          <SelectItem value="XII">Kelas XII</SelectItem>
        </SelectContent>
      </Select>

      {/* Peminatan Filter */}
      <Select value={peminatan} onValueChange={handlePeminatanValueChange}>
        <SelectTrigger aria-label="Filter peminatan siswa" className="h-9 w-full bg-surface-1 text-xs text-ink lg:w-40">
          <SelectValue placeholder="Peminatan" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UI_CONSTANTS.ALL_FILTER_VALUE}>Semua Peminatan</SelectItem>
          <SelectItem value="kamera">Kamera</SelectItem>
          <SelectItem value="editing">Editing</SelectItem>
          <SelectItem value="naskah">Naskah</SelectItem>
        </SelectContent>
      </Select>

      {/* Reset Filter Button */}
      {hasActiveFilters && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="h-9 shrink-0 text-xs text-ink-subtle hover:bg-surface-2 hover:text-ink"
        >
          <X size={14} className="mr-1" />
          Reset
        </Button>
      )}
    </div>
  );
}
