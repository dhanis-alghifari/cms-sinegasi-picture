import { Eye } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatAuditActionLabel, formatFieldLabel, formatResourceLabel, formatRoleLabel } from '@/shared/utils/formatLabels';
import type { AuditLog } from '../types/audit.types';

interface AuditMobileListProps {
  logs: AuditLog[];
  onDetail: (log: AuditLog) => void;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Tanggal tidak valid';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function actionVariant(action: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (action === 'DELETE') return 'destructive';
  if (action === 'INSERT') return 'default';
  if (action === 'UPDATE') return 'secondary';
  return 'outline';
}

export function AuditMobileList({ logs, onDetail }: AuditMobileListProps) {
  return (
    <div className="space-y-3" aria-label="Daftar audit trail versi ponsel">
      {logs.map((log) => (
        <article key={log.id} className="rounded-xl border border-hairline bg-surface-1 p-3 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{log.actor?.nama || 'Aktor tidak diketahui'}</p>
              <p className="mt-1 truncate text-xs text-ink-tertiary">{formatRoleLabel(log.actor?.role)} · {formatDate(log.created_at)}</p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => onDetail(log)} className="h-9 shrink-0 text-xs text-primary hover:bg-primary/10 hover:text-primary-hover"><Eye size={14} className="mr-1.5" />Lihat</Button>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-surface-2 p-3">
            <div className="min-w-0"><p className="text-xs font-medium text-ink">{formatResourceLabel(log.table_name)}</p><p className="truncate font-mono text-[10px] text-ink-tertiary">{log.record_id || 'Data umum'}</p></div>
            <Badge variant={actionVariant(log.action)} className="shrink-0 text-[10px]">{formatAuditActionLabel(log.action)}</Badge>
          </div>
          <p className="mt-3 line-clamp-3 text-xs text-ink-subtle">{log.reason || 'Alasan tidak tercatat'}</p>
          {log.changed_fields.length > 0 && <p className="mt-1 line-clamp-2 text-[10px] text-ink-tertiary">Field: {log.changed_fields.slice(0, 3).map((field) => formatFieldLabel(field)).join(', ')}{log.changed_fields.length > 3 ? '…' : ''}</p>}
        </article>
      ))}
    </div>
  );
}
