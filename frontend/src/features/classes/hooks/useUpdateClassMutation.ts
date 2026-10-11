import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateActiveQueries } from '@/shared/api/invalidateActiveQueries';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { classesService } from '../api/classes.service';
import type { UpdateClassInput } from '../types/classes.types';

export function useUpdateClassMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { successMessage: 'Perubahan kelas berhasil disimpan.' },
    mutationFn: ({ id, payload }: { id: string; payload: UpdateClassInput }) =>
      classesService.updateClass(id, payload),
    onSuccess: async () => {
      await invalidateActiveQueries(queryClient, [QUERY_KEYS.CLASSES]);
    },
  });
}
