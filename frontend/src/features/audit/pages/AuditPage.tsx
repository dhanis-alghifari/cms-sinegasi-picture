import { useMemo, useState } from 'react';
import { AlertCircle, History } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import { PageHeader } from '@/components/common/PageHeader';
import { PageLoader } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { Pagination } from '@/components/common/Pagination';

import { AuditFilter } from '../components/AuditFilter';
import { AuditTable } from '../components/AuditTable';
import { AuditMobileList } from '../components/AuditMobileList';
import { AuditDetailSheet } from '../components/AuditDetailSheet';
import { useAuditLogsQuery } from '../queries/useAuditQuery';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { formatResourceLabel } from '@/shared/utils/formatLabels';
import { formatNumber } from '@/shared/utils/formatNumber';
import { useIsMobile } from '@/hooks/use-mobile';
import type { AuditLog, AuditLogFilterParams } from '../types/audit.types';

const PAGE_SIZE = 20;

export function AuditPage() {
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState<AuditLogFilterParams>(() => ({
    page: 1,
    pageSize: PAGE_SIZE,
    table_name: searchParams.get('table_name') || undefined,
    record_id: searchParams.get('record_id') || undefined,
  }));
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const debouncedSearch = useDebouncedValue(filters.search ?? '', 300);
  const queryParams = useMemo(
    () => ({ ...filters, search: debouncedSearch || undefined }),
    [filters, debouncedSearch],
  );
  const { data, isLoading, isError, error, isFetching } = useAuditLogsQuery(queryParams);

  const handleReset = () => {
    setFilters({ page: 1, pageSize: PAGE_SIZE });
  };

  const logs = data?.data ?? [];

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-5 sm:p-6">
      <PageHeader
        title="Audit Trail"
        subtitle="Pantau siapa yang menambah, mengubah, atau menghapus data beserta alasan dan detail perubahannya."
      />

      <AuditFilter value={filters} onChange={setFilters} onReset={handleReset} />

      {filters.record_id && filters.table_name && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
          <div className="flex items-center gap-2 text-primary">
            <History size={14} />
            <span>Menampilkan riwayat record <strong>{filters.record_id}</strong> pada modul {formatResourceLabel(filters.table_name)}.</span>
          </div>
          <button type="button" onClick={handleReset} className="text-primary underline underline-offset-2">Tampilkan semua</button>
        </div>
      )}

      {isLoading ? (
        <PageLoader />
      ) : isError ? (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-semantic-danger/30 bg-semantic-danger/10 p-4 text-semantic-danger text-xs">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Audit trail tidak dapat dimuat.</p>
            <p className="mt-1">{error instanceof Error ? error.message : 'Periksa migration database dan koneksi backend.'}</p>
          </div>
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={History}
          title="Belum ada riwayat perubahan"
          description="Coba ubah filter atau lakukan perubahan data yang memiliki alasan untuk melihat catatan audit."
        />
      ) : (
        <>
          <div className="flex items-center justify-between text-xs text-ink-tertiary">
            <span>{isFetching ? 'Memperbarui data…' : `${formatNumber(data?.total ?? 0)} catatan audit`}</span>
            <span>Data terbaru berada di urutan paling atas.</span>
          </div>
          {isMobile ? <AuditMobileList logs={logs} onDetail={setSelectedLog} /> : <AuditTable logs={logs} onDetail={setSelectedLog} />}
          <Pagination
            page={data?.page ?? filters.page ?? 1}
            totalPages={data?.totalPages ?? 1}
            total={data?.total ?? 0}
            pageSize={data?.pageSize ?? PAGE_SIZE}
            onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
          />
        </>
      )}

      <AuditDetailSheet log={selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)} />
    </div>
  );
}
