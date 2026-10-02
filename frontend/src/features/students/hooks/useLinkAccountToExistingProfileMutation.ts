import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { studentsService } from '../api/students.service';

export function useLinkAccountToExistingProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { successMessage: 'Akun berhasil ditautkan ke profil siswa.' },
    mutationFn: ({ studentId, userId, changeReason }: { studentId: string; userId: string; changeReason: string }) =>
      studentsService.linkAccountToExistingProfile(studentId, userId, changeReason),
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STUDENTS, refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STUDENT_DETAIL(variables.studentId), refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USERS, refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STUDENT_UNLINKED_ACCOUNTS }),
      ]);
    },
  });
}
