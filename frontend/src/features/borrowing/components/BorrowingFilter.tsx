// src/features/borrowing/components/BorrowingFilter.tsx
// Filter bar for borrowing page — Search input, Status select

import { Search, X } from 'lucide-react';
import { Input } from '@/shared/ui/primitives/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select';
import { Button } from '@/shared/ui/primitives/button';

interface BorrowingFilterProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  onReset: () => void;
}

export function BorrowingFilter({
  search,
  onSearchChange,
  status,
  onStatusChange,
  onReset,
}: BorrowingFilterProps) {
  const hasActiveFilters = Boolean(search || status !== 'all');

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
      {/* Search Input */}
      <div className="relative flex-1">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
        <Input
          type="text"
          placeholder="Cari Nama Peminjam, Kode Alat, atau Keperluan..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 bg-surface-1 border-hairline text-ink placeholder:text-ink-tertiary text-xs"
        />
      </div>

      {/* Status Select */}
      <Select value={status} onValueChange={(val) => val !== null && onStatusChange(val)}>
        <SelectTrigger className="w-full sm:w-48 bg-surface-1 border-hairline text-ink text-xs">
          <SelectValue placeholder="Status Peminjaman" />
        </SelectTrigger>
        <SelectContent className="bg-surface-3 border-hairline text-ink">
          <SelectItem value="all">Semua Status</SelectItem>
          <SelectItem value="menunggu_persetujuan">Menunggu Persetujuan</SelectItem>
          <SelectItem value="disetujui">Disetujui (Siap Ambil)</SelectItem>
          <SelectItem value="dipinjam">Sedang Dipinjam</SelectItem>
          <SelectItem value="terlambat">Terlambat (Overdue)</SelectItem>
          <SelectItem value="dikembalikan">Dikembalikan</SelectItem>
          <SelectItem value="ditolak">Ditolak</SelectItem>
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
