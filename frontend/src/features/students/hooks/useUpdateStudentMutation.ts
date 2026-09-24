
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { studentsService } from '../api/students.service';
import type { UpdateStudentPayload } from '../types/students.types';

export function useUpdateStudentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
      changeReason,
    }: {
      id: string;
      payload: UpdateStudentPayload;
      changeReason: string;
    }) => studentsService.updateStudent(id, payload, changeReason),
    onSuccess: async (_updatedStudent, variables) => {
      // Always refetch the active list from the source of truth. This also removes a
      // row when an edit makes it no longer match the current filter.
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.STUDENTS,
          refetchType: 'active',
        }),
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.STUDENT_DETAIL(variables.id),
          refetchType: 'active',
        }),
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.USERS,
          refetchType: 'active',
        }),
      ]);
    },
  });
}
