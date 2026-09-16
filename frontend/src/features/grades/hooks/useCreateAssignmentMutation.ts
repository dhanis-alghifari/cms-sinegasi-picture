
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { invalidateActiveQueries } from '@/shared/api/invalidateActiveQueries';
import { gradesService } from '../api/grades.service';
import type { CreateAssignmentPayload } from '../types/grades.types';

export function useCreateAssignmentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      payload,
    }: {
      payload: CreateAssignmentPayload;
    }) => gradesService.createAssignment(payload),
    onSuccess: async () => {
      await invalidateActiveQueries(queryClient, [QUERY_KEYS.ASSIGNMENTS]);
    },
  });
}
