import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { studentsService } from '../api/students.service';

export function useProvisionStudentAccountMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { successMessage: 'Akun siswa berhasil dibuat.' },
    mutationFn: ({ id, changeReason }: { id: string; changeReason: string }) =>
      studentsService.provisionStudentAccount(id, changeReason),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STUDENTS, refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USERS, refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STUDENT_UNLINKED_ACCOUNTS }),
      ]);
    },
  });
}
