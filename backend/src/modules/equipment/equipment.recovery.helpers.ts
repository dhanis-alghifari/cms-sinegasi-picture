import type { EquipmentRecoveryMemoryState } from './equipment.recovery.types.js';

export function createEquipmentRecoveryMemoryState(): EquipmentRecoveryMemoryState {
  return { cases: [], charges: [], evidence: [] };
}
