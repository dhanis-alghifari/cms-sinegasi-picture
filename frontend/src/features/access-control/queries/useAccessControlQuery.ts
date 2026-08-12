import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { accessControlService } from '../services/access-control.service';
import type { UpdateRoleCapabilitiesRequest } from '../types/access-control.types';
import type { UserRole } from '@/shared/types/common';

export function useAccessControlMatrixQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.ACCESS_CONTROL_MATRIX,
    queryFn: () => accessControlService.getMatrix(),
    staleTime: 60_000,
  });
}

export function useAccessControlAuditLogsQuery(limit = 100) {
  return useQuery({
    queryKey: [...QUERY_KEYS.ACCESS_CONTROL_AUDIT_LOGS, limit],
    queryFn: () => accessControlService.listAuditLogs(limit),
    staleTime: 30_000,
  });
}

export function useUpdateRoleCapabilitiesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ role, input }: { role: UserRole; input: UpdateRoleCapabilitiesRequest }) =>
      accessControlService.updateRoleCapabilities(role, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACCESS_CONTROL_MATRIX });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACCESS_CONTROL_AUDIT_LOGS });
    },
  });
}
