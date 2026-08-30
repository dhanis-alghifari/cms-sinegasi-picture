// src/features/users/hooks/useUpdateUserMutation.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { invalidateActiveQueries } from '@/shared/api/invalidateActiveQueries';
import { usersService } from '../api/users.service';
import type { UpdateUserPayload } from '../types/users.types';

export function useUpdateUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
      changeReason,
    }: {
      id: string;
      payload: UpdateUserPayload;
      changeReason: string;
    }) => usersService.updateUser(id, payload, changeReason),
    onSuccess: async (_, variables) => {
      await invalidateActiveQueries(queryClient, [
        QUERY_KEYS.USERS,
        QUERY_KEYS.USER_DETAIL(variables.id),
      ]);
    },
  });
}
