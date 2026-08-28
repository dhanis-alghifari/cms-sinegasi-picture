// src/features/contests/pages/ContestsPage.tsx
// Thin orchestration page for Film Contests & Achievements Management

import { useState } from 'react';
import { Trophy } from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { ResponsivePageActions } from '@/components/common/ResponsivePageActions';
import { PageLoader } from '@/components/common/LoadingSpinner';
import { Pagination } from '@/components/common/Pagination';

import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { useIsMobile } from '@/hooks/use-mobile';
import { hasCapability } from '@/shared/auth/capabilities';

import { useContestsQuery, useContestSummaryQuery } from '../queries/useContestsQuery';
import { useCreateContestMutation } from '../mutations/useCreateContestMutation';
import { useUpdateContestMutation } from '../mutations/useUpdateContestMutation';

import { ContestSummaryCards } from '../components/ContestSummaryCards';
import { ContestFilter } from '../components/ContestFilter';
import { ContestTable } from '../components/ContestTable';
import { ContestMobileList } from '../components/ContestMobileList';
import { CreateContestModal } from '../components/CreateContestModal';
import { ContestEntriesDialog } from '../components/ContestEntriesDialog';
import { ContestAchievementsPanel } from '../components/ContestAchievementsPanel';

import type { Contest, ContestLevel, ContestStatus } from '../types/contests.types';
import type { ContestFormValues } from '../schemas/contestSchema';

export function ContestsPage() {
  const { user } = useAuthStore();
  const isMobile = useIsMobile();
  const canManage = hasCapability(user, 'contests.manage');

  // Filters
  const [search, setSearch] = useState('');
  const [tingkat, setTingkat] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [activeView, setActiveView] = useState<'events' | 'achievements'>('events');
  const pageSize = 10;

  const debouncedSearch = useDebouncedValue(search, 300);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleTingkatChange = (val: string) => {
    setTingkat(val);
    setPage(1);
  };

  const handleStatusChange = (val: string) => {
    setStatus(val);
    setPage(1);
  };

  const handleResetFilter = () => {
    setSearch('');
    setTingkat('all');
    setStatus('all');
    setPage(1);
  };

  // Modals
  const [contestOpen, setContestOpen] = useState(false);
  const [selectedContest, setSelectedContest] = useState<Contest | null>(null);

  const [submitFilmOpen, setSubmitFilmOpen] = useState(false);
  const [targetContest, setTargetContest] = useState<Contest | null>(null);

  // Queries
  const { data: summaryData, isLoading: isSummaryLoading } = useContestSummaryQuery();
  const { data: contestsData, isLoading: isContestsLoading } = useContestsQuery({
    page,
    pageSize,
    search: debouncedSearch || undefined,
    tingkat: tingkat !== 'all' ? (tingkat as ContestLevel) : undefined,
    status: status !== 'all' ? (status as ContestStatus) : undefined,
  });

  // Mutations
  const createMutation = useCreateContestMutation();
  const updateMutation = useUpdateContestMutation();

  // Handlers
  const handleOpenAdd = () => {
    setSelectedContest(null);
    setContestOpen(true);
  };

  const handleOpenEdit = (c: Contest) => {
    setSelectedContest(c);
    setContestOpen(true);
  };

  const handleOpenEntries = (c: Contest) => {
    setTargetContest(c);
    setSubmitFilmOpen(true);
  };

  const handleContestFormSubmit = async (values: ContestFormValues) => {
    const { change_reason, ...payload } = values;

    if (selectedContest) {
      await updateMutation.mutateAsync({
        id: selectedContest.id,
        payload: {
          nama_lomba: payload.nama_lomba,
          kota: payload.kota,
          tingkat: payload.tingkat,
          ...(payload.deadline !== selectedContest.deadline ? { deadline: payload.deadline } : {}),
          status: payload.status,
          tahun_event: payload.tahun_event,
          website_url: payload.website_url || undefined,
          deskripsi: payload.deskripsi || undefined,
        },
        changeReason: change_reason ?? '',
      });
    } else {
      await createMutation.mutateAsync({
        payload: {
          nama_lomba: payload.nama_lomba,
          kota: payload.kota,
          tingkat: payload.tingkat,
          deadline: payload.deadline,
          status: payload.status,
          tahun_event: payload.tahun_event,
          website_url: payload.website_url || undefined,
          deskripsi: payload.deskripsi || undefined,
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
                onSelect: handleOpenAdd,
              }]}
            />
          ) : undefined
        }
      />

      {/* Summary Cards */}
      {isSummaryLoading ? <PageLoader /> : <ContestSummaryCards summary={summaryData} />}

      <div className="flex w-full gap-1 border-b border-hairline" role="tablist" aria-label="Perlombaan dan prestasi">
        <button type="button" role="tab" aria-selected={activeView === 'events'} onClick={() => setActiveView('events')} className={`border-b-2 px-3 py-2 text-xs font-semibold transition-colors ${activeView === 'events' ? 'border-primary text-primary' : 'border-transparent text-ink-tertiary hover:text-ink'}`}>Event &amp; pendaftaran</button>
        <button type="button" role="tab" aria-selected={activeView === 'achievements'} onClick={() => setActiveView('achievements')} className={`border-b-2 px-3 py-2 text-xs font-semibold transition-colors ${activeView === 'achievements' ? 'border-primary text-primary' : 'border-transparent text-ink-tertiary hover:text-ink'}`}>Karya &amp; prestasi</button>
      </div>

      {activeView === 'achievements' ? <ContestAchievementsPanel /> : <>

      {/* Filter */}
      <ContestFilter
        search={search}
        onSearchChange={handleSearchChange}
        tingkat={tingkat}
        onTingkatChange={handleTingkatChange}
        status={status}
        onStatusChange={handleStatusChange}
        onReset={handleResetFilter}
      />

      {/* Table */}
      {isContestsLoading ? (
        <PageLoader />
      ) : (
        <div className="space-y-4">
          {isMobile ? (
            <ContestMobileList contests={contestsData?.data ?? []} onEdit={handleOpenEdit} onManageEntries={handleOpenEntries} canManage={canManage} />
          ) : (
            <ContestTable contests={contestsData?.data ?? []} onEdit={handleOpenEdit} onManageEntries={handleOpenEntries} canManage={canManage} />
          )}
          <Pagination
            page={contestsData?.page ?? page}
            totalPages={contestsData?.totalPages ?? 1}
            total={contestsData?.total ?? 0}
            pageSize={contestsData?.pageSize ?? pageSize}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Modals */}
      {canManage && (
        <>
          <CreateContestModal
            open={contestOpen}
            onOpenChange={setContestOpen}
            contest={selectedContest}
            onSubmit={handleContestFormSubmit}
            isLoading={createMutation.isPending || updateMutation.isPending}
            error={createMutation.error || updateMutation.error}
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
