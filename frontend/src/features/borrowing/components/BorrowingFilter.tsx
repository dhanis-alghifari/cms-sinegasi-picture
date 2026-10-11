
import { Search, X } from 'lucide-react';
import { Input } from '@/shared/ui/primitives/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select';
import { Button } from '@/shared/ui/primitives/button';
import { UI_CONSTANTS } from '@/shared/constants/ui';

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
  const hasActiveFilters = Boolean(search || status !== UI_CONSTANTS.ALL_FILTER_VALUE);
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
          aria-label="Cari peminjaman"
          placeholder="Cari Nama Peminjam, Kode Alat, atau Keperluan..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 w-full min-w-0 bg-surface-1 pl-9 text-xs text-ink placeholder:text-ink-tertiary"
        />
      </div>

      {/* Status Select */}
      <Select value={status} onValueChange={handleStatusValueChange}>
        <SelectTrigger aria-label="Filter status peminjaman" className="h-9 w-full bg-surface-1 text-xs text-ink lg:w-48">
          <SelectValue placeholder="Status Peminjaman" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UI_CONSTANTS.ALL_FILTER_VALUE}>Semua Status</SelectItem>
          <SelectItem value="menunggu_persetujuan">Menunggu Persetujuan</SelectItem>
          <SelectItem value="disetujui">Disetujui (Siap Ambil)</SelectItem>
          <SelectItem value="dipinjam">Sedang Dipinjam</SelectItem>
          <SelectItem value="menunggu_verifikasi">Menunggu Verifikasi Guru</SelectItem>
          <SelectItem value="terlambat">Terlambat (Overdue)</SelectItem>
          <SelectItem value="dikembalikan">Dikembalikan</SelectItem>
          <SelectItem value="ditolak">Ditolak</SelectItem>
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
