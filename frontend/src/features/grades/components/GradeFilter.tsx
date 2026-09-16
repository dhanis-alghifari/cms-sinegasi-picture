
import { Search, X } from 'lucide-react';
import { Input } from '@/shared/ui/primitives/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select';
import { Button } from '@/shared/ui/primitives/button';
import { UI_CONSTANTS } from '@/shared/constants/ui';
import { ASSIGNMENT_CATEGORY_LABELS } from '../types/grades.types';

interface GradeFilterProps {
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

export function GradeFilter({
  filters,
  actions,
  scope,
}: GradeFilterProps) {
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
    <div className="mb-4 flex flex-col gap-2.5 lg:flex-row lg:items-center">
      {/* Search Input */}
      <div className="relative min-w-0 flex-1">
        <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
        <Input
          type="text"
          aria-label="Cari nilai"
          placeholder={isOwn ? 'Cari judul tugas atau kegiatan...' : 'Cari nama siswa atau judul tugas...'}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 w-full min-w-0 bg-surface-1 pl-9 text-xs text-ink placeholder:text-ink-tertiary"
        />
      </div>

      {/* Category Select */}
      <Select value={category} onValueChange={handleCategoryValueChange}>
        <SelectTrigger aria-label="Filter kategori nilai" className="h-9 w-full bg-surface-1 text-xs text-ink lg:w-44">
          <SelectValue placeholder="Kategori Kegiatan" />
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
        <SelectTrigger aria-label="Filter kelas nilai" className="h-9 w-full bg-surface-1 text-xs text-ink lg:w-36"><SelectValue placeholder="Pilih Kelas" /></SelectTrigger>
        <SelectContent className="bg-surface-3 border-hairline text-ink">
          <SelectItem value={UI_CONSTANTS.ALL_FILTER_VALUE}>Semua Kelas</SelectItem><SelectItem value="X">Kelas X</SelectItem><SelectItem value="XI">Kelas XI</SelectItem><SelectItem value="XII">Kelas XII</SelectItem>
        </SelectContent>
      </Select>}

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
