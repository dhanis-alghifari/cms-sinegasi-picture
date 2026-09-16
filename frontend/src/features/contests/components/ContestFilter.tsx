
import { Search, X } from 'lucide-react';
import { Input } from '@/shared/ui/primitives/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select';
import { Button } from '@/shared/ui/primitives/button';
import { UI_CONSTANTS } from '@/shared/constants/ui';
import { CONTEST_SCOPE_OPTIONS, CONTEST_STATUS_OPTIONS } from '../utils/contestLabels';

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
  const hasActiveFilters = Boolean(search || tingkat !== UI_CONSTANTS.ALL_FILTER_VALUE || status !== UI_CONSTANTS.ALL_FILTER_VALUE);
  const handleTingkatValueChange = (value: string | null) => {
    if (value === null) return;
    onTingkatChange(value);
  };
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
          aria-label="Cari perlombaan"
          placeholder="Cari nama lomba atau kota..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 w-full min-w-0 bg-surface-1 pl-9 text-xs text-ink placeholder:text-ink-tertiary"
        />
      </div>

      {/* Tingkat Select */}
      <Select
        items={[{ value: UI_CONSTANTS.ALL_FILTER_VALUE, label: 'Semua Tingkat' }, ...CONTEST_SCOPE_OPTIONS]}
        value={tingkat}
        onValueChange={handleTingkatValueChange}
      >
        <SelectTrigger aria-label="Filter tingkat perlombaan" className="h-9 w-full bg-surface-1 text-xs text-ink lg:w-40">
          <SelectValue placeholder="Tingkat Lomba" />
        </SelectTrigger>
        <SelectContent className="bg-surface-3 border-hairline text-ink">
          <SelectItem value={UI_CONSTANTS.ALL_FILTER_VALUE}>Semua Tingkat</SelectItem>
          {CONTEST_SCOPE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status Select */}
      <Select
        items={[{ value: UI_CONSTANTS.ALL_FILTER_VALUE, label: 'Semua Status' }, ...CONTEST_STATUS_OPTIONS]}
        value={status}
        onValueChange={handleStatusValueChange}
      >
        <SelectTrigger aria-label="Filter status perlombaan" className="h-9 w-full bg-surface-1 text-xs text-ink lg:w-40">
          <SelectValue placeholder="Status Lomba" />
        </SelectTrigger>
        <SelectContent className="bg-surface-3 border-hairline text-ink">
          <SelectItem value={UI_CONSTANTS.ALL_FILTER_VALUE}>Semua Status</SelectItem>
          {CONTEST_STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
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
