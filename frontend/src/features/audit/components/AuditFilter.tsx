import { RotateCcw, Search } from 'lucide-react';
import { Button } from '@/shared/ui/primitives/button';
import { Input } from '@/shared/ui/primitives/input';
import { Label } from '@/shared/ui/primitives/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/primitives/select';
import { AUDIT_ACTION_VALUES } from '../types/audit.types';
import type { AuditLogFilterParams } from '../types/audit.types';
import { AUDIT_ACTION_LABELS } from '@/shared/utils/formatLabels';
import { isOneOf } from '@/shared/utils/isOneOf';
import { UI_CONSTANTS } from '@/shared/constants/ui';

interface AuditFilterProps {
  value: AuditLogFilterParams;
  onChange: (value: AuditLogFilterParams) => void;
  onReset: () => void;
}

export function AuditFilter({ value, onChange, onReset }: AuditFilterProps) {
  const setValue = (key: keyof AuditLogFilterParams, nextValue: string | undefined) => {
    onChange({ ...value, page: 1, [key]: nextValue || undefined });
  };

  const handleTableNameValueChange = (nextValue: string | null) => {
    setValue(
      'table_name',
      nextValue && nextValue !== UI_CONSTANTS.ALL_FILTER_VALUE ? nextValue : undefined,
    );
  };

  const handleActionValueChange = (nextValue: string | null) => {
    setValue('action', isOneOf(nextValue, AUDIT_ACTION_VALUES) ? nextValue : undefined);
  };

  return (
    <div className="space-y-3 rounded-lg border border-hairline bg-surface-1 p-4">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
        <div className="min-w-0 space-y-1">
          <Label htmlFor="audit-search" className="text-ink-muted text-xs">Cari audit</Label>
          <div className="relative">
            <Search size={14} aria-hidden="true" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-tertiary" />
            <Input
              id="audit-search"
              aria-label="Cari audit"
              value={value.search ?? ''}
              onChange={(event) => setValue('search', event.target.value)}
              placeholder="Nama aktor, modul, atau alasan perubahan..."
              className="h-9 w-full min-w-0 bg-surface-2 pl-8 text-xs text-ink"
            />
          </div>
        </div>

        <div className="min-w-0 space-y-1">
          <Label className="text-ink-muted text-xs">Modul</Label>
          <Select value={value.table_name ?? UI_CONSTANTS.ALL_FILTER_VALUE} onValueChange={handleTableNameValueChange}>
            <SelectTrigger aria-label="Filter modul audit" className="h-9 w-full bg-surface-2 text-xs text-ink">
              <SelectValue placeholder="Semua modul" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UI_CONSTANTS.ALL_FILTER_VALUE}>Semua modul</SelectItem>
              <SelectItem value="students">Siswa</SelectItem>
              <SelectItem value="classes">Kelas</SelectItem>
              <SelectItem value="attendance">Absensi</SelectItem>
              <SelectItem value="assignments">Tugas</SelectItem>
              <SelectItem value="grades">Nilai</SelectItem>
              <SelectItem value="equipment">Alat</SelectItem>
              <SelectItem value="borrowings">Peminjaman</SelectItem>
              <SelectItem value="cash_transactions">Kas</SelectItem>
              <SelectItem value="cash_settings">Pengaturan kas</SelectItem>
              <SelectItem value="cash_disputes">Sanggahan kas</SelectItem>
              <SelectItem value="debt_records">Utang kas</SelectItem>
              <SelectItem value="contests">Lomba</SelectItem>
              <SelectItem value="users">Pengguna</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-0 space-y-1">
          <Label className="text-ink-muted text-xs">Jenis perubahan</Label>
          <Select value={value.action ?? UI_CONSTANTS.ALL_FILTER_VALUE} onValueChange={handleActionValueChange}>
            <SelectTrigger aria-label="Filter jenis perubahan audit" className="h-9 w-full bg-surface-2 text-xs text-ink">
              <SelectValue placeholder="Semua perubahan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UI_CONSTANTS.ALL_FILTER_VALUE}>Semua perubahan</SelectItem>
              {Object.entries(AUDIT_ACTION_LABELS).map(([action, label]) => (
                <SelectItem key={action} value={action}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end">
          <Button type="button" variant="outline" onClick={onReset} className="h-9 w-full whitespace-nowrap bg-surface-2 text-xs text-ink-subtle lg:w-auto">
            <RotateCcw size={14} aria-hidden="true" className="mr-1.5" />
            Reset filter
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-lg">
        <div className="space-y-1">
          <Label htmlFor="audit-date-from" className="text-ink-muted text-xs">Dari tanggal</Label>
          <Input id="audit-date-from" type="date" aria-label="Tanggal mulai audit" value={value.date_from ?? ''} onChange={(event) => setValue('date_from', event.target.value)} className="h-9 w-full bg-surface-2 text-xs text-ink" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="audit-date-to" className="text-ink-muted text-xs">Sampai tanggal</Label>
          <Input id="audit-date-to" type="date" aria-label="Tanggal selesai audit" value={value.date_to ?? ''} onChange={(event) => setValue('date_to', event.target.value)} className="h-9 w-full bg-surface-2 text-xs text-ink" />
        </div>
      </div>
    </div>
  );
}
