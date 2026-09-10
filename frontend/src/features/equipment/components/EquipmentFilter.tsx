// src/features/equipment/components/EquipmentFilter.tsx
// Filter bar for equipment catalog page — Search, Kategori, Kondisi, Availability

import { Search, X } from 'lucide-react';
import { Input } from '@/shared/ui/primitives/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select';
import { Button } from '@/shared/ui/primitives/button';

interface EquipmentFilterProps {
  search: string;
  onSearchChange: (value: string) => void;
  kategori: string;
  onKategoriChange: (value: string) => void;
  kondisi: string;
  onKondisiChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  onReset: () => void;
}

export function EquipmentFilter({
  search,
  onSearchChange,
  kategori,
  onKategoriChange,
  kondisi,
  onKondisiChange,
  status,
  onStatusChange,
  onReset,
}: EquipmentFilterProps) {
  const hasActiveFilters = Boolean(search || kategori !== 'all' || kondisi !== 'all' || status !== 'all');

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
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
      <Select value={kategori} onValueChange={(val) => val !== null && onKategoriChange(val)}>
        <SelectTrigger className="w-full sm:w-36 bg-surface-1 border-hairline text-ink text-xs">
          <SelectValue placeholder="Kategori" />
        </SelectTrigger>
        <SelectContent className="bg-surface-3 border-hairline text-ink">
          <SelectItem value="all">Semua Kategori</SelectItem>
          <SelectItem value="Kamera">Kamera</SelectItem>
          <SelectItem value="Lensa">Lensa</SelectItem>
          <SelectItem value="Audio">Audio</SelectItem>
          <SelectItem value="Lighting">Lighting</SelectItem>
          <SelectItem value="Aksesoris">Aksesoris</SelectItem>
          <SelectItem value="Lainnya">Lainnya</SelectItem>
        </SelectContent>
      </Select>

      {/* Kondisi Select */}
      <Select value={kondisi} onValueChange={(val) => val !== null && onKondisiChange(val)}>
        <SelectTrigger className="w-full sm:w-36 bg-surface-1 border-hairline text-ink text-xs">
          <SelectValue placeholder="Kondisi" />
        </SelectTrigger>
        <SelectContent className="bg-surface-3 border-hairline text-ink">
          <SelectItem value="all">Semua Kondisi</SelectItem>
          <SelectItem value="bagus">Bagus</SelectItem>
          <SelectItem value="sedikit_kerusakan">Sedikit Rusak</SelectItem>
          <SelectItem value="rusak">Rusak</SelectItem>
          <SelectItem value="rusak_besar">Rusak Besar</SelectItem>
          <SelectItem value="sedang_diperbaiki">Diperbaiki</SelectItem>
          <SelectItem value="hilang">Hilang</SelectItem>
        </SelectContent>
      </Select>

      {/* Status Availability Select */}
      <Select value={status} onValueChange={(val) => val !== null && onStatusChange(val)}>
        <SelectTrigger className="w-full sm:w-36 bg-surface-1 border-hairline text-ink text-xs">
          <SelectValue placeholder="Status Pinjam" />
        </SelectTrigger>
        <SelectContent className="bg-surface-3 border-hairline text-ink">
          <SelectItem value="all">Semua Status</SelectItem>
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
