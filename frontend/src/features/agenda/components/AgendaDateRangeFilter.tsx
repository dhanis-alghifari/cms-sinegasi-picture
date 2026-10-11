import { Input } from '@/shared/ui/primitives/input';
import { MAX_AGENDA_FILTER_DAYS } from '../utils/agendaDateRange';

interface AgendaDateRangeFilterProps {
  from: string;
  to: string;
  maxDate: string;
  error?: string;
  onChange: (range: { from: string; to: string }) => void;
}

export function AgendaDateRangeFilter({ from, to, maxDate, error, onChange }: AgendaDateRangeFilterProps) {
  const describedBy = error ? 'agenda-date-range-error agenda-date-range-help' : 'agenda-date-range-help';

  return (
    <fieldset className="min-w-0 space-y-1">
      <legend className="flex items-center justify-between gap-2 text-[11px] text-ink-tertiary">
        <span>Rentang tanggal</span>
        <span aria-hidden="true">Maks. {MAX_AGENDA_FILTER_DAYS} hari</span>
      </legend>
      <div className="flex h-10 min-w-0 items-center gap-1 rounded-lg border border-hairline-strong bg-surface-1 p-1">
        <label htmlFor="agenda-date-from" className="sr-only">Tanggal mulai</label>
        <Input
          id="agenda-date-from"
          aria-label="Tanggal mulai"
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          type="date"
          max={maxDate}
          value={from}
          onChange={(event) => onChange({ from: event.target.value, to })}
          className="min-w-0 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0"
        />
        <span className="shrink-0 text-xs text-ink-tertiary" aria-hidden="true">–</span>
        <label htmlFor="agenda-date-to" className="sr-only">Tanggal selesai</label>
        <Input
          id="agenda-date-to"
          aria-label="Tanggal selesai"
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          type="date"
          max={maxDate}
          value={to}
          onChange={(event) => onChange({ from, to: event.target.value })}
          className="min-w-0 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0"
        />
      </div>
      <p id="agenda-date-range-help" className="sr-only">Rentang tanggal maksimal {MAX_AGENDA_FILTER_DAYS} hari.</p>
      {error && <p id="agenda-date-range-error" role="alert" className="text-[11px] text-semantic-danger">{error}</p>}
    </fieldset>
  );
}
