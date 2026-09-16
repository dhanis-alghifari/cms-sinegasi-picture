import { useState } from 'react';
import { Filter, RefreshCcw } from 'lucide-react';

import { Button } from '@/shared/ui/primitives/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/primitives/card';
import { Input } from '@/shared/ui/primitives/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/shared/ui/primitives/sheet';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { cn } from '@/shared/utils/cn';
import { formatDateShort } from '@/shared/utils/formatDate';
import { formatPaymentMethodLabel } from '@/shared/utils/formatLabels';
import { UI_CONSTANTS } from '@/shared/constants/ui';

import type { CashPaymentMethod, CashReport } from '../types/cash.types';
import { CASH_REPORT_PRESET_DAYS, getInclusiveDays, getPresetRange, type CashReportPreset } from '../utils/reportDates';

const REPORT_PRESETS = CASH_REPORT_PRESET_DAYS;

function isPresetActive(startDate: string, endDate: string, days: CashReportPreset): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return false;
  const preset = getPresetRange(endDate, days);
  return preset.startDate === startDate && preset.endDate === endDate;
}

function presetButtonClassName(active: boolean): string {
  return cn(
    'border-hairline px-2.5 text-[11px] transition-colors',
    active
      ? 'border-primary bg-primary font-semibold text-primary-foreground shadow-sm hover:bg-primary/90'
      : 'bg-surface-2 text-ink-subtle hover:border-primary/50 hover:bg-surface-1 hover:text-ink',
  );
}

interface CashReportFilterProps {
  report?: CashReport;
  filter: {
    startDate: string;
    endDate: string;
    paymentMethodCode: string;
    paymentMethods: CashPaymentMethod[];
    isPaymentMethodsLoading?: boolean;
    rangeError?: string;
  };
  actions: {
    onStartDateChange: (value: string) => void;
    onEndDateChange: (value: string) => void;
    onPaymentMethodChange: (value: string) => void;
    onPreset: (days: CashReportPreset) => void;
    onReset: () => void;
  };
}

export function CashReportFilter({
  report,
  filter,
  actions,
}: CashReportFilterProps) {
  const {
    startDate,
    endDate,
    paymentMethodCode,
    paymentMethods,
    isPaymentMethodsLoading = false,
    rangeError,
  } = filter;
  const {
    onStartDateChange,
    onEndDateChange,
    onPaymentMethodChange,
    onPreset,
    onReset,
  } = actions;
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [draftStartDate, setDraftStartDate] = useState(startDate);
  const [draftEndDate, setDraftEndDate] = useState(endDate);
  const [draftPaymentMethod, setDraftPaymentMethod] = useState(paymentMethodCode);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setDraftStartDate(startDate);
      setDraftEndDate(endDate);
      setDraftPaymentMethod(paymentMethodCode);
    }
    setOpen(nextOpen);
  };

  const applyDraft = () => {
    onStartDateChange(draftStartDate);
    onEndDateChange(draftEndDate);
    onPaymentMethodChange(draftPaymentMethod);
    setOpen(false);
  };

  const resetDraft = () => {
    onReset();
    setOpen(false);
  };

  const updateDraftPreset = (days: CashReportPreset) => {
    const next = getPresetRange(draftEndDate, days);
    setDraftStartDate(next.startDate);
    setDraftEndDate(next.endDate);
  };

  const getRangeError = (rangeStart: string, rangeEnd: string) => {
    const days = getInclusiveDays(rangeStart, rangeEnd);
    if (days <= 0) return 'Tanggal mulai harus sama atau sebelum tanggal selesai.';
    if (days > UI_CONSTANTS.MAX_CASH_REPORT_RANGE_DAYS) return `Rentang laporan maksimal ${UI_CONSTANTS.MAX_CASH_REPORT_RANGE_DAYS} hari.`;
    return undefined;
  };

  const draftRangeError = getRangeError(draftStartDate, draftEndDate);

  if (isMobile) {
    return (
      <>
        <Card className="cash-report-screen-only border-hairline bg-surface-1">
          <CardContent className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-ink">Periode laporan</p>
              <p className="mt-1 truncate text-[11px] text-ink-subtle">
                {startDate && endDate ? `${formatDateShort(startDate)} – ${formatDateShort(endDate)}` : 'Periode belum dipilih'}
                {report ? ` • ${report.period.days} hari` : ''}
              </p>
              {paymentMethodCode && <p className="mt-0.5 truncate text-[10px] text-primary">{formatPaymentMethodLabel(paymentMethodCode)}</p>}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(true)}
              className="min-h-12 shrink-0 border-hairline bg-surface-2 px-3 text-xs text-ink"
            >
              <Filter size={15} className="mr-1.5" aria-hidden="true" />
              Filter
            </Button>
          </CardContent>
        </Card>

        <Sheet open={open} onOpenChange={handleOpenChange}>
          <SheetContent side="bottom" className="max-h-[88dvh] rounded-t-2xl border-hairline bg-surface-1 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <SheetHeader className="border-b border-hairline px-4 pb-3">
              <SheetTitle className="text-ink">Filter laporan kas</SheetTitle>
              <SheetDescription className="text-ink-subtle">Pilih periode maksimal {UI_CONSTANTS.MAX_CASH_REPORT_RANGE_DAYS} hari dan metode pembayaran.</SheetDescription>
            </SheetHeader>
            <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-4">
              <ReportFilterFields
                filter={{
                  startDate: draftStartDate,
                  endDate: draftEndDate,
                  paymentMethodCode: draftPaymentMethod,
                  paymentMethods,
                  isPaymentMethodsLoading,
                  rangeError: draftRangeError,
                }}
                actions={{
                  onStartDateChange: setDraftStartDate,
                  onEndDateChange: setDraftEndDate,
                  onPaymentMethodChange: setDraftPaymentMethod,
                  onPreset: updateDraftPreset,
                }}
              />
            </div>
            <SheetFooter className="border-t border-hairline px-4 pt-3">
              <Button type="button" variant="outline" onClick={resetDraft} className="min-h-12 w-full border-hairline bg-surface-2 text-ink">
                <RefreshCcw size={14} className="mr-1.5" aria-hidden="true" />
                Reset
              </Button>
              <Button type="button" onClick={applyDraft} disabled={Boolean(draftRangeError)} className="min-h-12 w-full bg-primary text-primary-foreground">
                Terapkan filter
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Card className="cash-report-screen-only border-hairline bg-surface-1">
      <CardHeader className="pb-3">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
          <div>
            <CardTitle className="text-sm text-ink">Filter periode laporan</CardTitle>
            <CardDescription className="mt-1 text-xs text-ink-subtle">Arus kas dan tunggakan pada periode terpilih. Maksimal {UI_CONSTANTS.MAX_CASH_REPORT_RANGE_DAYS} hari.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            {REPORT_PRESETS.map((days) => {
              const active = isPresetActive(startDate, endDate, days);
              return (
                <Button
                  key={days}
                  type="button"
                  variant="outline"
                  aria-pressed={active}
                  onClick={() => onPreset(days)}
                  className={cn(presetButtonClassName(active), 'min-h-12 md:min-h-9')}
                >
                  {days} hari
                </Button>
              );
            })}
            <Button type="button" variant="ghost" onClick={onReset} className="min-h-12 px-2 text-[11px] text-ink-subtle hover:text-ink md:min-h-9">
              <RefreshCcw size={13} className="mr-1" aria-hidden="true" />
              Reset
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ReportFilterFields
          filter={{
            startDate,
            endDate,
            paymentMethodCode,
            paymentMethods,
            isPaymentMethodsLoading,
            rangeError,
          }}
          actions={{
            onStartDateChange,
            onEndDateChange,
            onPaymentMethodChange,
            onPreset,
          }}
          hidePresets
        />
      </CardContent>
    </Card>
  );
}

interface ReportFilterFieldsProps {
  filter: CashReportFilterProps['filter'];
  actions: Pick<CashReportFilterProps['actions'], 'onStartDateChange' | 'onEndDateChange' | 'onPaymentMethodChange' | 'onPreset'>;
  hidePresets?: boolean;
}

function ReportFilterFields({
  filter,
  actions,
  hidePresets = false,
}: ReportFilterFieldsProps) {
  const {
    startDate,
    endDate,
    paymentMethodCode,
    paymentMethods,
    isPaymentMethodsLoading = false,
    rangeError,
  } = filter;
  const {
    onStartDateChange,
    onEndDateChange,
    onPaymentMethodChange,
    onPreset,
  } = actions;
  const handlePaymentMethodValueChange = (value: string | null) => {
    onPaymentMethodChange(value === UI_CONSTANTS.ALL_FILTER_VALUE || !value ? '' : value);
  };

  return (
    <div className="space-y-3">
      {!hidePresets && (
        <div className="grid grid-cols-3 gap-2">
          {REPORT_PRESETS.map((days) => {
            const active = isPresetActive(startDate, endDate, days);
            return (
              <Button
                key={days}
                type="button"
                variant="outline"
                aria-pressed={active}
                onClick={() => onPreset(days)}
                className={cn(presetButtonClassName(active), 'min-h-12 text-xs')}
              >
                {days} hari
              </Button>
            );
          })}
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto] md:items-end">
        <label className="space-y-1 text-xs text-ink-subtle">
          <span className="block">Tanggal mulai</span>
          <Input type="date" value={startDate} max={endDate || undefined} onChange={(event) => onStartDateChange(event.target.value)} className="border-hairline bg-surface-2 text-xs text-ink" />
        </label>
        <span className="hidden pb-2 text-xs text-ink-tertiary md:block">sampai</span>
        <label className="space-y-1 text-xs text-ink-subtle">
          <span className="block">Tanggal selesai</span>
          <Input type="date" value={endDate} min={startDate || undefined} onChange={(event) => onEndDateChange(event.target.value)} className="border-hairline bg-surface-2 text-xs text-ink" />
        </label>
        <div className="flex min-h-12 items-center justify-start text-xs text-ink-tertiary md:h-9 md:min-h-0 md:justify-end">{getInclusiveDays(startDate, endDate) ? `${getInclusiveDays(startDate, endDate)} hari` : 'Rentang belum dipilih'}</div>
      </div>
      <div className="space-y-1 text-xs text-ink-subtle">
        <span className="block">Metode pembayaran</span>
        <Select value={paymentMethodCode || UI_CONSTANTS.ALL_FILTER_VALUE} onValueChange={handlePaymentMethodValueChange} disabled={isPaymentMethodsLoading}>
          <SelectTrigger className="border-hairline bg-surface-2 text-xs text-ink" aria-label="Filter metode pembayaran laporan">
            <SelectValue placeholder="Semua metode" />
          </SelectTrigger>
          <SelectContent className="border-hairline bg-surface-3 text-ink">
            <SelectItem value={UI_CONSTANTS.ALL_FILTER_VALUE}>Semua metode</SelectItem>
            {paymentMethods.map((method) => <SelectItem key={method.id} value={method.code}>{formatPaymentMethodLabel(method.code, method.label)}</SelectItem>)}
          </SelectContent>
        </Select>
        {paymentMethodCode && <p className="text-[10px] text-ink-tertiary">Kontrol saldo tersedia saat semua metode dipilih.</p>}
      </div>
      {rangeError && <p className="text-xs text-semantic-danger">{rangeError}</p>}
    </div>
  );
}
