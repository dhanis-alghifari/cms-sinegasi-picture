
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
    <div className="grid grid-cols-1 gap-3 mb-4 sm:grid-cols-2 xl:flex xl:items-center">
      {/* Search Input */}
      <div className="relative flex-1">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
        <Input
          type="text"
          placeholder="Cari Username atau Nama Pengguna..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 bg-surface-1 border-hairline text-ink placeholder:text-ink-tertiary text-xs"
        />
      </div>

      {/* Role Filter */}
      <Select value={role} onValueChange={handleRoleValueChange}>
        <SelectTrigger className="w-full xl:w-44 bg-surface-1 border-hairline text-ink text-xs">
          <SelectValue placeholder="Pilih Role" />
        </SelectTrigger>
        <SelectContent className="bg-surface-3 border-hairline text-ink">
          <SelectItem value={UI_CONSTANTS.ALL_FILTER_VALUE}>Semua Peran (Role)</SelectItem>
          <SelectItem value="teacher">{formatRoleLabel('teacher')}</SelectItem>
          <SelectItem value="leader">{formatRoleLabel('leader')}</SelectItem>
          <SelectItem value="vice_leader">{formatRoleLabel('vice_leader')}</SelectItem>
          <SelectItem value="treasurer">{formatRoleLabel('treasurer')}</SelectItem>
          <SelectItem value="secretary">{formatRoleLabel('secretary')}</SelectItem>
          <SelectItem value="equipment_team">{formatRoleLabel('equipment_team')}</SelectItem>
          <SelectItem value="contest_team">{formatRoleLabel('contest_team')}</SelectItem>
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
        className="xl:w-auto"
      />

      {/* Reset Filter Button */}
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
