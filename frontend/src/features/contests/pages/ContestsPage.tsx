// src/features/contests/pages/ContestsPage.tsx
// Thin orchestration page for Film Contests & Achievements Management

import { useState } from 'react';
import { Trophy } from 'lucide-react';

import { PageHeader } from '@/shared/ui/PageHeader';
import { ResponsivePageActions } from '@/shared/ui/ResponsivePageActions';
import { PageLoader } from '@/shared/ui/LoadingSpinner';
import { Pagination } from '@/shared/ui/Pagination';

import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { hasCapability } from '@/shared/auth/capabilities';

import { useContestsQuery, useContestSummaryQuery } from '../hooks/useContestsQuery';
import { useCreateContestMutation } from '../hooks/useCreateContestMutation';
import { useUpdateContestMutation } from '../hooks/useUpdateContestMutation';

import { ContestSummaryCards } from '../components/ContestSummaryCards';
import { ContestFilter } from '../components/ContestFilter';
import { ContestTable } from '../components/ContestTable';
import { ContestMobileList } from '../components/ContestMobileList';
import { CreateContestModal } from '../components/CreateContestModal';
import { ContestEntriesDialog } from '../components/ContestEntriesDialog';
import { ContestAchievementsPanel } from '../components/ContestAchievementsPanel';

import type { Contest } from '../types/contests.types';
import type { ContestFormValues } from '../schemas/contestSchema';
import { isContestScope, isContestStatus } from '../utils/contestLabels';

export function ContestsPage() {
  const { user } = useAuthStore();
  const isMobile = useIsMobile();
  const canManage = hasCapability(user, 'contests.manage');

  // Filters
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [activeView, setActiveView] = useState<'events' | 'achievements'>('events');
  const pageSize = 10;

  const debouncedContestSearch = useDebouncedValue(search, 300);

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

  const handleResetContestFilters = () => {
    setSearch('');
    setScopeFilter('all');
    setStatusFilter('all');
    setPage(1);
  };

  // Modals
  const [isContestFormOpen, setIsContestFormOpen] = useState(false);
  const [selectedContest, setSelectedContest] = useState<Contest | null>(null);

  const [submitFilmOpen, setSubmitFilmOpen] = useState(false);
  const [targetContest, setTargetContest] = useState<Contest | null>(null);

  // Queries
  const { data: contestSummary, isLoading: isContestSummaryLoading } = useContestSummaryQuery();
  const { data: contestPage, isLoading: isContestPageLoading } = useContestsQuery({
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

      {/* Summary Cards */}
      {isContestSummaryLoading ? <PageLoader /> : <ContestSummaryCards summary={contestSummary} />}

      <div className="flex w-full gap-1 border-b border-hairline" role="tablist" aria-label="Perlombaan dan prestasi">
        <button type="button" role="tab" aria-selected={activeView === 'events'} onClick={() => setActiveView('events')} className={`border-b-2 px-3 py-2 text-xs font-semibold transition-colors ${activeView === 'events' ? 'border-primary text-primary' : 'border-transparent text-ink-tertiary hover:text-ink'}`}>Event &amp; pendaftaran</button>
        <button type="button" role="tab" aria-selected={activeView === 'achievements'} onClick={() => setActiveView('achievements')} className={`border-b-2 px-3 py-2 text-xs font-semibold transition-colors ${activeView === 'achievements' ? 'border-primary text-primary' : 'border-transparent text-ink-tertiary hover:text-ink'}`}>Karya &amp; prestasi</button>
      </div>

      {activeView === 'achievements' ? <ContestAchievementsPanel /> : <>

      {/* Filter */}
      <ContestFilter
        search={search}
        onSearchChange={handleSearchChange}
        tingkat={scopeFilter}
        onTingkatChange={handleScopeFilterChange}
        status={statusFilter}
        onStatusChange={handleStatusFilterChange}
        onReset={handleResetContestFilters}
      />

      {/* Table */}
      {isContestPageLoading ? (
        <PageLoader />
      ) : (
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

      {/* Modals */}
      {canManage && (
        <>
          <CreateContestModal
            open={isContestFormOpen}
            onOpenChange={setIsContestFormOpen}
            contest={selectedContest}
            onSubmit={handleContestFormSubmit}
            isLoading={createContestMutation.isPending || updateContestMutation.isPending}
            error={createContestMutation.error || updateContestMutation.error}
          />

          <ContestEntriesDialog
            key={`${targetContest?.id ?? 'none'}-${submitFilmOpen ? 'open' : 'closed'}`}
            open={submitFilmOpen}
            onOpenChange={setSubmitFilmOpen}
            contest={targetContest}
          />
        </>
      )}
      </>}
    </div>
  );
}
