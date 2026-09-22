
import { lazy, Suspense, useState } from 'react';
import { Trophy } from 'lucide-react';

import { PageHeader } from '@/shared/ui/PageHeader';
import { ResponsivePageActions } from '@/shared/ui/ResponsivePageActions';
import { DataTableSkeleton, MetricCardsSkeleton, RefreshingIndicator } from '@/shared/ui/LoadingSkeletons';
import { QueryErrorState } from '@/shared/ui/QueryErrorState';
import { Pagination } from '@/shared/ui/Pagination';
import { AnimatedTabs } from '@/shared/ui/motion/animated-tabs';

import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { UI_CONSTANTS } from '@/shared/constants/ui';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { hasCapability } from '@/shared/auth/capabilities';

import { useContestsQuery, useContestSummaryQuery } from '../hooks/useContestsQuery';
import { useCreateContestMutation } from '../hooks/useCreateContestMutation';
import { useUpdateContestMutation } from '../hooks/useUpdateContestMutation';

import { ContestSummaryCards } from '../components/ContestSummaryCards';
import { ContestFilter } from '../components/ContestFilter';
import { ContestTable } from '../components/ContestTable';
import { ContestMobileList } from '../components/ContestMobileList';

import type { Contest } from '../types/contests.types';
import type { ContestFormValues } from '../schemas/contestSchema';
import { isContestScope, isContestStatus } from '../utils/contestLabels';

const ContestAchievementsPanel = lazy(() => import('../components/ContestAchievementsPanel').then((module) => ({ default: module.ContestAchievementsPanel })));
const CreateContestModal = lazy(() => import('../components/CreateContestModal').then((module) => ({ default: module.CreateContestModal })));
const ContestEntriesDialog = lazy(() => import('../components/ContestEntriesDialog').then((module) => ({ default: module.ContestEntriesDialog })));

export function ContestsPage() {
  const { user } = useAuthStore();
  const isMobile = useIsMobile();
  const canManage = hasCapability(user, 'contests.manage');

  // Filters
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState<string>(UI_CONSTANTS.ALL_FILTER_VALUE);
  const [statusFilter, setStatusFilter] = useState<string>(UI_CONSTANTS.ALL_FILTER_VALUE);
  const [page, setPage] = useState(1);
  const [activeView, setActiveView] = useState<'events' | 'achievements'>('events');
  const pageSize = UI_CONSTANTS.DEFAULT_PAGE_SIZE;

  const debouncedContestSearch = useDebouncedValue(search, UI_CONSTANTS.SEARCH_DEBOUNCE_MS);

  const handleSearchChange = (searchTerm: string) => {
    setSearch(searchTerm);
    setPage(1);
  };

  const handleScopeFilterChange = (nextScopeFilter: string) => {
    setScopeFilter(nextScopeFilter);
    setPage(1);
  };

  const handleStatusFilterChange = (nextStatusFilter: string) => {
    setStatusFilter(nextStatusFilter);
    setPage(1);
  };

  const handleActiveViewChange = (value: string) => {
    if (value === 'events' || value === 'achievements') setActiveView(value);
  };

  const handleResetContestFilters = () => {
    setSearch('');
    setScopeFilter(UI_CONSTANTS.ALL_FILTER_VALUE);
    setStatusFilter(UI_CONSTANTS.ALL_FILTER_VALUE);
    setPage(1);
  };

  // Modals
  const [isContestFormOpen, setIsContestFormOpen] = useState(false);
  const [selectedContest, setSelectedContest] = useState<Contest | null>(null);

  const [submitFilmOpen, setSubmitFilmOpen] = useState(false);
  const [targetContest, setTargetContest] = useState<Contest | null>(null);

  // Queries
  const {
    data: contestSummary,
    isLoading: isContestSummaryLoading,
    isError: isContestSummaryError,
    error: contestSummaryError,
    refetch: refetchContestSummary,
  } = useContestSummaryQuery();
  const {
    data: contestPage,
    isLoading: isContestPageLoading,
    isFetching: isContestPageFetching,
    isError: isContestPageError,
    error: contestPageError,
    refetch: refetchContestPage,
  } = useContestsQuery({
    page,
    pageSize,
    search: debouncedContestSearch || undefined,
    tingkat: isContestScope(scopeFilter) ? scopeFilter : undefined,
    status: isContestStatus(statusFilter) ? statusFilter : undefined,
  });

  // Mutations
  const createContestMutation = useCreateContestMutation();
  const updateContestMutation = useUpdateContestMutation();

  // Handlers
  const handleOpenCreateContest = () => {
    setSelectedContest(null);
    setIsContestFormOpen(true);
  };

  const handleOpenEditContest = (contest: Contest) => {
    setSelectedContest(contest);
    setIsContestFormOpen(true);
  };

  const handleOpenContestEntries = (contest: Contest) => {
    setTargetContest(contest);
    setSubmitFilmOpen(true);
  };

  const handleContestFormSubmit = async (formValues: ContestFormValues) => {
    const { change_reason: changeReason, ...contestFormPayload } = formValues;

    if (selectedContest) {
      await updateContestMutation.mutateAsync({
        id: selectedContest.id,
        payload: {
          nama_lomba: contestFormPayload.nama_lomba,
          kota: contestFormPayload.kota || null,
          tingkat: contestFormPayload.tingkat,
          ...(contestFormPayload.deadline !== selectedContest.deadline ? { deadline: contestFormPayload.deadline } : {}),
          status: contestFormPayload.status,
          tahun_event: contestFormPayload.tahun_event,
          website_url: contestFormPayload.website_url || undefined,
          deskripsi: contestFormPayload.deskripsi || undefined,
        },
        changeReason: changeReason ?? '',
      });
    } else {
      await createContestMutation.mutateAsync({
        payload: {
          nama_lomba: contestFormPayload.nama_lomba,
          kota: contestFormPayload.kota || null,
          tingkat: contestFormPayload.tingkat,
          deadline: contestFormPayload.deadline,
          status: contestFormPayload.status,
          tahun_event: contestFormPayload.tahun_event,
          website_url: contestFormPayload.website_url || undefined,
          deskripsi: contestFormPayload.deskripsi || undefined,
        },
      });
    }
  };

  return (
    <div className="space-y-5 px-4 py-5 sm:space-y-6 sm:p-6">
      <PageHeader
        title="Perlombaan &amp; Prestasi Karya Siswa"
        subtitle="Direktori festival, pendaftaran karya film/media, dan rekapitulasi penghargaan atau hasil kejuaraan."
        actions={
          canManage ? (
            <ResponsivePageActions
              actions={[{
                id: 'add-contest',
                label: 'Tambah Event Festival',
                icon: Trophy,
                onSelect: handleOpenCreateContest,
              }]}
            />
          ) : undefined
        }
      />

      {isContestSummaryLoading && (
        <MetricCardsSkeleton count={4} label="Memuat ringkasan perlombaan..." />
      )}
      {isContestSummaryError && (
        <QueryErrorState
          title="Ringkasan perlombaan belum dapat dimuat"
          error={contestSummaryError}
          onRetry={refetchContestSummary}
        />
      )}
      {!isContestSummaryLoading && !isContestSummaryError && (
        <ContestSummaryCards summary={contestSummary} />
      )}

      <AnimatedTabs
        id="contest-tabs"
        value={activeView}
        onValueChange={(val) => handleActiveViewChange(val)}
        ariaLabel="Perlombaan dan prestasi"
        ariaControls="contest-tab-panel"
        className="w-full md:w-fit"
        tabs={[
          { value: 'events', label: 'Event & pendaftaran' },
          { value: 'achievements', label: 'Karya & prestasi selesai' },
        ]}
      />

      <div id="contest-tab-panel" role="tabpanel" aria-labelledby={`contest-tabs-${activeView}`} className="w-full">
        {activeView === 'achievements' && (
          <div className="pt-2">
            <Suspense fallback={<DataTableSkeleton columns={5} rows={4} mobile={isMobile} label="Memuat rekap prestasi..." />}>
              <ContestAchievementsPanel />
            </Suspense>
          </div>
        )}

        {activeView === 'events' && (
          <div className="space-y-4 pt-2">
            <ContestFilter
              search={search}
              onSearchChange={handleSearchChange}
              tingkat={scopeFilter}
              onTingkatChange={handleScopeFilterChange}
              status={statusFilter}
              onStatusChange={handleStatusFilterChange}
              onReset={handleResetContestFilters}
            />

            {isContestPageFetching && !isContestPageLoading && <RefreshingIndicator visible />}
            {isContestPageLoading && (
              <DataTableSkeleton columns={7} rows={6} mobile={isMobile} label="Memuat daftar perlombaan..." />
            )}
            {isContestPageError && (
              <QueryErrorState
                title="Daftar perlombaan belum dapat dimuat"
                error={contestPageError}
                onRetry={refetchContestPage}
              />
            )}
            {!isContestPageLoading && !isContestPageError && (
              <div className="space-y-4">
                {isMobile ? (
                  <ContestMobileList contests={contestPage?.data ?? []} onEdit={handleOpenEditContest} onManageEntries={handleOpenContestEntries} canManage={canManage} />
                ) : (
                  <ContestTable contests={contestPage?.data ?? []} onEdit={handleOpenEditContest} onManageEntries={handleOpenContestEntries} canManage={canManage} />
                )}
                <Pagination
                  page={contestPage?.page ?? page}
                  totalPages={contestPage?.totalPages ?? 1}
                  total={contestPage?.total ?? 0}
                  pageSize={contestPage?.pageSize ?? pageSize}
                  onPageChange={setPage}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {canManage && (
        <Suspense fallback={null}>
          {isContestFormOpen && (
            <CreateContestModal
              open={isContestFormOpen}
              onOpenChange={setIsContestFormOpen}
              contest={selectedContest}
              onSubmit={handleContestFormSubmit}
              isLoading={createContestMutation.isPending || updateContestMutation.isPending}
              error={createContestMutation.error || updateContestMutation.error}
            />
          )}
          {submitFilmOpen && (
            <ContestEntriesDialog
              key={`${targetContest?.id ?? 'none'}-${submitFilmOpen ? 'open' : 'closed'}`}
              open={submitFilmOpen}
              onOpenChange={setSubmitFilmOpen}
              contest={targetContest}
            />
          )}
        </Suspense>
      )}
    </div>
  );
}
