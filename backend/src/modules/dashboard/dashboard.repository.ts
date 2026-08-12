import type { DashboardMemoryState, DashboardRepository } from './dashboard.types.js';
import { createDefaultDashboardSummary } from './dashboard.helpers.js';

/**
 * Development adapter for the legacy dashboard contract.
 *
 * A database adapter is intentionally not invented here: the current
 * response is fixture-only and its attendance, cash, grades, borrowing, and
 * contest fields do not map to one existing read model. The interface is the
 * replacement seam for a future SQL view/RPC once that read model is agreed.
 */
export function createDashboardRepository(state: DashboardMemoryState): DashboardRepository {
  return {
    async getStudentSummary(studentId) {
      const existing = state.summaries.get(studentId);
      if (existing) return { data: { ...existing, studentId } };

      const summary = createDefaultDashboardSummary(studentId);
      state.summaries.set(studentId, summary);
      return { data: { ...summary, studentId } };
    },
  };
}
