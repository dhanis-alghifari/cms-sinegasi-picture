import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateActiveQueries } from '@/shared/api/invalidateActiveQueries';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { studentsService } from '../api/students.service';

export function useDeleteStudentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { successMessage: 'Penghapusan data siswa berhasil diproses.' },
    mutationFn: ({ id, changeReason }: { id: string; changeReason: string }) =>
      studentsService.deleteStudent(id, changeReason),
    onSuccess: async () => {
      await invalidateActiveQueries(queryClient, [
        QUERY_KEYS.STUDENTS,
        QUERY_KEYS.USERS,
        QUERY_KEYS.CASH_TRANSACTIONS,
        QUERY_KEYS.CASH_BALANCE,
        QUERY_KEYS.CASH_DEBT_RECORDS,
        QUERY_KEYS.CASH_DEBTS,
        QUERY_KEYS.CASH_REPORT,
        QUERY_KEYS.CASH_DISPUTES,
        QUERY_KEYS.ATTENDANCE,
        QUERY_KEYS.ATTENDANCE_SUMMARY,
        QUERY_KEYS.BORROWINGS,
        QUERY_KEYS.EQUIPMENT_CHARGES,
      ]);
    },
  });
}
