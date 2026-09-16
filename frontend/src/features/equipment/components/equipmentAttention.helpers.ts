import type { Equipment, EquipmentRecoveryCase } from '../types/equipment.types';

const activeRecoveryStatuses = new Set<EquipmentRecoveryCase['status']>([
  'open',
  'in_progress',
  'awaiting_verification',
]);

export function getEquipmentFollowUpTargets(equipment: Equipment[], cases: EquipmentRecoveryCase[]) {
  const activeCaseEquipmentIds = new Set(
    cases
      .filter((recoveryCase) => activeRecoveryStatuses.has(recoveryCase.status))
      .map((recoveryCase) => recoveryCase.equipment_id),
  );

  return equipment.filter(
    (item) => item.kondisi !== 'bagus' && item.status !== 'dipinjam' && !activeCaseEquipmentIds.has(item.id),
  );
}
