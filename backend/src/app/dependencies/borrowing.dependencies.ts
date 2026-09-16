import { supabase } from '../../services/supabaseClient.js';
import { BorrowingReadService } from '../../modules/borrowing/borrowing.read.service.js';
import { createBorrowingReadRepository } from '../../modules/borrowing/borrowing.read.repository.js';
import { BorrowingMutationsService } from '../../modules/borrowing/borrowing.mutations.service.js';
import { createBorrowingMutationsRepository } from '../../modules/borrowing/borrowing.mutations.repository.js';
import type { BorrowingMutationMemoryState } from '../../modules/borrowing/borrowing.mutations.types.js';
import type { CatalogDependencies } from './catalog.dependencies.js';

export interface BorrowingDependencies {
  borrowingReadService: BorrowingReadService;
  borrowingMutationsService: BorrowingMutationsService;
}

/** Shares the equipment memory adapter with borrowing mutations in development. */
export function createBorrowingDependencies(catalog: CatalogDependencies): BorrowingDependencies {
  const state: BorrowingMutationMemoryState = {
    equipment: catalog.equipmentMemoryState.equipment,
    borrowings: [],
  };
  return {
    borrowingReadService: new BorrowingReadService(
      createBorrowingReadRepository(supabase, state.borrowings, state.equipment),
    ),
    borrowingMutationsService: new BorrowingMutationsService(
      createBorrowingMutationsRepository(supabase, state),
    ),
  };
}
