// src/features/contests/components/ContestFilter.tsx
// Filter bar for film contests page — Search input, Tingkat select, Status select

import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

interface ContestFilterProps {
  search: string;
  onSearchChange: (value: string) => void;
  tingkat: string;
  onTingkatChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  onReset: () => void;
}

export function ContestFilter({
  search,
  onSearchChange,
  tingkat,
  onTingkatChange,
  status,
  onStatusChange,
  onReset,
}: ContestFilterProps) {
  const hasActiveFilters = Boolean(search || tingkat !== 'all' || status !== 'all');

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
      {/* Search Input */}
      <div className="relative flex-1">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
        <Input
          type="text"
          placeholder="Cari Nama Lomba atau Penyelenggara..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 bg-surface-1 border-hairline text-ink placeholder:text-ink-tertiary text-xs h-9"
        />
      </div>

      {/* Tingkat Select */}
      <Select value={tingkat} onValueChange={(val) => val !== null && onTingkatChange(val)}>
        <SelectTrigger className="w-full sm:w-40 bg-surface-1 border-hairline text-ink text-xs h-9">
          <SelectValue placeholder="Tingkat Lomba" />
        </SelectTrigger>
        <SelectContent className="bg-surface-3 border-hairline text-ink">
          <SelectItem value="all">Semua Tingkat</SelectItem>
          <SelectItem value="Lokal">Lokal</SelectItem>
          <SelectItem value="Regional">Regional</SelectItem>
          <SelectItem value="Nasional">Nasional</SelectItem>
          <SelectItem value="Internasional">Internasional</SelectItem>
        </SelectContent>
      </Select>

      {/* Status Select */}
      <Select value={status} onValueChange={(val) => val !== null && onStatusChange(val)}>
        <SelectTrigger className="w-full sm:w-40 bg-surface-1 border-hairline text-ink text-xs h-9">
          <SelectValue placeholder="Status Lomba" />
        </SelectTrigger>
        <SelectContent className="bg-surface-3 border-hairline text-ink">
          <SelectItem value="all">Semua Status</SelectItem>
          <SelectItem value="buka">Buka Pendaftaran</SelectItem>
          <SelectItem value="proses_penjurian">Proses Penjurian</SelectItem>
          <SelectItem value="selesai">Selesai</SelectItem>
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
