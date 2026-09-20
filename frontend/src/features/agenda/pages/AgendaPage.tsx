import { useRef, useState, type ReactNode } from 'react';
import { CalendarDays, FileText, Plus, Search } from 'lucide-react';

import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { hasCapability } from '@/shared/auth/capabilities';
import { UI_CONSTANTS } from '@/shared/constants/ui';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { DataTableSkeleton, RefreshingIndicator } from '@/shared/ui/LoadingSkeletons';
import { EmptyState } from '@/shared/ui/EmptyState';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Pagination } from '@/shared/ui/Pagination';
import { QueryErrorState } from '@/shared/ui/QueryErrorState';
import { ReasonDialog } from '@/shared/ui/ActionDialog';
import { ResponsivePageActions } from '@/shared/ui/ResponsivePageActions';
import { Button } from '@/shared/ui/primitives/button';
import { Input } from '@/shared/ui/primitives/input';
import type { ReportPrintFormat } from '@/shared/types/report';

import { AgendaDetailDialog } from '../components/AgendaDetailDialog';
import { AgendaDateRangeFilter } from '../components/AgendaDateRangeFilter';
import { AgendaFormDialog } from '../components/AgendaFormDialog';
import { AgendaMobileList } from '../components/AgendaMobileList';
import { AgendaReportDialog } from '../components/AgendaReportDialog';
import { AgendaTable } from '../components/AgendaTable';
import { useAgendaArchiveMutation, useAgendaCreateMutation, useAgendaPhotoMutation, useAgendaQuery, useAgendaReportQuery, useAgendaUpdateMutation } from '../hooks/useAgendaQueries';
import { formatAgendaReportPeriod, getAgendaDateRangeError } from '../utils/agendaDateRange';
import { printAgendaReport } from '../utils/printAgendaReport';
import type { AgendaActivity, AgendaFilters, AgendaFormValues } from '../types/agenda.types';

function jakartaToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

export function AgendaPage() {
  const { user } = useAuthStore();
  const isMobile = useIsMobile();
  const canWrite = hasCapability(user, 'agenda.write');
  const canArchive = hasCapability(user, 'agenda.archive');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [editing, setEditing] = useState<AgendaActivity | null>(null);
  const [selected, setSelected] = useState<AgendaActivity | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<AgendaActivity | null>(null);
  const formIdempotencyKey = useRef<string | null>(null);
  const photoIdempotencyKeys = useRef(new Map<string, string>());
  const debouncedSearch = useDebouncedValue(search, UI_CONSTANTS.SEARCH_DEBOUNCE_MS);
  const rangeError = getAgendaDateRangeError({ from: dateFrom, to: dateTo });
  const filters: AgendaFilters = {
    search: debouncedSearch || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    page,
    pageSize: UI_CONSTANTS.DEFAULT_PAGE_SIZE,
  };
  const agendaQuery = useAgendaQuery(filters, !rangeError);
  const reportFilters: AgendaFilters = { ...filters, page: 1, pageSize: 100 };
  const reportQuery = useAgendaReportQuery(reportFilters, reportOpen && !rangeError);
  const createMutation = useAgendaCreateMutation();
  const updateMutation = useAgendaUpdateMutation();
  const photoMutation = useAgendaPhotoMutation();
  const archiveMutation = useAgendaArchiveMutation();
  const rows = agendaQuery.data?.data ?? [];
  const reportRows = reportQuery.data?.data ?? [];
  const reportPeriodLabel = formatAgendaReportPeriod(reportFilters.date_from, reportFilters.date_to, reportRows);

  const resetFilters = () => {
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const openCreate = () => {
    createMutation.reset();
    updateMutation.reset();
    photoMutation.reset();
    formIdempotencyKey.current = crypto.randomUUID();
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (row: AgendaActivity) => {
    createMutation.reset();
    updateMutation.reset();
    photoMutation.reset();
    formIdempotencyKey.current = crypto.randomUUID();
    setEditing(row);
    setFormOpen(true);
  };

  const openDetail = (row: AgendaActivity) => {
    setSelected(row);
    setDetailOpen(true);
  };

  const handleSubmit = async (values: AgendaFormValues) => {
    let saved: AgendaActivity;
    const idempotencyKey = formIdempotencyKey.current ?? crypto.randomUUID();
    formIdempotencyKey.current = idempotencyKey;

    if (editing) {
      saved = await updateMutation.mutateAsync({ id: editing.id, values, version: editing.version, idempotencyKey });
    } else {
      saved = await createMutation.mutateAsync({ values, idempotencyKey });
    }

    if (values.photo) {
      const fileKey = `${saved.id}:${values.photo.name}:${values.photo.size}:${values.photo.lastModified}`;
      const photoIdempotencyKey = photoIdempotencyKeys.current.get(fileKey) ?? crypto.randomUUID();
      photoIdempotencyKeys.current.set(fileKey, photoIdempotencyKey);
      await photoMutation.mutateAsync({ id: saved.id, file: values.photo, idempotencyKey: photoIdempotencyKey });
      photoIdempotencyKeys.current.delete(fileKey);
    }

    formIdempotencyKey.current = null;
    setPage(1);
  };

  let agendaContent: ReactNode;
  if (rows.length === 0) {
    agendaContent = <EmptyState icon={CalendarDays} title="Belum ada agenda kegiatan" description="Tambahkan laporan kegiatan yang sudah berlangsung." />;
  } else if (isMobile) {
    agendaContent = <AgendaMobileList rows={rows} onView={openDetail} onEdit={openEdit} onArchive={setArchiveTarget} canWrite={canWrite} canArchive={canArchive} />;
  } else {
    agendaContent = <AgendaTable rows={rows} onView={openDetail} onEdit={openEdit} onArchive={setArchiveTarget} canWrite={canWrite} canArchive={canArchive} />;
  }

  return (
    <div className="space-y-5 px-4 py-5 sm:space-y-6 sm:p-6">
      <PageHeader
        title="Agenda kegiatan"
        subtitle="Catat kegiatan ekstrakurikuler yang berlangsung hari ini atau sebelumnya."
        actions={(
          <ResponsivePageActions
            actions={[
              ...(canWrite ? [{ id: 'add-agenda', label: 'Tambah agenda', description: 'Catat kegiatan yang sudah berlangsung.', icon: Plus, onSelect: openCreate }] : []),
              { id: 'report-agenda', label: 'Laporan agenda', description: 'Buka laporan kegiatan.', icon: FileText, onSelect: () => setReportOpen(true), disabled: Boolean(rangeError) || agendaQuery.isPending },
            ]}
            mobileLabel="Agenda"
          />
        )}
      />

      <section className="rounded-xl border border-hairline bg-surface-1 p-3 sm:p-4" aria-label="Filter agenda">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_24rem_auto] lg:items-end">
          <label className="flex min-w-0 flex-col gap-1 text-[11px] text-ink-tertiary">
            <span>Cari agenda</span>
            <div className="relative">
              <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
              <Input aria-label="Cari agenda" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Cari kegiatan, uraian, pengajar, atau PIC..." className="h-10 pl-9 text-xs" />
            </div>
          </label>
          <AgendaDateRangeFilter
            from={dateFrom}
            to={dateTo}
            maxDate={jakartaToday()}
            error={rangeError}
            onChange={({ from, to }) => {
              setDateFrom(from);
              setDateTo(to);
              setPage(1);
            }}
          />
          <Button type="button" variant="outline" onClick={resetFilters} className="h-10 w-full self-end text-xs lg:w-auto">Reset</Button>
        </div>
      </section>

      {!rangeError && agendaQuery.isPending && <DataTableSkeleton columns={6} rows={6} mobile={isMobile} label="Memuat agenda kegiatan..." />}
      {!rangeError && agendaQuery.isError && <QueryErrorState title="Agenda belum dapat dimuat" error={agendaQuery.error} onRetry={() => void agendaQuery.refetch()} />}
      {!rangeError && !agendaQuery.isPending && !agendaQuery.isError && (
        <section className="space-y-4">
          <RefreshingIndicator visible={agendaQuery.isFetching} />
          {agendaContent}
          <Pagination page={agendaQuery.data?.page ?? page} totalPages={agendaQuery.data?.totalPages ?? 1} total={agendaQuery.data?.total ?? 0} pageSize={agendaQuery.data?.pageSize ?? UI_CONSTANTS.DEFAULT_PAGE_SIZE} onPageChange={setPage} />
        </section>
      )}

      {canWrite && <AgendaFormDialog key={`${editing?.id ?? 'new'}-${formOpen ? 'open' : 'closed'}`} open={formOpen} onOpenChange={setFormOpen} initialData={editing} onSubmit={handleSubmit} isLoading={createMutation.isPending || updateMutation.isPending || photoMutation.isPending} error={createMutation.error || updateMutation.error || photoMutation.error} />}
      <AgendaDetailDialog activity={selected} open={detailOpen} onOpenChange={setDetailOpen} />
      <AgendaReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        rows={reportRows}
        periodLabel={reportPeriodLabel}
        isLoading={reportQuery.isPending}
        error={reportQuery.error}
        truncated={reportQuery.data?.truncated}
        onRetry={() => void reportQuery.refetch()}
        onPrint={(format: ReportPrintFormat) => printAgendaReport(format)}
      />
      {canArchive && (
        <ReasonDialog
          dialog={{ open: Boolean(archiveTarget), onOpenChange: (open) => { if (!open) setArchiveTarget(null); } }}
          content={{ title: 'Arsipkan agenda', description: archiveTarget ? `Agenda “${archiveTarget.activity_name}” tidak akan tampil di daftar aktif.` : '' }}
          action={{ confirmLabel: 'Arsipkan', onConfirm: async (reason) => { if (!archiveTarget) return; await archiveMutation.mutateAsync({ id: archiveTarget.id, reason, idempotencyKey: crypto.randomUUID() }); setArchiveTarget(null); } }}
          reason={{ label: 'Alasan pengarsipan *', placeholder: 'Contoh: agenda ganda atau data uji.' }}
          destructive
        />
      )}
    </div>
  );
}
