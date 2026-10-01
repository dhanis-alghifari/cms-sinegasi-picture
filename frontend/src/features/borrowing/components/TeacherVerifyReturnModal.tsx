import { useMemo, useState } from 'react';
import { CheckCircle2, ImageIcon, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/primitives/dialog';
import { Button } from '@/shared/ui/primitives/button';
import { Input } from '@/shared/ui/primitives/input';
import { FormattedNumberInput } from '@/shared/ui/FormattedNumberInput';
import { Label } from '@/shared/ui/primitives/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select';
import { Textarea } from '@/shared/ui/primitives/textarea';
import { getErrorMessage } from '@/shared/api/errors';
import { cn } from '@/shared/utils/cn';
import { ImagePreviewDialog } from '@/shared/ui/ImagePreviewDialog';
import { useBorrowingReturnReportEvidenceQuery, useBorrowingReturnReportQuery } from '../hooks/useBorrowingQuery';
import type { BorrowingRecord, BorrowedItem, ReturnItemCondition, ReturnReportDecision, ReturnReportVerificationMethod } from '../types/borrowing.types';

interface TeacherVerifyReturnModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: BorrowingRecord | null;
  onSubmit: (values: { borrowing_id: string; report_id: string; decision: ReturnReportDecision; verification_method: ReturnReportVerificationMethod; item_conditions: ReturnItemCondition[]; rejection_reason?: string; change_reason: string }) => Promise<void>;
  isLoading?: boolean;
  error?: unknown;
}

type ConditionState = Record<string, { condition: string; repair_cost?: number }>;
type ItemOutcome = { status: 'returned' | 'pending_resolution'; condition: string };
type ItemErrors = Record<string, string>;

const conditionLabels: Record<string, string> = {
  belum_diperiksa: 'Belum diperiksa',
  bagus: 'Baik',
  sedikit_kerusakan: 'Kerusakan ringan',
  rusak: 'Rusak',
  rusak_besar: 'Rusak berat',
  hilang: 'Hilang',
};

function defaultSettlement(condition: string): 'none' | 'repair' | 'replacement' {
  if (condition === 'belum_diperiksa' || condition === 'bagus') return 'none';
  if (condition === 'hilang') return 'replacement';
  return 'repair';
}

function defaultConditionState(record?: BorrowingRecord | null): ConditionState {
  return Object.fromEntries((record?.items ?? []).map((item) => [item.equipment_id, { condition: 'belum_diperiksa' }]));
}

export function TeacherVerifyReturnModal({ open, onOpenChange, record, onSubmit, isLoading, error }: TeacherVerifyReturnModalProps) {
  const [verificationMethod, setVerificationMethod] = useState<ReturnReportVerificationMethod>('photo');
  const [itemStates, setItemStates] = useState<ConditionState>(() => defaultConditionState(record));
  const [itemOutcomes, setItemOutcomes] = useState<Record<string, ItemOutcome>>({});
  const [isRejectFlowOpen, setIsRejectFlowOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [changeReason, setChangeReason] = useState('Memverifikasi laporan pengembalian alat siswa');
  const [localError, setLocalError] = useState<string | null>(null);
  const [itemErrors, setItemErrors] = useState<ItemErrors>({});
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; kode_alat: string; filename: string } | null>(null);
  const evidenceQuery = useBorrowingReturnReportEvidenceQuery(record?.id, open);
  const reportQuery = useBorrowingReturnReportQuery(record?.id, open);
  const isBusy = Boolean(isLoading);

  const evidenceByEquipment = useMemo(() => {
    const evidence = evidenceQuery.data ?? [];
    return evidence.reduce<Record<string, typeof evidence>>((groups, item) => {
      (groups[item.equipment_id] ??= []).push(item);
      return groups;
    }, {});
  }, [evidenceQuery.data]);

  const items = record?.items ?? [];
  const handledIds = useMemo(() => new Set(items
    .filter((item) => item.status === 'returned' || item.status === 'pending_resolution')
    .map((item) => item.equipment_id)
    .concat(Object.keys(itemOutcomes))), [itemOutcomes, items]);
  const pendingItems = items.filter((item) => !handledIds.has(item.equipment_id));
  const completedCount = items.filter((item) => item.status === 'returned' || itemOutcomes[item.equipment_id]?.status === 'returned').length;
  const waitingRecoveryCount = items.filter((item) => item.status === 'pending_resolution' || itemOutcomes[item.equipment_id]?.status === 'pending_resolution').length;
  const handledCount = Math.min(items.length, handledIds.size);
  const isReportLoading = reportQuery.isLoading || evidenceQuery.isLoading;
  const canProcess = Boolean(reportQuery.data?.id) && !isReportLoading && !isBusy;

  const reset = () => {
    setVerificationMethod('photo');
    setItemStates(defaultConditionState(record));
    setItemOutcomes({});
    setIsRejectFlowOpen(false);
    setRejectionReason('');
    setChangeReason('Memverifikasi laporan pengembalian alat siswa');
    setLocalError(null);
    setItemErrors({});
    setPreviewPhoto(null);
  };

  const handleClose = () => {
    if (isBusy) return;
    reset();
    onOpenChange(false);
  };

  const reportId = reportQuery.data?.id;

  const handleVerifyItem = async (item: BorrowedItem) => {
    if (!record || isBusy) return;
    if (changeReason.trim().length < 5) {
      setLocalError('Alasan audit minimal 5 karakter.');
      return;
    }

    const state = itemStates[item.equipment_id] ?? { condition: 'belum_diperiksa' };
    if (state.condition === 'belum_diperiksa') {
      setItemErrors((current) => ({ ...current, [item.equipment_id]: `Pilih kondisi alat ${item.kode_alat} sebelum memprosesnya.` }));
      return;
    }
    const itemEvidence = evidenceByEquipment[item.equipment_id] ?? [];
    if (state.condition !== 'hilang' && itemEvidence.length < 2) {
      setItemErrors((current) => ({ ...current, [item.equipment_id]: `Minimal 2 foto kondisi diperlukan untuk ${item.kode_alat}.` }));
      return;
    }
    const settlementMethod = defaultSettlement(state.condition);
    if (state.condition !== 'bagus' && state.condition !== 'hilang'
      && (state.repair_cost === undefined || !Number.isFinite(state.repair_cost) || state.repair_cost <= 0)) {
      setItemErrors((current) => ({ ...current, [item.equipment_id]: `Masukkan biaya perbaikan untuk ${item.kode_alat}.` }));
      return;
    }
    if (!reportId) {
      setLocalError('Laporan pengembalian belum dapat dimuat. Muat ulang lalu coba lagi.');
      return;
    }

    setLocalError(null);
    setItemErrors((current) => ({ ...current, [item.equipment_id]: '' }));
    try {
      const handledCountBefore = handledCount;
      await onSubmit({
        borrowing_id: record.id,
        report_id: reportId,
        decision: 'approve',
        verification_method: verificationMethod,
        item_conditions: [{
          equipment_id: item.equipment_id,
          kondisi_kembali: state.condition,
          settlement_method: settlementMethod,
          ...(state.repair_cost !== undefined ? { repair_cost: state.repair_cost } : {}),
        }],
        change_reason: changeReason.trim(),
      });

      setItemOutcomes((current) => ({
        ...current,
        [item.equipment_id]: {
          status: state.condition === 'bagus' ? 'returned' : 'pending_resolution',
          condition: state.condition,
        },
      }));
      setIsRejectFlowOpen(false);
      if (handledCountBefore + 1 >= items.length) {
        reset();
        onOpenChange(false);
      }
    } catch (submitError) {
      setItemErrors((current) => ({ ...current, [item.equipment_id]: getErrorMessage(submitError) }));
    }
  };

  const handleRejectRemaining = async () => {
    if (!record || isBusy || pendingItems.length === 0) return;
    if (changeReason.trim().length < 5) {
      setLocalError('Alasan audit minimal 5 karakter.');
      return;
    }
    if (rejectionReason.trim().length < 5) {
      setLocalError('Alasan penolakan minimal 5 karakter agar siswa tahu alat mana yang perlu diperbaiki.');
      return;
    }
    if (!reportId) {
      setLocalError('Laporan pengembalian belum dapat dimuat. Muat ulang lalu coba lagi.');
      return;
    }

    setLocalError(null);
    try {
      await onSubmit({
        borrowing_id: record.id,
        report_id: reportId,
        decision: 'reject',
        verification_method: verificationMethod,
        item_conditions: [],
        rejection_reason: rejectionReason.trim(),
        change_reason: changeReason.trim(),
      });
      reset();
      onOpenChange(false);
    } catch (submitError) {
      setLocalError(getErrorMessage(submitError));
    }
  };

  const activeError = localError
    || (error ? getErrorMessage(error) : null)
    || (evidenceQuery.error ? getErrorMessage(evidenceQuery.error) : null)
    || (reportQuery.error ? getErrorMessage(reportQuery.error) : null);

  return (
    <>
      <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : handleClose())}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-3xl gap-0 overflow-hidden border-hairline bg-surface-1 p-0 text-ink sm:max-h-[min(92dvh,820px)]">
          <DialogHeader className="shrink-0 border-b border-hairline px-4 py-4 sm:px-5">
            <div className="flex items-start gap-3 pr-8">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-semantic-success/10 text-semantic-success"><ShieldCheck size={17} aria-hidden="true" /></span>
              <div className="min-w-0"><DialogTitle className="text-base font-semibold text-ink">Verifikasi Pengembalian Alat</DialogTitle><DialogDescription className="mt-1 text-xs leading-5 text-ink-subtle">Tinjau foto dan catatan dari <strong className="text-ink">{record?.borrower_nama}</strong>. Setiap alat dapat diverifikasi secara terpisah.</DialogDescription></div>
            </div>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
              {activeError && <div role="alert" aria-live="polite" className="rounded-lg border border-semantic-danger/25 bg-semantic-danger/8 px-3 py-2.5 text-xs leading-5 text-semantic-danger">{activeError}</div>}
              {isReportLoading && <div role="status" aria-live="polite" className="rounded-lg border border-hairline bg-surface-2 px-3 py-2.5 text-xs text-ink-subtle">Memuat laporan dan foto bukti...</div>}
              <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-3 text-xs" role="status" aria-live="polite">
                <div>
                  <p className="font-semibold text-ink">Progres pemeriksaan</p>
                  <p className="mt-1 text-ink-subtle">{completedCount} diterima{waitingRecoveryCount > 0 ? ` · ${waitingRecoveryCount} menunggu tindak lanjut` : ''}{pendingItems.length > 0 ? ` · ${pendingItems.length} belum diperiksa` : ''}</p>
                </div>
                <span className="shrink-0 rounded-full bg-surface-1 px-2.5 py-1 font-semibold text-primary">{handledCount}/{items.length}</span>
              </div>
              <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-3 text-xs leading-5 text-ink-subtle">
                <p className="font-semibold text-ink">Catatan siswa</p>
                <p className="mt-1 whitespace-pre-wrap">{record?.return_notes || 'Tidak ada catatan tambahan.'}</p>
              </div>

              <div className="space-y-3">
                {items.map((item) => {
                  const state = itemStates[item.equipment_id] ?? { condition: 'belum_diperiksa' };
                  const alreadyHandled = handledIds.has(item.equipment_id);
                  const waitingRecovery = item.status === 'pending_resolution' || itemOutcomes[item.equipment_id]?.status === 'pending_resolution';
                  const itemEvidence = evidenceByEquipment[item.equipment_id] ?? [];
                  const itemError = itemErrors[item.equipment_id];
                  const outcomeCondition = item.kondisi_kembali ?? itemOutcomes[item.equipment_id]?.condition;
                  const actionLabel = state.condition === 'bagus'
                    ? 'Terima pengembalian'
                    : state.condition === 'hilang'
                      ? 'Catat kehilangan'
                      : state.condition === 'belum_diperiksa'
                        ? 'Pilih kondisi alat'
                        : 'Catat kerusakan & minta perbaikan';
                  const canVerifyItem = canProcess
                    && state.condition !== 'belum_diperiksa'
                    && (state.condition === 'hilang' || itemEvidence.length >= 2)
                    && (state.condition === 'bagus' || state.condition === 'hilang'
                      || (state.repair_cost !== undefined && Number.isFinite(state.repair_cost) && state.repair_cost > 0));

                  return (
                    <section key={item.equipment_id} aria-label={`${item.kode_alat} ${item.nama_alat}`} className={cn('space-y-3 rounded-lg border p-3', alreadyHandled ? (waitingRecovery ? 'border-semantic-warning/30 bg-semantic-warning/5' : 'border-semantic-success/30 bg-semantic-success/5') : 'border-hairline bg-surface-2/35')}>
                      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-mono text-[11px] font-bold text-primary">{item.kode_alat}</p><p className="truncate text-xs font-semibold text-ink">{item.nama_alat}</p></div><span className="shrink-0 text-[10px] text-ink-tertiary">{itemEvidence.length} foto</span></div>
                      {itemEvidence.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {itemEvidence.map((photo) => (
                            <button
                              key={photo.evidence_id}
                              type="button"
                              onClick={() => setPreviewPhoto({ url: photo.access_url, kode_alat: item.kode_alat, filename: photo.original_filename })}
                              aria-label={`Lihat foto ${item.kode_alat}: ${photo.original_filename}`}
                              className="group relative aspect-square min-h-11 min-w-11 overflow-hidden rounded-md border border-hairline bg-surface-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                              <img src={photo.access_url} alt={`Bukti ${item.kode_alat}`} className="h-full w-full object-cover transition group-hover:scale-105" />
                              <span aria-hidden="true" className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-white">Lihat</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 rounded-md border border-dashed border-semantic-warning/40 px-3 py-3 text-xs text-semantic-warning">
                          <ImageIcon size={15} aria-hidden="true" />Foto belum tersedia.
                        </div>
                      )}

                      {alreadyHandled ? (
                        <div className={cn('flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-xs', waitingRecovery ? 'bg-semantic-warning/10 text-semantic-warning' : 'bg-semantic-success/10 text-semantic-success')} role="status">
                          {waitingRecovery ? <ShieldCheck size={16} aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
                          <span>{waitingRecovery
                            ? outcomeCondition === 'hilang' ? 'Kehilangan dicatat · menunggu unit pengganti' : 'Kerusakan dicatat · menunggu perbaikan dan inspeksi'
                            : `Pengembalian diterima${outcomeCondition && outcomeCondition !== 'belum_diperiksa' ? ` · kondisi ${conditionLabels[outcomeCondition] ?? outcomeCondition}` : ''}`}</span>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <div className="space-y-1">
                              <Label htmlFor={`return-condition-${item.equipment_id}`} className="text-[10px] text-ink-muted">Kondisi saat diverifikasi</Label>
                              <Select value={state.condition} onValueChange={(value) => {
                                if (!value) return;
                                setItemErrors((current) => ({ ...current, [item.equipment_id]: '' }));
                                setItemStates((current) => ({
                                  ...current,
                                  [item.equipment_id]: {
                                    ...current[item.equipment_id],
                                    condition: value,
                                    repair_cost: value === 'belum_diperiksa' || value === 'bagus' || value === 'hilang' ? undefined : current[item.equipment_id]?.repair_cost,
                                  },
                                }));
                              }}>
                                <SelectTrigger id={`return-condition-${item.equipment_id}`} className="h-11 bg-surface-2 text-xs"><SelectValue placeholder="Pilih kondisi" /></SelectTrigger>
                                <SelectContent>{Object.entries(conditionLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            {state.condition !== 'bagus' && state.condition !== 'belum_diperiksa' && <div className="sm:col-span-2 rounded-md border border-semantic-warning/25 bg-semantic-warning/5 px-2.5 py-2 text-[10px] leading-4 text-ink-subtle">
                              {state.condition === 'hilang'
                                ? 'Kehilangan akan dicatat. Pinjaman tetap terbuka sampai unit pengganti didaftarkan.'
                                : 'Kerusakan akan dicatat sebagai tindak lanjut. Pinjaman tetap terbuka sampai servis selesai dan inspeksi akhir lulus.'}
                            </div>}
                            {defaultSettlement(state.condition) === 'repair' && <div className="space-y-1 sm:col-span-2">
                              <Label htmlFor={`return-repair-cost-${item.equipment_id}`} className="text-[10px] text-ink-muted">Biaya perbaikan <span className="text-semantic-danger">*</span></Label>
                              <FormattedNumberInput id={`return-repair-cost-${item.equipment_id}`} inputMode="numeric" min="1" step="1" value={state.repair_cost} onChange={(repairCost) => {
                                setItemErrors((current) => ({ ...current, [item.equipment_id]: '' }));
                                setItemStates((current) => ({ ...current, [item.equipment_id]: { ...current[item.equipment_id], repair_cost: repairCost } }));
                              }} className="h-11 bg-surface-2 text-xs" placeholder="Masukkan nominal biaya" />
                            </div>}
                            {defaultSettlement(state.condition) === 'replacement' && <p className="sm:col-span-2 rounded-md border border-dashed border-hairline bg-surface-2 px-2.5 py-2 text-[10px] leading-4 text-ink-subtle">
                              Nilai penggantian dihitung dari valuasi alat yang aktif.
                            </p>}
                            {state.condition !== 'hilang' && itemEvidence.length < 2 && <p className="sm:col-span-2 text-[10px] text-semantic-warning">Minimal 2 foto bukti harus tersedia agar kondisi alat dapat diverifikasi.</p>}
                          </div>
                          {itemError && <p role="alert" className="text-xs leading-5 text-semantic-danger">{itemError}</p>}
                          <Button
                            type="button"
                            onClick={() => void handleVerifyItem(item)}
                            disabled={!canVerifyItem}
                            className={cn(
                              'min-h-11 w-full text-white sm:w-auto',
                              state.condition === 'bagus' ? 'bg-semantic-success hover:bg-semantic-success/90'
                                : state.condition === 'hilang' ? 'bg-semantic-danger hover:bg-semantic-danger/90'
                                  : 'bg-semantic-warning hover:bg-semantic-warning/90',
                            )}
                          >
                            {isBusy ? <Loader2 size={15} className="motion-safe:animate-spin" aria-hidden="true" /> : state.condition === 'bagus' ? <CheckCircle2 size={15} aria-hidden="true" /> : <ShieldCheck size={15} aria-hidden="true" />}
                            {actionLabel}
                          </Button>
                        </>
                      )}
                    </section>
                  );
                })}
              </div>

              {pendingItems.length === 0 ? (
                <div className={cn('rounded-lg border px-3 py-3 text-xs', waitingRecoveryCount > 0 ? 'border-semantic-warning/30 bg-semantic-warning/5 text-semantic-warning' : 'border-semantic-success/30 bg-semantic-success/5 text-semantic-success')} role="status">
                  {waitingRecoveryCount > 0
                    ? 'Pemeriksaan laporan selesai. Pinjaman tetap terbuka untuk alat yang menunggu perbaikan atau penggantian.'
                    : 'Semua alat dari laporan ini sudah diterima dalam kondisi baik.'}
                </div>
              ) : (
                <div className="space-y-3 rounded-lg border border-hairline bg-surface-2/35 p-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="return-verification-method" className="text-xs text-ink-muted">Dasar verifikasi</Label>
                      <Select value={verificationMethod} onValueChange={(value) => {
                        if (value === 'photo' || value === 'physical_check' || value === 'photo_and_physical') setVerificationMethod(value);
                      }}>
                        <SelectTrigger id="return-verification-method" className="h-11 bg-surface-2 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="photo">Foto</SelectItem><SelectItem value="physical_check">Cek fisik langsung</SelectItem><SelectItem value="photo_and_physical">Foto dan cek fisik</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="verify-return-reason" className="text-xs text-ink-muted">Alasan audit <span className="text-semantic-danger">*</span></Label>
                      <Input id="verify-return-reason" value={changeReason} onChange={(event) => setChangeReason(event.target.value)} className={cn('h-11 bg-surface-2 text-xs', changeReason.trim().length > 0 && changeReason.trim().length < 5 && 'border-semantic-danger')} />
                    </div>
                  </div>

                  {!isRejectFlowOpen ? (
                    <Button type="button" variant="outline" onClick={() => { setLocalError(null); setIsRejectFlowOpen(true); }} disabled={!canProcess} className="min-h-11 w-full border-semantic-danger/40 text-semantic-danger hover:bg-semantic-danger/5 sm:w-auto">
                      <XCircle size={15} aria-hidden="true" />Tolak laporan untuk {pendingItems.length} alat tersisa
                    </Button>
                  ) : (
                    <div className="space-y-2 rounded-md border border-semantic-danger/25 bg-semantic-danger/5 p-3">
                      <p className="text-xs leading-5 text-ink-subtle">Penolakan meminta siswa memperbaiki bukti untuk {pendingItems.length} alat yang belum diperiksa. Alat yang sudah diperiksa tidak terpengaruh.</p>
                      <div className="space-y-1.5">
                        <Label htmlFor="return-rejection-reason" className="text-xs text-ink-muted">Alasan penolakan <span className="text-semantic-danger">*</span></Label>
                        <Textarea id="return-rejection-reason" rows={3} value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="Contoh: foto belum menunjukkan kondisi alat secara jelas..." className="min-h-20 resize-y bg-surface-2 text-xs" />
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                        <Button type="button" variant="secondary" onClick={() => { setIsRejectFlowOpen(false); setLocalError(null); }} disabled={isBusy} className="min-h-11">Kembali</Button>
                        <Button type="button" onClick={() => void handleRejectRemaining()} disabled={!canProcess} className="min-h-11 bg-semantic-danger text-white hover:bg-semantic-danger/90">
                          {isBusy ? <Loader2 size={15} className="motion-safe:animate-spin" aria-hidden="true" /> : <XCircle size={15} aria-hidden="true" />}
                          Tolak alat tersisa
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <DialogFooter className="shrink-0 border-t border-hairline bg-surface-2/45 px-4 py-3 sm:px-5 md:pb-5">
              <Button type="button" variant="secondary" onClick={handleClose} disabled={isBusy} className="min-h-11">Batal</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <ImagePreviewDialog
        open={Boolean(previewPhoto)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPreviewPhoto(null);
        }}
        src={previewPhoto?.url ?? null}
        alt={previewPhoto ? `Bukti kondisi ${previewPhoto.kode_alat}` : 'Pratinjau foto pengembalian'}
        title={previewPhoto ? `Bukti Kondisi ${previewPhoto.kode_alat}` : 'Foto Kondisi Pengembalian'}
        description={previewPhoto?.filename}
      />
    </>
  );
}
