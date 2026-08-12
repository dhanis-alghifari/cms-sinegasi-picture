import type { ActorSummary } from '@/shared/types/common';
import { formatRoleLabel } from '@/shared/utils/formatLabels';

type ActorSummaryTextProps = {
  actor?: ActorSummary | null;
  label?: string;
};

/** Compact, privacy-safe audit identity used beside *_by UUID fields. */
export function ActorSummaryText({ actor, label = 'Diubah oleh' }: ActorSummaryTextProps) {
  if (!actor) return <span className="text-[11px] text-ink-tertiary">Belum ada metadata aktor</span>;

  const displayName = actor.nama || actor.username || actor.id;
  const username = actor.username ? `@${actor.username}` : null;
  const role = actor.role ? formatRoleLabel(actor.role) : null;

  return (
    <span className="inline-flex max-w-full flex-col text-[11px] leading-tight text-ink-subtle">
      <span className="font-medium text-ink-subtle">{label}: {displayName}</span>
      <span className="truncate text-ink-tertiary">
        {[username, role].filter(Boolean).join(' · ') || actor.id}
      </span>
    </span>
  );
}
