import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateActiveQueries } from '@/shared/api/invalidateActiveQueries';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { classesService } from '../api/classes.service';
import type { CreateClassInput } from '../types/classes.types';

export function useCreateClassMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ payload }: { payload: CreateClassInput }) =>
      classesService.createClass(payload),
    onSuccess: async () => {
      await invalidateActiveQueries(queryClient, [QUERY_KEYS.CLASSES]);
    },
  });
}
