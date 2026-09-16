
import { Search, X, Calendar as CalendarIcon } from 'lucide-react';
import { Input } from '@/shared/ui/primitives/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select';
import { Button } from '@/shared/ui/primitives/button';
import { UI_CONSTANTS } from '@/shared/constants/ui';

interface AttendanceFilterProps {
  filters: {
    tanggal: string;
    kelas: string;
    status: string;
    search: string;
  };
  actions: {
    onTanggalChange: (value: string) => void;
    onKelasChange: (value: string) => void;
    onStatusChange: (value: string) => void;
    onSearchChange: (value: string) => void;
    onReset: () => void;
  };
  scope?: {
    isOwn?: boolean;
  };
}

export function AttendanceFilter({
  filters,
  actions,
  scope,
}: AttendanceFilterProps) {
  const { tanggal, kelas, status, search } = filters;
  const { onTanggalChange, onKelasChange, onStatusChange, onSearchChange, onReset } = actions;
  const { isOwn = false } = scope ?? {};
  const hasActiveFilters = Boolean(tanggal || kelas !== UI_CONSTANTS.ALL_FILTER_VALUE || status !== UI_CONSTANTS.ALL_FILTER_VALUE || search);
  const handleKelasValueChange = (value: string | null) => {
    if (value === null) return;
    onKelasChange(value);
  };
  const handleStatusValueChange = (value: string | null) => {
    if (value === null) return;
    onStatusChange(value);
  };

  return (
    <div className="grid grid-cols-1 gap-3 mb-4 sm:grid-cols-2 xl:flex xl:items-center">
      {/* Date Picker */}
      <div className="relative w-full xl:w-44">
        <CalendarIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary pointer-events-none" />
        <Input
          type="date"
          value={tanggal}
          onChange={(e) => onTanggalChange(e.target.value)}
          className="pl-9 bg-surface-1 border-hairline text-ink text-xs"
        />
      </div>

      {/* Search Input */}
      {!isOwn && <div className="relative flex-1">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
        <Input
          type="text"
          placeholder="Cari Nama atau NIS..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 bg-surface-1 border-hairline text-ink placeholder:text-ink-tertiary text-xs"
        />
      </div>}

      {/* Kelas Select */}
      {!isOwn && <Select value={kelas} onValueChange={handleKelasValueChange}>
        <SelectTrigger className="w-full xl:w-36 bg-surface-1 border-hairline text-ink text-xs">
          <SelectValue placeholder="Pilih Kelas" />
        </SelectTrigger>
        <SelectContent className="bg-surface-3 border-hairline text-ink">
          <SelectItem value={UI_CONSTANTS.ALL_FILTER_VALUE}>Semua Kelas</SelectItem>
          <SelectItem value="X">Kelas X</SelectItem>
          <SelectItem value="XI">Kelas XI</SelectItem>
          <SelectItem value="XII">Kelas XII</SelectItem>
        </SelectContent>
      </Select>}

      {/* Status Select */}
      <Select value={status} onValueChange={handleStatusValueChange}>
        <SelectTrigger className="w-full xl:w-36 bg-surface-1 border-hairline text-ink text-xs">
          <SelectValue placeholder="Status Kehadiran" />
        </SelectTrigger>
        <SelectContent className="bg-surface-3 border-hairline text-ink">
          <SelectItem value={UI_CONSTANTS.ALL_FILTER_VALUE}>Semua Status</SelectItem>
          <SelectItem value="hadir">Hadir</SelectItem>
          <SelectItem value="sakit">Sakit</SelectItem>
          <SelectItem value="izin">Izin</SelectItem>
          <SelectItem value="alpha">Alpha</SelectItem>
        </SelectContent>
      </Select>

      {/* Make the all-dates state explicit so the table and summary share the same scope. */}
      {!isOwn && tanggal && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onTanggalChange('')}
          className="text-ink-subtle hover:text-ink hover:bg-surface-2 text-xs h-9"
        >
          Semua tanggal
        </Button>
      )}

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
