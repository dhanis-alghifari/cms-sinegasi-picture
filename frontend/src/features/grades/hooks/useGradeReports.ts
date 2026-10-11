import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { gradesService } from '../api/grades.service';
import type { CreatePklPeriodPayload, CreateReportPeriodPayload } from '../types/grades.types';

export function useReportPeriodsQuery(enabled = true) {
  return useQuery({
    queryKey: [...QUERY_KEYS.GRADES, 'report-periods'],
    queryFn: () => gradesService.getReportPeriods(),
    enabled,
  });
}

export function useReportsQuery(periodId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [...QUERY_KEYS.GRADES, 'reports', periodId],
    queryFn: () => gradesService.getReports(periodId!),
    enabled: enabled && Boolean(periodId),
  });
}

export function useCreateReportPeriodMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { successMessage: 'Periode laporan nilai berhasil dibuat.' },
    mutationFn: (payload: CreateReportPeriodPayload) => gradesService.createReportPeriod(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.GRADES, 'report-periods'] }),
  });
}

export function useGenerateReportsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { successMessage: 'Laporan nilai berhasil dibuat.' },
    mutationFn: (periodId: string) => gradesService.generateReports(periodId),
    onSuccess: (_data, periodId) => queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.GRADES, 'reports', periodId] }),
  });
}

export function useApproveReportsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { successMessage: 'Laporan nilai berhasil disetujui.' },
    mutationFn: (periodId: string) => gradesService.approveReports(periodId),
    onSuccess: (_data, periodId) => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.GRADES, 'reports', periodId] });
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.GRADES, 'report-periods'] });
    },
  });
}

export function usePklPeriodsQuery(enabled = true) {
  return useQuery({
    queryKey: [...QUERY_KEYS.GRADES, 'pkl-periods'],
    queryFn: () => gradesService.getPklPeriods(),
    enabled,
  });
}

export function useCreatePklPeriodMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { successMessage: 'Periode PKL berhasil dibuat.' },
    mutationFn: (payload: CreatePklPeriodPayload) => gradesService.createPklPeriod(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.GRADES, 'pkl-periods'] }),
  });
}

export function useReviewPklPeriodMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { successMessage: 'Status periode PKL berhasil diperbarui.' },
    mutationFn: ({ id, status }: { id: string; status: 'approved' | 'rejected' | 'completed' }) => gradesService.reviewPklPeriod(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.GRADES, 'pkl-periods'] }),
  });
}
