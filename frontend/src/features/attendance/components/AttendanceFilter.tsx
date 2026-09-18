
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
    <div className="mb-4 flex flex-col gap-2.5 lg:flex-row lg:items-center">
      {/* Date Picker */}
      <div className="relative w-full min-w-0 lg:w-44 lg:shrink-0">
        <CalendarIcon size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
        <Input
          type="date"
          aria-label="Filter tanggal absensi"
          value={tanggal}
          onChange={(e) => onTanggalChange(e.target.value)}
          className="h-9 w-full bg-surface-1 pl-9 text-xs text-ink"
        />
      </div>

      {/* Search Input */}
      {!isOwn && <div className="relative min-w-0 flex-1">
        <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
        <Input
          type="text"
          aria-label="Cari catatan absensi"
          placeholder="Cari Nama atau NIS..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 w-full min-w-0 bg-surface-1 pl-9 text-xs text-ink placeholder:text-ink-tertiary"
        />
      </div>}

      {/* Kelas Select */}
      {!isOwn && <Select value={kelas} onValueChange={handleKelasValueChange}>
        <SelectTrigger aria-label="Filter kelas absensi" className="h-9 w-full bg-surface-1 text-xs text-ink lg:w-36">
          <SelectValue placeholder="Pilih Kelas" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UI_CONSTANTS.ALL_FILTER_VALUE}>Semua Kelas</SelectItem>
          <SelectItem value="X">Kelas X</SelectItem>
          <SelectItem value="XI">Kelas XI</SelectItem>
          <SelectItem value="XII">Kelas XII</SelectItem>
        </SelectContent>
      </Select>}

      {/* Status Select */}
      <Select value={status} onValueChange={handleStatusValueChange}>
        <SelectTrigger aria-label="Filter status absensi" className="h-9 w-full bg-surface-1 text-xs text-ink lg:w-36">
          <SelectValue placeholder="Status Kehadiran" />
        </SelectTrigger>
        <SelectContent>
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
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onTanggalChange('')}
          className="h-9 shrink-0 text-xs text-ink-subtle hover:bg-surface-2 hover:text-ink"
        >
          Semua tanggal
        </Button>
      )}

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
