// src/features/students/mutations/useCreateStudentMutation.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { studentsService } from '../services/students.service';
import type { CreateStudentPayload } from '../types/students.types';

export function useCreateStudentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      payload,
    }: {
      payload: CreateStudentPayload;
    }) => studentsService.createStudent(payload),
    onSuccess: async () => {
      // Do not manually prepend the record to every filtered/paginated cache variant.
      // Refetch the active list from the server so pagination and filters stay correct.
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.STUDENTS,
        refetchType: 'active',
      });
    },
  });
}
