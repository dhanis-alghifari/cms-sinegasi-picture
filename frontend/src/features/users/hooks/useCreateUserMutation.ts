
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { invalidateActiveQueries } from '@/shared/api/invalidateActiveQueries';
import { usersService } from '../api/users.service';
import type { CreateUserPayload } from '../types/users.types';

export function useCreateUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { successMessage: 'Akun pengguna berhasil dibuat.' },
    mutationFn: ({
      payload,
    }: {
      payload: CreateUserPayload;
    }) => usersService.createUser(payload),
    onSuccess: async () => {
      await invalidateActiveQueries(queryClient, [QUERY_KEYS.USERS]);
    },
  });
}
