
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { studentsService } from '../api/students.service';
import type { CreateStudentPayload, StudentAccountResponse } from '../types/students.types';

export function useCreateStudentMutation(onAccountIssued?: (response: StudentAccountResponse) => void) {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { successMessage: 'Data siswa berhasil ditambahkan.' },
    mutationFn: async ({ payload, idempotencyKey }: { payload: CreateStudentPayload; idempotencyKey: string }) => {
      const response = await studentsService.createStudent(payload, idempotencyKey);
      onAccountIssued?.({
        ...response,
        account: { ...response.account, whatsapp_number: response.data.no_telepon },
      });
      const safeAccount = { ...response.account };
      delete safeAccount.temporary_password;
      return { ...response, account: safeAccount };
    },
    onSuccess: async () => {
      // Do not manually prepend the record to every filtered/paginated cache variant.
      // Refetch the active list from the server so pagination and filters stay correct.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STUDENTS, refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USERS, refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STUDENT_UNLINKED_ACCOUNTS }),
      ]);
    },
  });
}
