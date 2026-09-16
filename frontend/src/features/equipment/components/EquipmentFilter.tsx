
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
    <div className="grid grid-cols-1 gap-3 mb-4 sm:grid-cols-2 xl:flex xl:items-center">
      {/* Search Input */}
      <div className="relative flex-1">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
        <Input
          type="text"
          placeholder="Cari Kode Alat atau Nama Alat..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 bg-surface-1 border-hairline text-ink placeholder:text-ink-tertiary text-xs"
        />
      </div>

      {/* Kategori Select */}
      <Select value={kategori} onValueChange={handleKategoriValueChange}>
        <SelectTrigger className="w-full xl:w-36 bg-surface-1 border-hairline text-ink text-xs">
          <SelectValue placeholder="Kategori" />
        </SelectTrigger>
        <SelectContent className="bg-surface-3 border-hairline text-ink">
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
        <SelectTrigger className="w-full xl:w-36 bg-surface-1 border-hairline text-ink text-xs">
          <SelectValue placeholder="Kondisi" />
        </SelectTrigger>
        <SelectContent className="bg-surface-3 border-hairline text-ink">
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
        <SelectTrigger className="w-full xl:w-36 bg-surface-1 border-hairline text-ink text-xs">
          <SelectValue placeholder="Status Pinjam" />
        </SelectTrigger>
        <SelectContent className="bg-surface-3 border-hairline text-ink">
          <SelectItem value={UI_CONSTANTS.ALL_FILTER_VALUE}>Semua Status</SelectItem>
          <SelectItem value="tersedia">Tersedia</SelectItem>
          <SelectItem value="dipinjam">Dipinjam</SelectItem>
          <SelectItem value="maintenance">Maintenance</SelectItem>
        </SelectContent>
      </Select>

      {/* Reset Button */}
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
