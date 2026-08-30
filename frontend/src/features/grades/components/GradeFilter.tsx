// src/features/grades/components/GradeFilter.tsx
// Filter bar for grades page — Search input, Category select, Class select

import { Search, X } from 'lucide-react';
import { Input } from '@/shared/ui/primitives/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select';
import { Button } from '@/shared/ui/primitives/button';
import { ASSIGNMENT_CATEGORY_LABELS } from '../types/grades.types';

interface GradeFilterProps {
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  kelas: string;
  onKelasChange: (value: string) => void;
  onReset: () => void;
  isOwn?: boolean;
}

export function GradeFilter({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  kelas,
  onKelasChange,
  onReset,
  isOwn = false,
}: GradeFilterProps) {
  const hasActiveFilters = Boolean(search || category !== 'all' || (!isOwn && kelas !== 'all'));

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
      {/* Search Input */}
      <div className="relative flex-1">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
        <Input
          type="text"
          placeholder={isOwn ? 'Cari judul tugas atau kegiatan...' : 'Cari nama siswa atau judul tugas...'}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 bg-surface-1 border-hairline text-ink placeholder:text-ink-tertiary text-xs h-9"
        />
      </div>

      {/* Category Select */}
      <Select value={category} onValueChange={(val) => val !== null && onCategoryChange(val)}>
        <SelectTrigger className="w-full sm:w-44 bg-surface-1 border-hairline text-ink text-xs h-9">
          <SelectValue placeholder="Kategori Kegiatan" />
        </SelectTrigger>
        <SelectContent className="bg-surface-3 border-hairline text-ink">
          <SelectItem value="all">Semua Kategori</SelectItem>
          <SelectItem value="class_task">{ASSIGNMENT_CATEGORY_LABELS.class_task}</SelectItem>
          <SelectItem value="crew_film">{ASSIGNMENT_CATEGORY_LABELS.crew_film}</SelectItem>
          <SelectItem value="event_participation">{ASSIGNMENT_CATEGORY_LABELS.event_participation}</SelectItem>
          <SelectItem value="other">{ASSIGNMENT_CATEGORY_LABELS.other}</SelectItem>
        </SelectContent>
      </Select>

      {!isOwn && <Select value={kelas} onValueChange={(val) => val !== null && onKelasChange(val)}>
        <SelectTrigger className="w-full sm:w-36 bg-surface-1 border-hairline text-ink text-xs h-9"><SelectValue placeholder="Pilih Kelas" /></SelectTrigger>
        <SelectContent className="bg-surface-3 border-hairline text-ink">
          <SelectItem value="all">Semua Kelas</SelectItem><SelectItem value="X">Kelas X</SelectItem><SelectItem value="XI">Kelas XI</SelectItem><SelectItem value="XII">Kelas XII</SelectItem>
        </SelectContent>
      </Select>}

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
