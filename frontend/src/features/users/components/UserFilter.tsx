
import { Search, X } from 'lucide-react';
import { Input } from '@/shared/ui/primitives/input';
import { RadioGroup } from '@/shared/ui/primitives/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select';
import { Button } from '@/shared/ui/primitives/button';
import { formatRoleLabel } from '@/shared/utils/formatLabels';
import { UI_CONSTANTS } from '@/shared/constants/ui';

interface UserFilterProps {
  search: string;
  onSearchChange: (value: string) => void;
  role: string;
  onRoleChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  onReset: () => void;
}

export function UserFilter({
  search,
  onSearchChange,
  role,
  onRoleChange,
  status,
  onStatusChange,
  onReset,
}: UserFilterProps) {
  const hasActiveFilters = Boolean(search || role !== UI_CONSTANTS.ALL_FILTER_VALUE || status !== UI_CONSTANTS.ALL_FILTER_VALUE);
  const handleRoleValueChange = (value: string | null) => {
    if (value === null) return;
    onRoleChange(value);
  };

  return (
    <div className="mb-4 flex flex-col gap-2.5 lg:flex-row lg:items-center">
      {/* Search Input */}
      <div className="relative min-w-0 flex-1">
        <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
        <Input
          type="text"
          aria-label="Cari pengguna"
          placeholder="Cari Username atau Nama Pengguna..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 w-full min-w-0 bg-surface-1 pl-9 text-xs text-ink placeholder:text-ink-tertiary"
        />
      </div>

      {/* Role Filter */}
      <Select value={role} onValueChange={handleRoleValueChange}>
        <SelectTrigger aria-label="Filter peran pengguna" className="h-9 w-full bg-surface-1 text-xs text-ink lg:w-44">
          <SelectValue placeholder="Pilih Role" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UI_CONSTANTS.ALL_FILTER_VALUE}>Semua Peran (Role)</SelectItem>
          <SelectItem value="teacher">{formatRoleLabel('teacher')}</SelectItem>
          <SelectItem value="leader">{formatRoleLabel('leader')}</SelectItem>
          <SelectItem value="vice_leader">{formatRoleLabel('vice_leader')}</SelectItem>
          <SelectItem value="treasurer">{formatRoleLabel('treasurer')}</SelectItem>
          <SelectItem value="secretary">{formatRoleLabel('secretary')}</SelectItem>
          <SelectItem value="equipment_team">{formatRoleLabel('equipment_team')}</SelectItem>
          <SelectItem value="contest_team">{formatRoleLabel('contest_team')}</SelectItem>
          <SelectItem value="social_media_team">{formatRoleLabel('social_media_team')}</SelectItem>
          <SelectItem value="member">{formatRoleLabel('member')}</SelectItem>
        </SelectContent>
      </Select>

      {/* Status Filter */}
      <RadioGroup
        name="user-status-filter"
        legend="Status akun"
        value={status}
        options={[
          { value: UI_CONSTANTS.ALL_FILTER_VALUE, label: 'Semua' },
          { value: 'active', label: 'Aktif' },
          { value: 'inactive', label: 'Nonaktif' },
        ]}
        onValueChange={onStatusChange}
        className="lg:min-w-fit lg:w-auto"
      />

      {/* Reset Filter Button */}
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
