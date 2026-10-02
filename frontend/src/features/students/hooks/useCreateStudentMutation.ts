
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { studentsService } from '../api/students.service';
import type { CreateStudentPayload } from '../types/students.types';

export function useCreateStudentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { successMessage: 'Data siswa berhasil ditambahkan.' },
    mutationFn: ({
      payload,
    }: {
      payload: CreateStudentPayload;
    }) => studentsService.createStudent(payload),
    onSuccess: async () => {
      // Do not manually prepend the record to every filtered/paginated cache variant.
      // Refetch the active list from the server so pagination and filters stay correct.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STUDENTS, refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USERS, refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STUDENT_UNLINKED_ACCOUNTS }),
      ]);
    },
  });
}
