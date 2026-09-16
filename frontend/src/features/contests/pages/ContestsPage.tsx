
import { lazy, Suspense, useState } from 'react';
import { Trophy } from 'lucide-react';

import { PageHeader } from '@/shared/ui/PageHeader';
import { ResponsivePageActions } from '@/shared/ui/ResponsivePageActions';
import { PageLoader } from '@/shared/ui/LoadingSpinner';
import { QueryErrorState } from '@/shared/ui/QueryErrorState';
import { Pagination } from '@/shared/ui/Pagination';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/primitives/tabs';

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
          kota: contestFormPayload.kota,
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
          kota: contestFormPayload.kota,
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
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:space-y-6 sm:p-6">
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
        <PageLoader label="Memuat ringkasan perlombaan..." />
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

      <Tabs
        value={activeView}
        onValueChange={handleActiveViewChange}
        className="w-full"
      >
        <TabsList aria-label="Perlombaan dan prestasi" className="grid min-h-12 w-full grid-cols-2 border border-hairline bg-surface-2 p-1 sm:w-fit sm:min-h-9 sm:gap-1">
          <TabsTrigger value="events" className="min-h-10 px-3 text-xs sm:min-h-9">Event &amp; pendaftaran</TabsTrigger>
          <TabsTrigger value="achievements" className="min-h-10 px-3 text-xs sm:min-h-9">Karya &amp; prestasi</TabsTrigger>
        </TabsList>

        <TabsContent value="achievements" className="pt-2">
          {activeView === 'achievements' && (
            <Suspense fallback={<PageLoader label="Memuat rekap prestasi..." />}>
              <ContestAchievementsPanel />
            </Suspense>
          )}
        </TabsContent>

        <TabsContent value="events" className="space-y-4 pt-2">
          <ContestFilter
            search={search}
            onSearchChange={handleSearchChange}
            tingkat={scopeFilter}
            onTingkatChange={handleScopeFilterChange}
            status={statusFilter}
            onStatusChange={handleStatusFilterChange}
            onReset={handleResetContestFilters}
          />

          {isContestPageLoading && (
            <PageLoader label="Memuat daftar perlombaan..." />
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
        </TabsContent>
      </Tabs>

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
