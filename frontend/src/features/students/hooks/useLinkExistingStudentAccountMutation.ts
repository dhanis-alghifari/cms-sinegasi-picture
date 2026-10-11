import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { studentsService } from '../api/students.service';
import type { LinkExistingStudentAccountPayload } from '../types/students.types';

export function useLinkExistingStudentAccountMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { successMessage: 'Akun berhasil ditautkan ke data siswa.' },
    mutationFn: (payload: LinkExistingStudentAccountPayload) => studentsService.linkExistingAccount(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STUDENTS, refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USERS, refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STUDENT_UNLINKED_ACCOUNTS }),
      ]);
    },
  });
}
