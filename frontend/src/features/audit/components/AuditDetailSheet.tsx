import { useMemo } from 'react';
import { AlertCircle, CheckCircle2, Clock3, UserRound } from 'lucide-react';
import { Button } from '@/shared/ui/primitives/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/shared/ui/primitives/sheet';
import { useAuditEntryQuery, useAuditRecordHistoryQuery } from '../hooks/useAuditQuery';
import type { AuditLog } from '../types/audit.types';
import {
  formatAuditActionLabel,
  formatEnumLabel,
  formatFieldLabel,
  formatResourceLabel,
  formatRoleLabel,
  formatSourceLabel,
  formatStatusLabel,
} from '@/shared/utils/formatLabels';
import { formatNumber } from '@/shared/utils/formatNumber';

interface AuditDetailSheetProps {
  log: AuditLog | null;
  onOpenChange: (open: boolean) => void;
}

function displayValue(value: unknown, field: string): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Ya' : 'Tidak';
  if (typeof value === 'object') return JSON.stringify(value);
  if (field === 'status' || field.endsWith('_status')) return formatStatusLabel(value);
  if (field === 'role') return formatRoleLabel(value);
  if (['type', 'tipe', 'category', 'kategori', 'source'].includes(field)) return formatEnumLabel(value);
  return String(value);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Tanggal tidak valid';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeStyle: 'short' }).format(date);
}

export function AuditDetailSheet({ log, onOpenChange }: AuditDetailSheetProps) {
  const entryQuery = useAuditEntryQuery(log?.id);
  const historyQuery = useAuditRecordHistoryQuery(log?.table_name, log?.record_id);
  const data = historyQuery.data;
  const detail = entryQuery.data?.data || log;

  const fields = useMemo(() => {
    const oldValues = detail?.old_values || {};
    const newValues = detail?.new_values || {};
    const keys = new Set([...Object.keys(oldValues), ...Object.keys(newValues), ...(detail?.changed_fields || [])]);
    return [...keys].filter((key) => ![
      'password', 'password_hash', 'token', 'access_token', 'refresh_token',
      'secret', 'api_key', 'apikey', 'authorization', 'cookie',
    ].includes(key.toLowerCase()));
  }, [detail]);

  return (
    <Sheet open={Boolean(log)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl bg-surface-1 border-hairline text-ink p-0 gap-0">
        <SheetHeader className="border-b border-hairline pr-12">
          <SheetTitle className="text-ink text-base">Detail perubahan data</SheetTitle>
          <SheetDescription className="text-ink-subtle text-xs">
            Periksa siapa yang melakukan perubahan, alasan, dan perbedaan nilai sebelum/sesudah.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-5">
          {(entryQuery.isLoading || historyQuery.isLoading) && <p className="text-ink-subtle text-xs">Memuat riwayat data…</p>}
          {(entryQuery.isError || historyQuery.isError) && <p className="flex items-center gap-2 text-semantic-danger text-xs"><AlertCircle size={14} /> Riwayat detail gagal dimuat.</p>}

          {detail && (
            <>
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-hairline bg-surface-2/60 p-3">
                <div className="col-span-2 flex items-center gap-2">
                  <UserRound size={14} className="text-primary" />
                  <div>
                    <p className="text-ink text-xs font-semibold">{detail.actor?.nama || 'Aktor tidak diketahui'}</p>
                    <p className="text-ink-tertiary text-[10px]">{formatRoleLabel(detail.actor?.role)}{detail.actor?.username ? ` · ${detail.actor.username}` : ''}</p>
                  </div>
                </div>
                <div>
                  <p className="text-ink-tertiary text-[10px]">Modul</p>
                  <p className="text-ink text-xs font-medium">{formatResourceLabel(detail.table_name)}</p>
                </div>
                <div>
                  <p className="text-ink-tertiary text-[10px]">Aksi</p>
                  <p className="text-ink text-xs font-medium">{formatAuditActionLabel(detail.action)}</p>
                </div>
                <div className="col-span-2 flex items-start gap-2">
                  <Clock3 size={14} className="mt-0.5 text-ink-tertiary" />
                  <p className="text-ink-subtle text-xs">{formatDate(detail.created_at)}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-ink-muted text-xs font-semibold">Alasan perubahan</p>
                <div className="rounded-lg border border-hairline bg-surface-2 p-3 text-ink text-xs">
                  {detail.reason || 'Alasan tidak tercatat'}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-ink-muted text-xs font-semibold">Perbandingan nilai</p>
                {fields.length === 0 ? (
                  <p className="text-ink-tertiary text-xs">Tidak ada rincian field yang tersedia.</p>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-hairline">
                    <div className="grid grid-cols-[1.1fr_1fr_1fr] bg-surface-2 px-3 py-2 text-[10px] font-semibold text-ink-muted">
                      <span>Field</span><span>Sebelum</span><span>Sesudah</span>
                    </div>
                    {fields.map((field) => (
                      <div key={field} className="grid grid-cols-[1.1fr_1fr_1fr] gap-2 border-t border-hairline px-3 py-2 text-[10px]">
                        <span className="text-ink font-medium break-words">{formatFieldLabel(field)}</span>
                        <span className="text-semantic-danger break-words">{displayValue(detail.old_values?.[field], field)}</span>
                        <span className="text-semantic-success break-words">{displayValue(detail.new_values?.[field], field)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <details className="rounded-lg border border-hairline bg-surface-2/50 p-3">
                <summary className="cursor-pointer text-ink-muted text-xs font-medium">Metadata teknis</summary>
                <div className="mt-3 space-y-2 text-[10px] text-ink-tertiary break-all">
                  <p><span className="text-ink-subtle">Record ID:</span> {detail.record_id || '—'}</p>
                  <p><span className="text-ink-subtle">Request ID:</span> {detail.request_id || '—'}</p>
                  <p><span className="text-ink-subtle">Operation ID:</span> {detail.operation_id || '—'}</p>
                  <p><span className="text-ink-subtle">Sumber:</span> {formatSourceLabel(detail.source)}</p>
                </div>
              </details>

              {data && data.total > 1 && (
                <p className="flex items-center gap-2 text-ink-tertiary text-xs"><CheckCircle2 size={14} className="text-semantic-success" /> Record ini memiliki {formatNumber(data.total)} riwayat perubahan.</p>
              )}
            </>
          )}
        </div>

        <SheetFooter className="border-t border-hairline">
          <SheetClose render={<Button variant="outline" className="w-full bg-surface-2 border-hairline text-ink text-xs" />}>Tutup</SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
