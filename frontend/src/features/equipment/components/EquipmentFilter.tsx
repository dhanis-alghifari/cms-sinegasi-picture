
import { Search, X } from 'lucide-react';
import { Input } from '@/shared/ui/primitives/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select';
import { Button } from '@/shared/ui/primitives/button';
import { UI_CONSTANTS } from '@/shared/constants/ui';

interface EquipmentFilterProps {
  filters: {
    search: string;
    kategori: string;
    kondisi: string;
    status: string;
  };
  actions: {
    onSearchChange: (value: string) => void;
    onKategoriChange: (value: string) => void;
    onKondisiChange: (value: string) => void;
    onStatusChange: (value: string) => void;
    onReset: () => void;
  };
}

export function EquipmentFilter({
  filters,
  actions,
}: EquipmentFilterProps) {
  const { search, kategori, kondisi, status } = filters;
  const { onSearchChange, onKategoriChange, onKondisiChange, onStatusChange, onReset } = actions;
  const hasActiveFilters = Boolean(search || kategori !== UI_CONSTANTS.ALL_FILTER_VALUE || kondisi !== UI_CONSTANTS.ALL_FILTER_VALUE || status !== UI_CONSTANTS.ALL_FILTER_VALUE);
  const handleKategoriValueChange = (value: string | null) => {
    if (value === null) return;
    onKategoriChange(value);
  };
  const handleKondisiValueChange = (value: string | null) => {
    if (value === null) return;
    onKondisiChange(value);
  };
  const handleStatusValueChange = (value: string | null) => {
    if (value === null) return;
    onStatusChange(value);
  };

  return (
    <div className="mb-4 flex flex-col gap-2.5 lg:flex-row lg:items-center">
      {/* Search Input */}
      <div className="relative min-w-0 flex-1">
        <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
        <Input
          type="text"
          aria-label="Cari alat"
          placeholder="Cari Kode Alat atau Nama Alat..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 w-full min-w-0 bg-surface-1 pl-9 text-xs text-ink placeholder:text-ink-tertiary"
        />
      </div>

      {/* Kategori Select */}
      <Select value={kategori} onValueChange={handleKategoriValueChange}>
        <SelectTrigger aria-label="Filter kategori alat" className="h-9 w-full bg-surface-1 text-xs text-ink lg:w-36">
          <SelectValue placeholder="Kategori" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UI_CONSTANTS.ALL_FILTER_VALUE}>Semua Kategori</SelectItem>
          <SelectItem value="Kamera">Kamera</SelectItem>
          <SelectItem value="Lensa">Lensa</SelectItem>
          <SelectItem value="Audio">Audio</SelectItem>
          <SelectItem value="Lighting">Lighting</SelectItem>
          <SelectItem value="Aksesoris">Aksesoris</SelectItem>
          <SelectItem value="Lainnya">Lainnya</SelectItem>
        </SelectContent>
      </Select>

      {/* Kondisi Select */}
      <Select value={kondisi} onValueChange={handleKondisiValueChange}>
        <SelectTrigger aria-label="Filter kondisi alat" className="h-9 w-full bg-surface-1 text-xs text-ink lg:w-36">
          <SelectValue placeholder="Kondisi" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UI_CONSTANTS.ALL_FILTER_VALUE}>Semua Kondisi</SelectItem>
          <SelectItem value="bagus">Bagus</SelectItem>
          <SelectItem value="sedikit_kerusakan">Sedikit Rusak</SelectItem>
          <SelectItem value="rusak">Rusak</SelectItem>
          <SelectItem value="rusak_besar">Rusak Besar</SelectItem>
          <SelectItem value="sedang_diperbaiki">Diperbaiki</SelectItem>
          <SelectItem value="hilang">Hilang</SelectItem>
        </SelectContent>
      </Select>

      {/* Status Availability Select */}
      <Select value={status} onValueChange={handleStatusValueChange}>
        <SelectTrigger aria-label="Filter status ketersediaan alat" className="h-9 w-full bg-surface-1 text-xs text-ink lg:w-36">
          <SelectValue placeholder="Status Pinjam" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UI_CONSTANTS.ALL_FILTER_VALUE}>Semua Status</SelectItem>
          <SelectItem value="tersedia">Tersedia</SelectItem>
          <SelectItem value="dipinjam">Dipinjam</SelectItem>
          <SelectItem value="maintenance">Maintenance</SelectItem>
        </SelectContent>
      </Select>

      {/* Reset Button */}
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
