import { RotateCcw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AuditAction, AuditLogFilterParams } from '../types/audit.types';
import { AUDIT_ACTION_LABELS } from '@/shared/utils/formatLabels';

interface AuditFilterProps {
  value: AuditLogFilterParams;
  onChange: (value: AuditLogFilterParams) => void;
  onReset: () => void;
}

export function AuditFilter({ value, onChange, onReset }: AuditFilterProps) {
  const setValue = (key: keyof AuditLogFilterParams, nextValue: string | undefined) => {
    onChange({ ...value, page: 1, [key]: nextValue || undefined });
  };

  return (
    <div className="rounded-lg border border-hairline bg-surface-1 p-4 space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="space-y-1 xl:col-span-2">
          <Label htmlFor="audit-search" className="text-ink-muted text-xs">Cari audit</Label>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-tertiary" />
            <Input
              id="audit-search"
              value={value.search ?? ''}
              onChange={(event) => setValue('search', event.target.value)}
              placeholder="Nama aktor, modul, atau alasan perubahan..."
              className="pl-8 bg-surface-2 border-hairline text-ink text-xs"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-ink-muted text-xs">Modul</Label>
          <Select value={value.table_name ?? 'all'} onValueChange={(next) => setValue('table_name', next && next !== 'all' ? next : undefined)}>
            <SelectTrigger className="w-full bg-surface-2 border-hairline text-ink text-xs">
              <SelectValue placeholder="Semua modul" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua modul</SelectItem>
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

        <div className="space-y-1">
          <Label className="text-ink-muted text-xs">Jenis perubahan</Label>
          <Select value={value.action ?? 'all'} onValueChange={(next) => setValue('action', next && next !== 'all' ? next as AuditAction : undefined)}>
            <SelectTrigger className="w-full bg-surface-2 border-hairline text-ink text-xs">
              <SelectValue placeholder="Semua perubahan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua perubahan</SelectItem>
              {Object.entries(AUDIT_ACTION_LABELS).map(([action, label]) => (
                <SelectItem key={action} value={action}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end">
          <Button type="button" variant="outline" onClick={onReset} className="w-full bg-surface-2 border-hairline text-ink-subtle text-xs">
            <RotateCcw size={14} className="mr-1.5" />
            Reset filter
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:max-w-md">
        <div className="space-y-1">
          <Label htmlFor="audit-date-from" className="text-ink-muted text-xs">Dari tanggal</Label>
          <Input id="audit-date-from" type="date" value={value.date_from ?? ''} onChange={(event) => setValue('date_from', event.target.value)} className="bg-surface-2 border-hairline text-ink text-xs" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="audit-date-to" className="text-ink-muted text-xs">Sampai tanggal</Label>
          <Input id="audit-date-to" type="date" value={value.date_to ?? ''} onChange={(event) => setValue('date_to', event.target.value)} className="bg-surface-2 border-hairline text-ink text-xs" />
        </div>
      </div>
    </div>
  );
}
