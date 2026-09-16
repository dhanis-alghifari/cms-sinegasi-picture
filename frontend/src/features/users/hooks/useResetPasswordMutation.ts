
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { invalidateActiveQueries } from '@/shared/api/invalidateActiveQueries';
import { usersService } from '../api/users.service';

export function useResetPasswordMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      changeReason,
    }: {
      id: string;
      changeReason: string;
    }) => usersService.resetPassword(id, changeReason),
    onSuccess: async (_, variables) => {
      await invalidateActiveQueries(queryClient, [
        QUERY_KEYS.USERS,
        QUERY_KEYS.USER_DETAIL(variables.id),
      ]);
    },
  });
}
