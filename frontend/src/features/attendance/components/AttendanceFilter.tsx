// src/features/attendance/components/AttendanceFilter.tsx
// Filter bar for attendance page — Date picker, Kelas select, Status select, Search input

import { Search, X, Calendar as CalendarIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

interface AttendanceFilterProps {
  tanggal: string;
  onTanggalChange: (value: string) => void;
  kelas: string;
  onKelasChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  onReset: () => void;
  isOwn?: boolean;
}

export function AttendanceFilter({
  tanggal,
  onTanggalChange,
  kelas,
  onKelasChange,
  status,
  onStatusChange,
  search,
  onSearchChange,
  onReset,
  isOwn = false,
}: AttendanceFilterProps) {
  const hasActiveFilters = Boolean(tanggal || kelas !== 'all' || status !== 'all' || search);

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
      {/* Date Picker */}
      <div className="relative w-full sm:w-44">
        <CalendarIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary pointer-events-none" />
        <Input
          type="date"
          value={tanggal}
          onChange={(e) => onTanggalChange(e.target.value)}
          className="pl-9 bg-surface-1 border-hairline text-ink text-xs h-9"
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
          className="pl-9 bg-surface-1 border-hairline text-ink placeholder:text-ink-tertiary text-xs h-9"
        />
      </div>}

      {/* Kelas Select */}
      {!isOwn && <Select value={kelas} onValueChange={(val) => val !== null && onKelasChange(val)}>
        <SelectTrigger className="w-full sm:w-36 bg-surface-1 border-hairline text-ink text-xs h-9">
          <SelectValue placeholder="Pilih Kelas" />
        </SelectTrigger>
        <SelectContent className="bg-surface-3 border-hairline text-ink">
          <SelectItem value="all">Semua Kelas</SelectItem>
          <SelectItem value="X">Kelas X</SelectItem>
          <SelectItem value="XI">Kelas XI</SelectItem>
          <SelectItem value="XII">Kelas XII</SelectItem>
        </SelectContent>
      </Select>}

      {/* Status Select */}
      <Select value={status} onValueChange={(val) => val !== null && onStatusChange(val)}>
        <SelectTrigger className="w-full sm:w-36 bg-surface-1 border-hairline text-ink text-xs h-9">
          <SelectValue placeholder="Status Kehadiran" />
        </SelectTrigger>
        <SelectContent className="bg-surface-3 border-hairline text-ink">
          <SelectItem value="all">Semua Status</SelectItem>
          <SelectItem value="hadir">Hadir</SelectItem>
          <SelectItem value="sakit">Sakit</SelectItem>
          <SelectItem value="izin">Izin</SelectItem>
          <SelectItem value="alpha">Alpha</SelectItem>
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
