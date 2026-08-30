import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { studentsService } from '../api/students.service';

export function useProvisionStudentAccountMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, changeReason }: { id: string; changeReason: string }) =>
      studentsService.provisionStudentAccount(id, changeReason),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.STUDENTS,
        refetchType: 'active',
      });
    },
  });
}
