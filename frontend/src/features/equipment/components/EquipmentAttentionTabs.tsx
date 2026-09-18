import { useState } from 'react';
import { AlertTriangle, CreditCard, History, Wrench } from 'lucide-react';

import { Button } from '@/shared/ui/primitives/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/primitives/tabs';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { useEquipmentChargesQuery, useEquipmentRecoveryHistoryQuery } from '../hooks/useEquipmentRecovery';
import { EquipmentChargesPanel } from './EquipmentChargesPanel';
import { EquipmentRecoveryPanel } from './EquipmentRecoveryPanel';
import { getEquipmentFollowUpTargets } from './equipmentAttention.helpers';
import type { Equipment, EquipmentRecoveryCase } from '../types/equipment.types';

type AttentionTab = 'recovery' | 'charges' | 'history';

interface EquipmentAttentionTabsProps {
  data: {
    equipment: Equipment[];
    cases: EquipmentRecoveryCase[];
    recoveryLoading?: boolean;
    recoveryError?: unknown;
  };
  actions: {
    onRetryRecovery?: () => void;
    onOpenCreate: (equipment: Equipment) => void;
    onOpenRepair: (recoveryCase: EquipmentRecoveryCase, equipment?: Equipment) => void;
    onOpenReplacement: (recoveryCase: EquipmentRecoveryCase, equipment?: Equipment) => void;
  };
  permissions: {
    canManage: boolean;
  };
}

export function EquipmentAttentionTabs({
  data,
  actions,
  permissions,
}: EquipmentAttentionTabsProps) {
  const { equipment, cases, recoveryLoading, recoveryError } = data;
  const {
    onRetryRecovery,
    onOpenCreate,
    onOpenRepair,
    onOpenReplacement,
  } = actions;
  const { canManage } = permissions;
  const [activeTab, setActiveTab] = useState<AttentionTab>('recovery');
  const chargesQuery = useEquipmentChargesQuery(undefined, canManage, true);
  const historyQuery = useEquipmentRecoveryHistoryQuery(true);
  const openCharges = (chargesQuery.data ?? []).filter((charge) => charge.status === 'unpaid' || charge.status === 'partial');
  const historyCases = historyQuery.data ?? [];
  const followUpTargets = recoveryLoading || recoveryError ? [] : getEquipmentFollowUpTargets(equipment, cases);
  const recoveryCount = cases.length + followUpTargets.length;
  const hasAttention = recoveryCount > 0 || openCharges.length > 0;

  const changeTab = (value: string) => {
    if (value === 'recovery' || value === 'charges' || value === 'history') setActiveTab(value);
  };

  return (
    <section
      className="rounded-xl border border-hairline bg-surface-1 p-4"
      aria-label={hasAttention ? undefined : 'Operasional alat'}
      aria-labelledby={hasAttention ? 'equipment-attention-title' : undefined}
    >
      {hasAttention && (
        <div role="status" className="mb-4 flex flex-col gap-3 rounded-lg border border-semantic-warning/35 bg-semantic-warning/10 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-semantic-warning" aria-hidden="true" />
            <div className="min-w-0">
              <h2 id="equipment-attention-title" className="text-sm font-semibold text-ink">Ada hal yang perlu diselesaikan</h2>
              <p className="mt-1 text-xs leading-5 text-ink-subtle">
                {recoveryCount > 0 && `${recoveryCount} alat perlu tindak lanjut.`}
                {recoveryCount > 0 && openCharges.length > 0 && ' '}
                {openCharges.length > 0 && `${openCharges.length} tagihan alat belum lunas.`}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {recoveryCount > 0 && (
              <Button type="button" variant="outline" size="sm" onClick={() => setActiveTab('recovery')} className="min-h-10 text-xs">
                <Wrench size={14} aria-hidden="true" />
                Lihat tindak lanjut
              </Button>
            )}
            {openCharges.length > 0 && canManage && (
              <Button type="button" variant="outline" size="sm" onClick={() => setActiveTab('charges')} className="min-h-10 text-xs">
                <CreditCard size={14} aria-hidden="true" />
                Lihat tagihan
              </Button>
            )}
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={changeTab} className="w-full">
        <TabsList aria-label="Operasional alat" className={`grid w-full max-w-2xl ${canManage ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <TabsTrigger value="recovery" className="gap-1.5 px-3 text-xs">
            <Wrench size={14} aria-hidden="true" />
            <span>Tindak lanjut</span>
            {recoveryCount > 0 && <StatusBadge label={String(recoveryCount)} variant="warning" className="ml-1 px-1.5" />}
          </TabsTrigger>
          {canManage && (
            <TabsTrigger value="charges" className="gap-1.5 px-3 text-xs">
              <CreditCard size={14} aria-hidden="true" />
              <span>Tagihan</span>
              {openCharges.length > 0 && <StatusBadge label={String(openCharges.length)} variant="warning" className="ml-1 px-1.5" />}
            </TabsTrigger>
          )}
          <TabsTrigger value="history" className="gap-1.5 px-3 text-xs">
            <History size={14} aria-hidden="true" />
            <span>Riwayat selesai</span>
            {historyCases.length > 0 && <StatusBadge label={String(historyCases.length)} variant="neutral" className="ml-1 px-1.5" />}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recovery" keepMounted className="outline-none">
          <EquipmentRecoveryPanel
            data={{ equipment, cases, isLoading: recoveryLoading, error: recoveryError }}
            view={{ embedded: true }}
            actions={{ onRetry: onRetryRecovery, onOpenCreate, onOpenRepair, onOpenReplacement }}
            permissions={{ canManage }}
          />
        </TabsContent>
        {canManage && (
          <TabsContent value="charges" keepMounted className="outline-none">
            <EquipmentChargesPanel
              embedded
              charges={chargesQuery.data}
              recoveryCases={cases}
              isLoading={chargesQuery.isLoading}
              error={chargesQuery.error}
              onRetry={chargesQuery.refetch}
            />
          </TabsContent>
        )}
        <TabsContent value="history" keepMounted className="outline-none">
          <EquipmentRecoveryPanel
            data={{ equipment, cases: historyCases, isLoading: historyQuery.isLoading, error: historyQuery.error }}
            view={{ embedded: true, mode: 'history' }}
            actions={{ onRetry: historyQuery.refetch, onOpenCreate, onOpenRepair, onOpenReplacement }}
            permissions={{ canManage: false }}
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}
