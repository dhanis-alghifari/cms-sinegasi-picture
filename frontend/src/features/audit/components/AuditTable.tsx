import { Eye } from 'lucide-react';
import { Button } from '@/shared/ui/primitives/button';
import { Badge } from '@/shared/ui/primitives/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/primitives/table';
import type { AuditLog } from '../types/audit.types';
import {
  formatAuditActionLabel,
  formatFieldLabel,
  formatResourceLabel,
  formatRoleLabel,
} from '@/shared/utils/formatLabels';

interface AuditTableProps {
  logs: AuditLog[];
  onDetail: (log: AuditLog) => void;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Tanggal tidak valid';
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function actionVariant(action: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (action === 'DELETE') return 'destructive';
  if (action === 'INSERT') return 'default';
  if (action === 'UPDATE') return 'secondary';
  return 'outline';
}

export function AuditTable({ logs, onDetail }: AuditTableProps) {
  return (
    <div className="rounded-lg border border-hairline bg-surface-1 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-hairline hover:bg-transparent">
            <TableHead className="text-ink-muted text-xs">Waktu</TableHead>
            <TableHead className="text-ink-muted text-xs">Aktor</TableHead>
            <TableHead className="text-ink-muted text-xs">Modul / data</TableHead>
            <TableHead className="text-ink-muted text-xs">Perubahan</TableHead>
            <TableHead className="text-ink-muted text-xs">Alasan</TableHead>
            <TableHead className="text-right text-ink-muted text-xs">Detail</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id} className="border-hairline hover:bg-surface-2/60">
              <TableCell className="text-ink-subtle text-xs whitespace-nowrap">{formatDate(log.created_at)}</TableCell>
              <TableCell>
                <div className="min-w-32">
                  <p className="text-ink text-xs font-medium truncate">{log.actor?.nama || 'Aktor tidak diketahui'}</p>
                  <p className="text-ink-tertiary text-[10px] truncate">
                    {formatRoleLabel(log.actor?.role)}
                    {log.actor?.username ? ` · ${log.actor.username}` : ''}
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <p className="text-ink text-xs font-medium">{formatResourceLabel(log.table_name)}</p>
                {log.record_id && <p className="text-ink-tertiary text-[10px] font-mono truncate max-w-40">{log.record_id}</p>}
              </TableCell>
              <TableCell>
                <Badge variant={actionVariant(log.action)} className="text-[10px]">
                  {formatAuditActionLabel(log.action)}
                </Badge>
              </TableCell>
              <TableCell className="max-w-64">
                <p className="text-ink-subtle text-xs truncate" title={log.reason}>{log.reason || 'Alasan tidak tercatat'}</p>
                {log.changed_fields.length > 0 && (
                  <p className="text-ink-tertiary text-[10px] truncate">
                    Field: {log.changed_fields.slice(0, 3).map((field) => formatFieldLabel(field)).join(', ')}{log.changed_fields.length > 3 ? '…' : ''}
                  </p>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button type="button" variant="ghost" size="sm" onClick={() => onDetail(log)} className="h-8 text-xs text-primary hover:text-primary-hover hover:bg-primary/10">
                  <Eye size={14} className="mr-1.5" />
                  Lihat
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
