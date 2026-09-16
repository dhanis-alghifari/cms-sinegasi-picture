
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { UI_CONSTANTS } from '@/shared/constants/ui';
import { invalidateActiveQueries } from '@/shared/api/invalidateActiveQueries';
import type { PaginatedResponse } from '@/shared/types/common';
import { formatPaymentMethodLabel } from '@/shared/utils/formatLabels';
import { cashService } from '../api/cash.service';
import type { CashSummary, CashTransaction, CreateCashInPayload, CashTransactionFilters } from '../types/cash.types';

interface CashInMutationContext {
  transactionQueries: Array<[QueryKey, PaginatedResponse<CashTransaction> | undefined]>;
  balance: CashSummary | undefined;
}

function matchesTransactionFilters(
  queryKey: QueryKey,
  payload: Pick<CreateCashInPayload, 'tanggal'> & { metode_pembayaran?: string },
): boolean {
  const filters = queryKey[2] as CashTransactionFilters | undefined;
  if (!filters) return true;
  if (filters.tipe === 'keluar') return false;
  if (filters.metode_pembayaran && filters.metode_pembayaran !== payload.metode_pembayaran) return false;
  if (filters.tanggal_mulai && payload.tanggal < filters.tanggal_mulai) return false;
  if (filters.tanggal_selesai && payload.tanggal > filters.tanggal_selesai) return false;
  return true;
}

function addOptimisticTransaction(
  current: PaginatedResponse<CashTransaction> | undefined,
  queryKey: QueryKey,
  transaction: CashTransaction,
): PaginatedResponse<CashTransaction> | undefined {
  if (!current || !matchesTransactionFilters(queryKey, transaction)) return current;
  if (current.data.some((item) => item.id === transaction.id)) return current;

  const page = Number((queryKey[2] as CashTransactionFilters | undefined)?.page || 1);
  const pageSize = current.pageSize || UI_CONSTANTS.DEFAULT_PAGE_SIZE;
  const nextTotal = current.total + 1;
  return {
    ...current,
    data: page === 1 ? [transaction, ...current.data].slice(0, pageSize) : current.data,
    total: nextTotal,
    totalPages: Math.ceil(nextTotal / pageSize) || 1,
  };
}

interface CreateCashInMutationVariables {
  payload: CreateCashInPayload;
  idempotencyKey: string;
  optimisticStudentName?: string;
  optimisticPaymentMethodLabel?: string;
}

export function useCreateCashInMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      payload,
      idempotencyKey,
    }: CreateCashInMutationVariables) => cashService.createCashIn(payload, idempotencyKey),
    onMutate: async ({ payload, idempotencyKey, optimisticStudentName, optimisticPaymentMethodLabel }): Promise<CashInMutationContext> => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: QUERY_KEYS.CASH_TRANSACTIONS }),
        queryClient.cancelQueries({ queryKey: QUERY_KEYS.CASH_BALANCE }),
      ]);

      const transactionQueries = queryClient.getQueriesData<PaginatedResponse<CashTransaction>>({
        queryKey: QUERY_KEYS.CASH_TRANSACTIONS,
      });
      const balance = queryClient.getQueryData<CashSummary>(QUERY_KEYS.CASH_BALANCE);
      const isUnpaid = payload.type === 'iuran_wajib' && payload.jumlah === 0;

      if (!isUnpaid) {
        const optimisticTransaction: CashTransaction = {
          id: `optimistic-${idempotencyKey}`,
          student_id: payload.student_id,
          student_nama: optimisticStudentName,
          tipe: 'masuk',
          jumlah: payload.jumlah,
          keterangan: payload.keterangan || 'Iuran kas',
          foto_bukti_url: payload.foto_bukti_url,
          tanggal: payload.tanggal,
          idempotency_key: idempotencyKey,
          created_by: 'optimistic',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_billing: false,
          metode_pembayaran: payload.metode_pembayaran,
          metode_pembayaran_label: formatPaymentMethodLabel(payload.metode_pembayaran, optimisticPaymentMethodLabel),
        };

        transactionQueries.forEach(([queryKey, current]) => {
          queryClient.setQueryData(
            queryKey,
            addOptimisticTransaction(current, queryKey, optimisticTransaction),
          );
        });
      }

      if (balance && !isUnpaid) {
        queryClient.setQueryData<CashSummary>(QUERY_KEYS.CASH_BALANCE, {
          ...balance,
          saldoUtama: balance.saldoUtama + payload.jumlah,
          totalPemasukan: balance.totalPemasukan + payload.jumlah,
        });
      }

      return { transactionQueries, balance };
    },
    onError: (_error, _variables, context) => {
      context?.transactionQueries.forEach(([queryKey, snapshot]) => {
        queryClient.setQueryData(queryKey, snapshot);
      });
      queryClient.setQueryData(QUERY_KEYS.CASH_BALANCE, context?.balance);
    },
    onSettled: async () => {
      await invalidateActiveQueries(queryClient, [
        QUERY_KEYS.CASH_TRANSACTIONS,
        QUERY_KEYS.CASH_BALANCE,
        QUERY_KEYS.CASH_DEBT_RECORDS,
        QUERY_KEYS.CASH_REPORT,
        QUERY_KEYS.DASHBOARD_SUMMARY,
      ]);
    },
  });
}
