import type { OverdueBorrowing, OverdueLogStore, OverdueNotificationLog } from './overdue.types.js';

export const MAX_OVERDUE_LOGS = 100;

/**
 * Deterministic development fallback used only when Supabase is not configured.
 * Production data always comes from the repository's Supabase adapter.
 */
export const MOCK_OVERDUE_BORROWINGS: readonly OverdueBorrowing[] = [
  {
    id: 'bor-901',
    studentId: 'std-1003',
    studentName: 'Rizky Pratama',
    studentUserId: 'usr-06',
    namaAlat: 'Kamera Sony Alpha A7 III + Lensa 24-70mm',
    dueAt: '2026-08-03T10:00:00.000Z',
    status: 'borrowed',
  },
  {
    id: 'bor-902',
    studentId: 'std-1005',
    studentName: 'Ahmad Dani',
    studentUserId: 'usr-04',
    namaAlat: 'Lighting Godox SL-60W Kit',
    dueAt: '2026-08-04T10:00:00.000Z',
    status: 'borrowed',
  },
];

export function createOverdueLogStore(maxEntries = MAX_OVERDUE_LOGS): OverdueLogStore {
  const entries: OverdueNotificationLog[] = [];
  const capacity = Math.max(1, Math.min(MAX_OVERDUE_LOGS, Math.floor(maxEntries)));

  return {
    add(entry) {
      entries.unshift(entry);
      entries.length = Math.min(entries.length, capacity);
    },
    recent(limit) {
      const safeLimit = Math.max(0, Math.min(10, Math.floor(limit)));
      return entries.slice(0, safeLimit);
    },
  };
}
