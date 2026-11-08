/** The rollback API can preserve a null deadline but cannot clear an existing one. */
export function rollbackDeadlinePatch(deadline: string, previous: string | null): { deadline?: string } {
  if (!deadline && previous) throw new Error('Deadline yang sudah ada tidak dapat dikosongkan pada versi ini.');
  return deadline && deadline !== previous ? { deadline } : {};
}
