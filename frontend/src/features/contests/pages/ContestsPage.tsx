// src/features/contests/pages/ContestsPage.tsx
// Thin orchestration page for Film Contests & Achievements Management

import { useState } from 'react';
import { Trophy } from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { ResponsivePageActions } from '@/components/common/ResponsivePageActions';
import { PageLoader } from '@/components/common/LoadingSpinner';
import { Pagination } from '@/components/common/Pagination';

import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { useStudentsQuery } from '@/features/students/queries/useStudentsQuery';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { useIsMobile } from '@/hooks/use-mobile';
import { hasCapability } from '@/shared/auth/capabilities';

import { useContestsQuery, useContestSummaryQuery } from '../queries/useContestsQuery';
import { useCreateContestMutation } from '../mutations/useCreateContestMutation';
import { useUpdateContestMutation } from '../mutations/useUpdateContestMutation';
import { useSubmitFilmEntryMutation } from '../mutations/useSubmitFilmEntryMutation';

import { ContestSummaryCards } from '../components/ContestSummaryCards';
import { ContestFilter } from '../components/ContestFilter';
import { ContestTable } from '../components/ContestTable';
import { ContestMobileList } from '../components/ContestMobileList';
import { CreateContestModal } from '../components/CreateContestModal';
import { SubmitFilmEntryModal } from '../components/SubmitFilmEntryModal';

import type { Contest, ContestLevel, ContestStatus } from '../types/contests.types';
import type { ContestFormValues, SubmitFilmEntryFormValues } from '../schemas/contestSchema';

export function ContestsPage() {
  const { user } = useAuthStore();
  const isMobile = useIsMobile();
  const canManage = hasCapability(user, 'contests.manage');
  const canSubmit = hasCapability(user, 'contests.submit');

  // Filters
  const [search, setSearch] = useState('');
  const [tingkat, setTingkat] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
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

  const { data: studentsData } = useStudentsQuery({ is_active: true }, canSubmit);

  // Mutations
  const createMutation = useCreateContestMutation();
  const updateMutation = useUpdateContestMutation();
  const submitFilmMutation = useSubmitFilmEntryMutation();

  // Handlers
  const handleOpenAdd = () => {
    setSelectedContest(null);
    setContestOpen(true);
  };

  const handleOpenEdit = (c: Contest) => {
    setSelectedContest(c);
    setContestOpen(true);
  };

  const handleOpenSubmitFilm = (c: Contest) => {
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
          penyelenggara: payload.penyelenggara,
          tingkat: payload.tingkat,
          deadline: payload.deadline,
          status: payload.status,
          website_url: payload.website_url || undefined,
          deskripsi: payload.deskripsi || undefined,
        },
        changeReason: change_reason ?? '',
      });
    } else {
      await createMutation.mutateAsync({
        payload: {
          nama_lomba: payload.nama_lomba,
          penyelenggara: payload.penyelenggara,
          tingkat: payload.tingkat,
          deadline: payload.deadline,
          status: payload.status,
          website_url: payload.website_url || undefined,
          deskripsi: payload.deskripsi || undefined,
        },
      });
    }
  };

  const handleSubmitFilmSubmit = async (values: SubmitFilmEntryFormValues) => {
    const { ...payload } = values;
    await submitFilmMutation.mutateAsync({
      payload: {
        contest_id: payload.contest_id,
        judul_film: payload.judul_film,
        sutradara_id: payload.sutradara_id,
        link_video: payload.link_video,
        award_status: payload.award_status,
        sertifikat_url: payload.sertifikat_url || undefined,
      },
    });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:space-y-6 sm:p-6">
      <PageHeader
        title="Perlombaan &amp; Prestasi Film Siswa"
        subtitle="Direktori festival film pendek, pendaftaran karya siswa, dan rekapitulasi penghargaan/tropi kejuaraan."
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
            <ContestMobileList contests={contestsData?.data ?? []} onEdit={handleOpenEdit} onSubmitFilm={handleOpenSubmitFilm} canManage={canManage} />
          ) : (
            <ContestTable contests={contestsData?.data ?? []} onEdit={handleOpenEdit} onSubmitFilm={handleOpenSubmitFilm} canManage={canManage} />
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

          <SubmitFilmEntryModal
            open={submitFilmOpen}
            onOpenChange={setSubmitFilmOpen}
            contest={targetContest}
            students={studentsData?.data ?? []}
            onSubmit={handleSubmitFilmSubmit}
            isLoading={submitFilmMutation.isPending}
            error={submitFilmMutation.error}
          />
        </>
      )}
    </div>
  );
}
