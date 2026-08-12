import { supabase } from '../../services/supabaseClient.js';
import { createCashModule, type CashModule } from '../../modules/cash/cash.module.js';
import { createCashMemoryState } from '../../modules/cash/shared/cash.memory.js';
import type { CatalogDependencies } from './catalog.dependencies.js';

export interface CashDependencies {
  cash: CashModule;
}

/** Creates the cash domain behind its single public module interface. */
export function createCashDependencies(catalog: CatalogDependencies): CashDependencies {
  return {
    cash: createCashModule(
      supabase,
      createCashMemoryState(),
      catalog.studentsMemoryState.students,
    ),
  };
}
