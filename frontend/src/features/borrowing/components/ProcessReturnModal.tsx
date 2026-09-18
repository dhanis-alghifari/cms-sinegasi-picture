import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/primitives/dialog';
import { Button } from '@/shared/ui/primitives/button';
import { Input } from '@/shared/ui/primitives/input';
import { Label } from '@/shared/ui/primitives/label';
import { RadioGroup } from '@/shared/ui/primitives/radio-group';
import { Textarea } from '@/shared/ui/primitives/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select';
import { FormattedNumberInput } from '@/shared/ui/FormattedNumberInput';
import { cn } from '@/shared/utils/cn';
import { getErrorMessage } from '@/shared/api/errors';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { formatNumber } from '@/shared/utils/formatNumber';
import { borrowingService } from '../api/borrowing.service';
import { processReturnSchema, type ProcessReturnFormValues } from '../schemas/borrowingSchema';
import type { BorrowingRecord, ReturnItemCondition } from '../types/borrowing.types';
import { ReturnEvidenceUploadField } from './ReturnEvidenceUploadField';

type SettlementMethod = 'none' | 'repair' | 'replacement';
type ReturnItemState = {
  condition: string;
  settlement_method: SettlementMethod;
  repair_cost?: number;
  notes: string;
  evidence_files: File[];
  evidence_ids: string[];
};

interface ProcessReturnModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: BorrowingRecord | null;
  onSubmit: (values: { borrowing_id: string; tanggal_dikembalikan: string; item_conditions: ReturnItemCondition[]; catatan_pengembalian?: string; change_reason: string }) => Promise<void>;
  isLoading?: boolean;
  error?: unknown;
}

function defaultSettlement(condition: string): SettlementMethod {
  if (condition === 'bagus') return 'none';
  if (condition === 'hilang') return 'replacement';
  return 'repair';
}

function getLocalCharge(item: BorrowingRecord['items'][number], state?: ReturnItemState): number | undefined {
  if (state?.settlement_method === 'repair') return state.repair_cost;
  if (state?.settlement_method === 'replacement') return item.replacement_value;
  return undefined;
}

function buildReturnConditions(record: BorrowingRecord, itemStates: Record<string, ReturnItemState>, includeEvidence = false): ReturnItemCondition[] {
  return record.items.map((item) => {
    const state = itemStates[item.equipment_id];
    return {
      equipment_id: item.equipment_id,
      kondisi_kembali: state.condition,
      settlement_method: state.settlement_method,
      ...(state.repair_cost !== undefined ? { repair_cost: state.repair_cost } : {}),
      ...(includeEvidence && state.condition !== 'hilang' && state.evidence_files.length > 0 ? { evidence_ids: state.evidence_ids } : {}),
      ...(state.notes.trim() ? { catatan: state.notes.trim() } : {}),
    };
  });
}

function returnErrorMessage(error: unknown): string {
  const message = getErrorMessage(error);
  if (/positive repair cost is required/i.test(message)) return 'Biaya perbaikan wajib diisi untuk kondisi rusak.';
  if (/replacement valuation is missing/i.test(message)) return 'Nilai penggantian alat belum dikonfigurasi.';
  return message;
}

export function ProcessReturnModal({ open, onOpenChange, record, onSubmit, isLoading, error }: ProcessReturnModalProps) {
  const [itemStates, setItemStates] = useState<Record<string, ReturnItemState>>({});
  const [evidenceErrors, setEvidenceErrors] = useState<Record<string, string>>({});
  const [localValidationError, setLocalValidationError] = useState<string | null>(null);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasMultipleItems = (record?.items.length ?? 0) > 1;
  const form = useForm<ProcessReturnFormValues>({
    resolver: zodResolver(processReturnSchema),
    defaultValues: {
      tanggal_dikembalikan: new Date().toISOString().split('T')[0],
      catatan_pengembalian: '',
      change_reason: 'Pemeriksaan dan pengembalian fisik barang inventaris',
    },
  });
  const completeInspection = Boolean(record?.items.length) && Boolean(record?.items.every((item) => itemStates[item.equipment_id]));
  const localTotalCharge = useMemo(() => record?.items.reduce((total, item) => {
    const state = itemStates[item.equipment_id];
    if (state?.settlement_method === 'repair') return total + (state.repair_cost ?? 0);
    if (state?.settlement_method === 'replacement') return total + (item.replacement_value ?? 0);
    return total;
  }, 0) ?? 0, [itemStates, record]);
  const hasUnresolvedReplacement = useMemo(() => record?.items.some((item) => itemStates[item.equipment_id]?.settlement_method === 'replacement' && item.replacement_value === undefined) ?? false, [itemStates, record]);

  const totalChargeLabel = hasUnresolvedReplacement ? 'Nilai belum tersedia' : formatCurrency(localTotalCharge);
  const chargeBreakdown = useMemo(() => {
    const repair = record?.items.reduce((total, item) => {
      const state = itemStates[item.equipment_id];
      return total + (state?.settlement_method === 'repair' ? state.repair_cost ?? 0 : 0);
    }, 0) ?? 0;
    const replacement = record?.items.reduce((total, item) => {
      const state = itemStates[item.equipment_id];
      return total + (state?.settlement_method === 'replacement' ? item.replacement_value ?? 0 : 0);
    }, 0) ?? 0;
    return { repair, replacement };
  }, [itemStates, record]);

  const submitButtonContent = (() => {
    if (!isLoading && !isSubmitting) return 'Simpan pengembalian';
    return (
      <>
        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        {isUploadingEvidence ? 'Mengunggah foto...' : 'Memproses...'}
      </>
    );
  })();

  const setItemState = (equipmentId: string, update: Partial<ReturnItemState>) => {
    setItemStates((current) => ({
      ...current,
      [equipmentId]: {
        condition: current[equipmentId]?.condition || 'bagus',
        settlement_method: current[equipmentId]?.settlement_method || 'none',
        repair_cost: current[equipmentId]?.repair_cost,
        notes: current[equipmentId]?.notes || '',
        evidence_files: current[equipmentId]?.evidence_files || [],
        evidence_ids: current[equipmentId]?.evidence_ids || [],
        ...update,
      },
    }));
  };

  const handleConditionValueChange = (equipmentId: string, currentState: ReturnItemState | undefined, condition: string | null) => {
    if (!condition) return;
    setLocalValidationError(null);
    setItemState(equipmentId, {
      condition,
      settlement_method: defaultSettlement(condition),
      repair_cost: condition === 'bagus' || condition === 'hilang' ? undefined : currentState?.repair_cost,
    });
  };

  const handleSettlementValueChange = (equipmentId: string, value: string) => {
    if (value !== 'repair' && value !== 'replacement') return;
    setItemState(equipmentId, { settlement_method: value });
  };

  const handleEvidenceChange = (equipmentId: string, files: File[]) => {
    setLocalValidationError(null);
    setEvidenceErrors((current) => {
      if (!current[equipmentId]) return current;
      const next = { ...current };
      delete next[equipmentId];
      return next;
    });
    setItemState(equipmentId, { evidence_files: files, evidence_ids: [] });
  };

  const handleClose = () => {
    setItemStates({});
    setEvidenceErrors({});
    setLocalValidationError(null);
    setIsUploadingEvidence(false);
    setIsSubmitting(false);
    onOpenChange(false);
  };

  const handleSubmit = form.handleSubmit(async (data) => {
    if (!record) return;
    const physicalItemsMissingEvidence = record.items.filter((item) => {
      const state = itemStates[item.equipment_id];
      return state?.condition !== 'hilang' && (state?.evidence_files.length ?? 0) < 2;
    });
    if (physicalItemsMissingEvidence.length > 0) {
      setEvidenceErrors(Object.fromEntries(
        physicalItemsMissingEvidence.map((item) => [
          item.equipment_id,
          `Unggah minimal 2 foto kondisi untuk ${item.kode_alat}.`,
        ]),
      ));
      return;
    }

    setLocalValidationError(null);
    setEvidenceErrors({});
    setIsSubmitting(true);
    try {
      await borrowingService.previewReturn({
        borrowing_id: record.id,
        tanggal_dikembalikan: data.tanggal_dikembalikan,
        item_conditions: buildReturnConditions(record, itemStates),
      });

      setIsUploadingEvidence(true);
      const uploadedEvidenceByEquipment = new Map<string, string[]>();
      await Promise.all(record.items.map(async (item) => {
        const state = itemStates[item.equipment_id];
        if (state.condition === 'hilang') return;
        const evidenceIds = state.evidence_ids.length === state.evidence_files.length
          ? state.evidence_ids
          : await Promise.all(state.evidence_files.map((file) => borrowingService.uploadReturnEvidence(record.id, item.equipment_id, file)));
        uploadedEvidenceByEquipment.set(item.equipment_id, evidenceIds);
        if (evidenceIds.length !== state.evidence_ids.length) {
          setItemState(item.equipment_id, { evidence_ids: evidenceIds });
        }
      }));
      const itemConditionsWithEvidence = buildReturnConditions(record, itemStates, true).map((condition) => {
        const evidenceIds = uploadedEvidenceByEquipment.get(condition.equipment_id);
        return evidenceIds?.length ? { ...condition, evidence_ids: evidenceIds } : condition;
      });
      await onSubmit({
        borrowing_id: record.id,
        tanggal_dikembalikan: data.tanggal_dikembalikan,
        item_conditions: itemConditionsWithEvidence,
        catatan_pengembalian: data.catatan_pengembalian || undefined,
        change_reason: data.change_reason,
      });
      handleClose();
    } catch (submitError) {
      setLocalValidationError(getErrorMessage(submitError));
    } finally {
      setIsUploadingEvidence(false);
      setIsSubmitting(false);
    }
  });

  const activeError = localValidationError || error;
  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isSubmitting) return;
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className={cn('max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-2xl gap-0 border-hairline bg-surface-1 p-0 text-ink sm:max-h-[min(92dvh,760px)]', hasMultipleItems ? 'overflow-hidden' : 'overflow-y-auto')}>
        <DialogHeader className="shrink-0 border-b border-hairline px-4 py-4 sm:px-5">
          <div className="flex items-start gap-3 pr-8">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-semantic-warning/12 text-semantic-warning"><RotateCcw size={17} aria-hidden="true" /></span>
            <div className="min-w-0"><DialogTitle className="text-base font-semibold text-ink">Proses Pengembalian Peralatan</DialogTitle><DialogDescription className="mt-1 text-xs leading-5 text-ink-subtle">Periksa kondisi alat dari <strong className="text-ink">{record?.borrower_nama}</strong>. Tagihan dihitung server.</DialogDescription></div>
          </div>
        </DialogHeader>

        <form noValidate onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 space-y-3 px-4 pt-4 sm:px-5">
            {Boolean(activeError) && <div role="alert" className="flex items-start gap-2 rounded-lg border border-semantic-danger/25 bg-semantic-danger/8 px-3 py-2.5 text-xs leading-5 text-semantic-danger">{returnErrorMessage(activeError)}</div>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="tanggal_dikembalikan" className="text-xs text-ink-muted">Tanggal pengembalian <span className="text-semantic-danger">*</span></Label><Input id="tanggal_dikembalikan" type="date" className="h-9 bg-surface-2 text-xs" {...form.register('tanggal_dikembalikan')} /></div>
              <div className="space-y-1.5"><Label htmlFor="total-tagihan" className="text-xs text-ink-muted">Total tagihan</Label><Input id="total-tagihan" value={totalChargeLabel} readOnly className="h-9 bg-surface-2 font-mono text-xs font-bold text-semantic-danger" /><p className="text-[10px] leading-4 text-ink-tertiary">Perbaikan {formatCurrency(chargeBreakdown.repair)} · Penggantian {formatCurrency(chargeBreakdown.replacement)}.</p></div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
          <section aria-labelledby="inspection-title" className={cn('mx-4 mt-4 flex flex-col rounded-lg border border-hairline bg-surface-2/35 sm:mx-5', hasMultipleItems ? 'min-h-0 flex-1 overflow-hidden' : 'shrink-0')}>
            <div className="flex shrink-0 items-center justify-between border-b border-hairline px-3 py-2.5"><div><h2 id="inspection-title" className="text-xs font-semibold text-ink">Pemeriksaan kondisi alat</h2><p className="mt-0.5 text-[10px] text-ink-tertiary">Semua alat wajib diperiksa sebelum disimpan.</p></div><span className="rounded-md bg-surface-2 px-2 py-1 text-[10px] font-medium text-ink-muted">{formatNumber(record?.items.length ?? 0)} alat</span></div>
            <div className={cn('space-y-2.5 p-3', hasMultipleItems && 'min-h-0 flex-1 overflow-y-auto overscroll-contain')}>
              {(() => {
                const items = record?.items ?? [];
                if (items.length === 0) {
                  return <p className="py-6 text-center text-xs text-semantic-danger">Detail alat tidak tersedia.</p>;
                }
                return items.map((item) => {
                const state = itemStates[item.equipment_id];
                const localCharge = getLocalCharge(item, state);
                const replacementValueLabel = item.replacement_value !== undefined
                  ? `Nilai penggantian: ${formatCurrency(item.replacement_value)}`
                  : 'Nilai penggantian belum dikonfigurasi.';
                return <article key={item.equipment_id} className="space-y-2 rounded-lg border border-hairline bg-surface-1 p-3 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-x-2 gap-y-0.5"><span className="font-mono text-[11px] font-bold text-primary">{item.kode_alat}</span><span className="truncate text-xs font-semibold text-ink">{item.nama_alat}</span></div><p className="mt-1 text-[10px] text-ink-tertiary">Kondisi awal: {item.kondisi_awal}</p></div>{localCharge !== undefined && localCharge > 0 && <span className="shrink-0 text-[10px] font-semibold text-semantic-danger">{formatCurrency(localCharge)}</span>}</div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <div className="space-y-1"><Label className="text-[10px] text-ink-muted">Kondisi saat kembali</Label><Select value={state?.condition} onValueChange={(condition) => handleConditionValueChange(item.equipment_id, state, condition)}><SelectTrigger className="h-9 bg-surface-2 text-xs"><SelectValue placeholder="Pilih kondisi" /></SelectTrigger><SelectContent><SelectItem value="bagus">Bagus (normal)</SelectItem><SelectItem value="sedikit_kerusakan">Sedikit rusak</SelectItem><SelectItem value="rusak">Rusak</SelectItem><SelectItem value="rusak_besar">Rusak berat</SelectItem><SelectItem value="hilang">Hilang</SelectItem></SelectContent></Select></div>
                    {state && state.condition !== 'bagus' && <RadioGroup
                      name={`return-settlement-${item.equipment_id}`}
                      legend="Penyelesaian"
                      value={state.settlement_method}
                      options={[
                        { value: 'repair', label: 'Perbaikan / servis' },
                        { value: 'replacement', label: 'Ganti dengan nilai alat' },
                      ]}
                      onValueChange={(value) => handleSettlementValueChange(item.equipment_id, value)}
                      disabled={state.condition === 'hilang'}
                      className="md:col-span-2"
                    />}
                  </div>
                  {state && state.condition !== 'bagus' && <div className="grid grid-cols-1 gap-2 md:grid-cols-2"><div>{state.settlement_method === 'repair' ? <><Label htmlFor={`repair-cost-${item.equipment_id}`} className="text-[10px] text-ink-muted">Biaya perbaikan</Label><FormattedNumberInput id={`repair-cost-${item.equipment_id}`} min="1" step="0.01" placeholder="Masukkan nominal" value={state.repair_cost} onChange={(value) => setItemState(item.equipment_id, { repair_cost: value })} className="mt-1 h-9 bg-surface-2 text-xs" /></> : <div className="rounded-md border border-dashed border-hairline bg-surface-2 px-2.5 py-2 text-[10px] leading-4 text-ink-subtle">{replacementValueLabel}</div>}</div><div><Label htmlFor={`item-notes-${item.equipment_id}`} className="text-[10px] text-ink-muted">Catatan item</Label><Input id={`item-notes-${item.equipment_id}`} value={state.notes} onChange={(event) => setItemState(item.equipment_id, { notes: event.target.value })} placeholder="Kerusakan atau kelengkapan" className="mt-1 h-9 bg-surface-2 text-xs" /></div></div>}
                  {(() => {
                    if (!state) return null;
                    if (state.condition === 'hilang') {
                      return <p className="rounded-md border border-dashed border-hairline bg-surface-2 px-2.5 py-2 text-[10px] leading-4 text-ink-tertiary">Foto tidak wajib untuk alat yang dinyatakan hilang.</p>;
                    }
                    return (
                      <ReturnEvidenceUploadField
                        field={{
                          id: `return-evidence-${item.equipment_id}`,
                          label: 'Foto kondisi alat',
                          values: state.evidence_files,
                          onChange: (files) => handleEvidenceChange(item.equipment_id, files),
                        }}
                        validation={{ required: true, error: evidenceErrors[item.equipment_id] }}
                        state={{ disabled: isLoading || isSubmitting }}
                      />
                    );
                  })()}
                </article>;
                });
              })()}
            </div>
          </section>

          <div className="shrink-0 space-y-3 px-4 py-4 sm:px-5"><div className="space-y-1.5"><Label htmlFor="catatan_pengembalian" className="text-xs text-ink-muted">Catatan pemeriksaan <span className="font-normal text-ink-tertiary">(opsional)</span></Label><Textarea id="catatan_pengembalian" rows={2} placeholder="Kelengkapan aksesori, kabel, atau kerusakan fisik..." className="resize-none bg-surface-2 text-xs" {...form.register('catatan_pengembalian')} /></div><div className="space-y-1.5"><Label htmlFor="change_reason" className="text-xs text-ink-muted">Alasan audit <span className="text-semantic-danger">*</span></Label><Input id="change_reason" className={cn('h-9 bg-surface-2 text-xs', form.formState.errors.change_reason && 'border-semantic-danger')} {...form.register('change_reason')} />{form.formState.errors.change_reason && <p className="text-[10px] text-semantic-danger">{form.formState.errors.change_reason.message}</p>}</div></div>
          </div>
          <DialogFooter className="shrink-0 border-t border-hairline bg-surface-2/45 px-4 py-3 sm:px-5 md:pb-3"><Button type="button" variant="secondary" onClick={handleClose} disabled={isSubmitting} className="text-xs">Batal</Button><Button type="submit" disabled={isLoading || isSubmitting || !record || !completeInspection} className="bg-semantic-warning text-xs text-white hover:bg-semantic-warning/90">{submitButtonContent}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
