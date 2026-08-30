// src/features/users/hooks/useUsersQuery.ts
// TanStack Query hook for user list

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { usersService } from '../api/users.service';
import type { UserFilterParams } from '../types/users.types';

export function useUsersQuery(params?: UserFilterParams) {
  return useQuery({
    queryKey: [...QUERY_KEYS.USERS, params],
    queryFn: () => usersService.getUsers(params),
  });
}
