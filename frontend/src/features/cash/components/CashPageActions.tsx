import { ArrowDownRight, ArrowUpRight, Settings } from 'lucide-react';

import { Button } from '@/shared/ui/primitives/button';
import { ResponsivePageActions } from '@/shared/ui/ResponsivePageActions';
import type { CashScope } from '../types/cash.types';

type CashPageActionsProps = {
  canManageCash: boolean;
  canReadOwnCash: boolean;
  isOwnScope: boolean;
  isTreasurerOrTeacher: boolean;
  onScopeChange: (scope: CashScope) => void;
  onCashIn: () => void;
  onCashOut: () => void;
  onBillingRules: () => void;
};

export function CashPageActions({
  canManageCash,
  canReadOwnCash,
  isOwnScope,
  isTreasurerOrTeacher,
  onScopeChange,
  onCashIn,
  onCashOut,
  onBillingRules,
}: CashPageActionsProps) {
  return (
    <>
      {canManageCash && canReadOwnCash && (
        <Button type="button" variant="outline" size="sm" onClick={() => onScopeChange(isOwnScope ? 'manage' : 'own')}>
          {isOwnScope ? 'Kelola kas' : 'Kas saya'}
        </Button>
      )}
      {isTreasurerOrTeacher && (
        <ResponsivePageActions
          mobileLabel="Tindakan Kas"
          mobileDescription="Pilih aktivitas kas yang ingin dicatat."
          actions={[
            {
              id: 'cash-in',
              label: 'Kas Masuk',
              description: 'Catat iuran siswa atau pemasukan lain.',
              icon: ArrowDownRight,
              className: 'bg-semantic-success text-white hover:bg-semantic-success/80',
              onSelect: onCashIn,
            },
            {
              id: 'cash-out',
              label: 'Pengeluaran',
              description: 'Catat pengeluaran dengan kontrol saldo.',
              icon: ArrowUpRight,
              className: 'bg-semantic-danger text-white hover:bg-semantic-danger/80',
              onSelect: onCashOut,
            },
            {
              id: 'billing-rules',
              label: 'Pengaturan Iuran',
              description: 'Atur nominal iuran dan periode libur.',
              icon: Settings,
              variant: 'outline' as const,
              className: 'bg-surface-1 text-ink-subtle hover:text-ink',
              onSelect: onBillingRules,
            },
          ]}
        />
      )}
    </>
  );
}
