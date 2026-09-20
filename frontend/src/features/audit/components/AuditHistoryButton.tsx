import { History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/shared/ui/primitives/button';
import { useCanViewAuditHistory } from '../hooks/useCanViewAuditHistory';

type AuditHistoryButtonProps = {
  tableName: string;
  recordId: string;
};

/** Opens the audit history for a record when the current user can view it. */
export function AuditHistoryButton({ tableName, recordId }: AuditHistoryButtonProps) {
  const navigate = useNavigate();
  const canViewAuditHistory = useCanViewAuditHistory();

  if (!canViewAuditHistory) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title="Lihat riwayat perubahan"
      aria-label="Lihat riwayat perubahan"
      onClick={() => navigate(`/audit-logs?table_name=${encodeURIComponent(tableName)}&record_id=${encodeURIComponent(recordId)}`)}
      className="h-8 w-8 text-ink-tertiary hover:text-primary hover:bg-primary/10"
    >
      <History size={14} />
    </Button>
  );
}
