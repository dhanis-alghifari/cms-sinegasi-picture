import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { studentsService } from '../api/students.service';
import type { StudentAccountResponse } from '../types/students.types';

export function useProvisionStudentAccountMutation(onAccountIssued?: (response: StudentAccountResponse) => void) {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { successMessage: 'Akun siswa berhasil dibuat.' },
    mutationFn: async ({
      id,
      username,
      phoneNumber,
      changeReason,
      idempotencyKey,
    }: {
      id: string;
      username: string;
      phoneNumber: string;
      changeReason: string;
      idempotencyKey: string;
    }) => {
      const response = await studentsService.provisionStudentAccount(
        id,
        { username, phone_number: phoneNumber, change_reason: changeReason },
        idempotencyKey,
      );
      onAccountIssued?.({
        ...response,
        account: { ...response.account, whatsapp_number: response.data.no_telepon },
      });
      const safeAccount = { ...response.account };
      delete safeAccount.temporary_password;
      return { ...response, account: safeAccount };
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STUDENTS, refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USERS, refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STUDENT_UNLINKED_ACCOUNTS }),
      ]);
    },
  });
}
