import { Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { ASSIGNMENT_CATEGORY_LABELS } from '../types/grades.types';

interface AssignmentFilterProps {
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  kelas: string;
  onKelasChange: (value: string) => void;
  onReset: () => void;
  isOwn?: boolean;
}

export function AssignmentFilter({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  kelas,
  onKelasChange,
  onReset,
  isOwn = false,
}: AssignmentFilterProps) {
  const hasActiveFilters = Boolean(search || category !== 'all' || (!isOwn && kelas !== 'all'));

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
      <div className="relative flex-1">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
        <Input
          type="text"
          placeholder="Cari judul tugas..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="pl-9 bg-surface-1 border-hairline text-ink placeholder:text-ink-tertiary text-xs h-9"
        />
      </div>

      <Select value={category} onValueChange={(value) => value !== null && onCategoryChange(value)}>
        <SelectTrigger className="w-full sm:w-44 bg-surface-1 border-hairline text-ink text-xs h-9">
          <SelectValue placeholder="Kategori tugas" />
        </SelectTrigger>
        <SelectContent className="bg-surface-3 border-hairline text-ink">
          <SelectItem value="all">Semua Kategori</SelectItem>
          <SelectItem value="class_task">{ASSIGNMENT_CATEGORY_LABELS.class_task}</SelectItem>
          <SelectItem value="crew_film">{ASSIGNMENT_CATEGORY_LABELS.crew_film}</SelectItem>
          <SelectItem value="event_participation">{ASSIGNMENT_CATEGORY_LABELS.event_participation}</SelectItem>
          <SelectItem value="other">{ASSIGNMENT_CATEGORY_LABELS.other}</SelectItem>
        </SelectContent>
      </Select>

      {!isOwn && <Select value={kelas} onValueChange={(value) => value !== null && onKelasChange(value)}>
        <SelectTrigger className="w-full sm:w-36 bg-surface-1 border-hairline text-ink text-xs h-9">
          <SelectValue placeholder="Pilih kelas" />
        </SelectTrigger>
        <SelectContent className="bg-surface-3 border-hairline text-ink">
          <SelectItem value="all">Semua Kelas</SelectItem>
          <SelectItem value="X">Kelas X</SelectItem>
          <SelectItem value="XI">Kelas XI</SelectItem>
          <SelectItem value="XII">Kelas XII</SelectItem>
        </SelectContent>
      </Select>}

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
