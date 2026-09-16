import { Search, X } from 'lucide-react';

import { Button } from '@/shared/ui/primitives/button';
import { Input } from '@/shared/ui/primitives/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select';
import { UI_CONSTANTS } from '@/shared/constants/ui';

import { ASSIGNMENT_CATEGORY_LABELS } from '../types/grades.types';

interface AssignmentFilterProps {
  filters: {
    search: string;
    category: string;
    kelas: string;
  };
  actions: {
    onSearchChange: (value: string) => void;
    onCategoryChange: (value: string) => void;
    onKelasChange: (value: string) => void;
    onReset: () => void;
  };
  scope?: {
    isOwn?: boolean;
  };
}

export function AssignmentFilter({
  filters,
  actions,
  scope,
}: AssignmentFilterProps) {
  const { search, category, kelas } = filters;
  const { onSearchChange, onCategoryChange, onKelasChange, onReset } = actions;
  const { isOwn = false } = scope ?? {};
  const hasActiveFilters = Boolean(search || category !== UI_CONSTANTS.ALL_FILTER_VALUE || (!isOwn && kelas !== UI_CONSTANTS.ALL_FILTER_VALUE));
  const handleCategoryValueChange = (value: string | null) => {
    if (value === null) return;
    onCategoryChange(value);
  };
  const handleKelasValueChange = (value: string | null) => {
    if (value === null) return;
    onKelasChange(value);
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:flex xl:items-center">
      <div className="relative flex-1">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
        <Input
          type="text"
          placeholder="Cari judul tugas..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="pl-9 bg-surface-1 border-hairline text-ink placeholder:text-ink-tertiary text-xs"
        />
      </div>

      <Select value={category} onValueChange={handleCategoryValueChange}>
        <SelectTrigger className="w-full xl:w-44 bg-surface-1 border-hairline text-ink text-xs">
          <SelectValue placeholder="Kategori tugas" />
        </SelectTrigger>
        <SelectContent className="bg-surface-3 border-hairline text-ink">
          <SelectItem value={UI_CONSTANTS.ALL_FILTER_VALUE}>Semua Kategori</SelectItem>
          <SelectItem value="class_task">{ASSIGNMENT_CATEGORY_LABELS.class_task}</SelectItem>
          <SelectItem value="crew_film">{ASSIGNMENT_CATEGORY_LABELS.crew_film}</SelectItem>
          <SelectItem value="event_participation">{ASSIGNMENT_CATEGORY_LABELS.event_participation}</SelectItem>
          <SelectItem value="other">{ASSIGNMENT_CATEGORY_LABELS.other}</SelectItem>
        </SelectContent>
      </Select>

      {!isOwn && <Select value={kelas} onValueChange={handleKelasValueChange}>
        <SelectTrigger className="w-full xl:w-36 bg-surface-1 border-hairline text-ink text-xs">
          <SelectValue placeholder="Pilih kelas" />
        </SelectTrigger>
        <SelectContent className="bg-surface-3 border-hairline text-ink">
          <SelectItem value={UI_CONSTANTS.ALL_FILTER_VALUE}>Semua Kelas</SelectItem>
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
