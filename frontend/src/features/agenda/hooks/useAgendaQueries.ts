import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { agendaService } from '../api/agenda.service';
import type { AgendaFilters, AgendaFormValues } from '../types/agenda.types';

export function useAgendaQuery(filters: AgendaFilters, enabled = true) {
  return useQuery({
    queryKey: [...QUERY_KEYS.AGENDA, filters],
    queryFn: () => agendaService.list(filters),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useAgendaReportQuery(filters: AgendaFilters, enabled = true) {
  return useQuery({
    queryKey: [...QUERY_KEYS.AGENDA_REPORT, filters],
    queryFn: () => agendaService.report(filters),
    enabled,
    staleTime: 30_000,
  });
}

export function useAgendaPhotoQuery(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: id ? QUERY_KEYS.AGENDA_PHOTO(id) : [...QUERY_KEYS.AGENDA_PHOTO('disabled')],
    queryFn: () => agendaService.photoAccess(id as string),
    enabled: Boolean(id) && enabled,
    staleTime: 8 * 60_000,
  });
}

export function useAgendaCreateMutation() {
  const client = useQueryClient();
  return useMutation({
    meta: { successMessage: 'Agenda kegiatan berhasil ditambahkan.' },
    mutationFn: ({ values, idempotencyKey }: { values: AgendaFormValues; idempotencyKey: string }) =>
      agendaService.create(values, idempotencyKey),
    onSuccess: () => client.invalidateQueries({ queryKey: QUERY_KEYS.AGENDA }),
  });
}

export function useAgendaUpdateMutation() {
  const client = useQueryClient();
  return useMutation({
    meta: { successMessage: 'Perubahan agenda berhasil disimpan.' },
    mutationFn: ({ id, values, version, idempotencyKey }: { id: string; values: AgendaFormValues; version: number; idempotencyKey: string }) =>
      agendaService.update(id, values, version, idempotencyKey),
    onSuccess: () => client.invalidateQueries({ queryKey: QUERY_KEYS.AGENDA }),
  });
}

export function useAgendaArchiveMutation() {
  const client = useQueryClient();
  return useMutation({
    meta: { successMessage: 'Agenda berhasil diarsipkan.' },
    mutationFn: ({ id, reason, idempotencyKey }: { id: string; reason: string; idempotencyKey: string }) =>
      agendaService.archive(id, reason, idempotencyKey),
    onSuccess: () => client.invalidateQueries({ queryKey: QUERY_KEYS.AGENDA }),
  });
}

export function useAgendaPhotoMutation() {
  const client = useQueryClient();
  return useMutation({
    meta: { successMessage: 'Foto dokumentasi agenda berhasil diunggah.' },
    mutationFn: ({ id, file, idempotencyKey }: { id: string; file: File; idempotencyKey: string }) =>
      agendaService.reservePhoto(id, file, idempotencyKey),
    onSuccess: () => client.invalidateQueries({ queryKey: QUERY_KEYS.AGENDA }),
  });
}
