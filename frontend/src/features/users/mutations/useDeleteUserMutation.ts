import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { invalidateActiveQueries } from '@/shared/api/invalidateActiveQueries';
import { usersService } from '../services/users.service';

export function useDeleteUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, changeReason }: { id: string; changeReason: string }) =>
      usersService.deleteUser(id, changeReason),
    onSuccess: async () => {
      await invalidateActiveQueries(queryClient, [QUERY_KEYS.USERS]);
    },
  });
}
