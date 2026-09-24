import type { UserAccount } from '../types/users.types';

/** Linked student accounts are deleted only through the student purge flow. */
export function canDeleteUnlinkedAccount(
  user: Pick<UserAccount, 'is_linked_student'>,
): boolean {
  return !user.is_linked_student;
}
