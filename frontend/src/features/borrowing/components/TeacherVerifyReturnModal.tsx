import { useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, ImageIcon, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/primitives/dialog';
import { Button } from '@/shared/ui/primitives/button';
import { Input } from '@/shared/ui/primitives/input';
import { Label } from '@/shared/ui/primitives/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select';
import { Textarea } from '@/shared/ui/primitives/textarea';
import { getErrorMessage } from '@/shared/api/errors';
import { cn } from '@/shared/utils/cn';
import { useBorrowingReturnReportEvidenceQuery, useBorrowingReturnReportQuery } from '../hooks/useBorrowingQuery';
import type { BorrowingRecord, ReturnItemCondition, ReturnReportDecision, ReturnReportVerificationMethod } from '../types/borrowing.types';

interface TeacherVerifyReturnModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: BorrowingRecord | null;
  onSubmit: (values: { borrowing_id: string; report_id: string; decision: ReturnReportDecision; verification_method: ReturnReportVerificationMethod; item_conditions: ReturnItemCondition[]; rejection_reason?: string; change_reason: string }) => Promise<void>;
  isLoading?: boolean;
  error?: unknown;
}

type ConditionState = Record<string, { condition: string; settlement_method: 'none' | 'repair' | 'replacement'; repair_cost?: number }>;

const conditionLabels: Record<string, string> = {
  bagus: 'Baik',
  sedikit_kerusakan: 'Kerusakan ringan',
  rusak: 'Rusak',
  rusak_besar: 'Rusak berat',
  hilang: 'Hilang',
};

function defaultSettlement(condition: string): 'none' | 'repair' | 'replacement' {
  if (condition === 'bagus') return 'none';
  if (condition === 'hilang') return 'replacement';
  return 'repair';
}

function defaultConditionState(record?: BorrowingRecord | null): ConditionState {
  return Object.fromEntries((record?.items ?? []).map((item) => [item.equipment_id, { condition: 'bagus', settlement_method: 'none' as const }]));
}

export function TeacherVerifyReturnModal({ open, onOpenChange, record, onSubmit, isLoading, error }: TeacherVerifyReturnModalProps) {
  const [decision, setDecision] = useState<ReturnReportDecision>('approve');
  const [verificationMethod, setVerificationMethod] = useState<ReturnReportVerificationMethod>('photo');
  const [itemStates, setItemStates] = useState<ConditionState>(() => defaultConditionState(record));
  const [rejectionReason, setRejectionReason] = useState('');
  const [changeReason, setChangeReason] = useState('Memverifikasi laporan pengembalian alat siswa');
  const [localError, setLocalError] = useState<string | null>(null);
  const evidenceQuery = useBorrowingReturnReportEvidenceQuery(record?.id, open);
  const isBusy = Boolean(isLoading);

  const reportQuery = useBorrowingReturnReportQuery(record?.id, open);
  const evidence = evidenceQuery.data ?? [];
  const evidenceByEquipment = useMemo(() => evidence.reduce<Record<string, typeof evidence>>((groups, item) => {
    (groups[item.equipment_id] ??= []).push(item);
    return groups;
  }, {}), [evidence]);

  const reset = () => {
    setDecision('approve');
    setVerificationMethod('photo');
    setItemStates(defaultConditionState(record));
    setRejectionReason('');
    setChangeReason('Memverifikasi laporan pengembalian alat siswa');
    setLocalError(null);
  };

  const handleClose = () => {
    if (isBusy) return;
    reset();
    onOpenChange(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!record) return;
    if (changeReason.trim().length < 5) {
      setLocalError('Alasan verifikasi minimal 5 karakter.');
      return;
    }
    if (decision === 'reject' && rejectionReason.trim().length < 5) {
      setLocalError('Alasan penolakan minimal 5 karakter agar siswa dapat memperbaiki laporan.');
      return;
    }
    if (decision === 'approve') {
      const missingRepairCost = record.items.find((item) => {
        const state = itemStates[item.equipment_id];
        return state?.condition !== 'bagus' && state?.settlement_method === 'repair'
          && (!state.repair_cost || state.repair_cost <= 0);
      });
      if (missingRepairCost) {
        setLocalError(`Masukkan biaya perbaikan untuk ${missingRepairCost.kode_alat}.`);
        return;
      }
    }
    const reportId = reportQuery.data?.id;
    if (!reportId) {
      setLocalError('Laporan pengembalian belum dapat dimuat. Muat ulang lalu coba lagi.');
      return;
    }
    setLocalError(null);
    try {
      await onSubmit({
        borrowing_id: record.id,
        report_id: reportId,
        decision,
        verification_method: verificationMethod,
        item_conditions: decision === 'approve' ? record.items.map((item) => ({
          equipment_id: item.equipment_id,
          kondisi_kembali: itemStates[item.equipment_id]?.condition ?? 'bagus',
          settlement_method: itemStates[item.equipment_id]?.settlement_method ?? 'none',
          ...(itemStates[item.equipment_id]?.repair_cost !== undefined ? { repair_cost: itemStates[item.equipment_id].repair_cost } : {}),
        })) : [],
        rejection_reason: decision === 'reject' ? rejectionReason.trim() : undefined,
        change_reason: changeReason.trim(),
      });
      reset();
      onOpenChange(false);
    } catch (submitError) {
      setLocalError(getErrorMessage(submitError));
    }
  };

  const activeError = localError || (error ? getErrorMessage(error) : null) || (evidenceQuery.error ? getErrorMessage(evidenceQuery.error) : null) || (reportQuery.error ? getErrorMessage(reportQuery.error) : null);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : handleClose())}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-3xl gap-0 overflow-hidden border-hairline bg-surface-1 p-0 text-ink sm:max-h-[min(92dvh,820px)]">
        <DialogHeader className="shrink-0 border-b border-hairline px-4 py-4 sm:px-5">
          <div className="flex items-start gap-3 pr-8">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-semantic-success/10 text-semantic-success"><ShieldCheck size={17} aria-hidden="true" /></span>
            <div className="min-w-0"><DialogTitle className="text-base font-semibold text-ink">Verifikasi Pengembalian Alat</DialogTitle><DialogDescription className="mt-1 text-xs leading-5 text-ink-subtle">Tinjau foto dan catatan dari <strong className="text-ink">{record?.borrower_nama}</strong> sebelum mengubah status inventaris.</DialogDescription></div>
          </div>
        </DialogHeader>

        <form noValidate onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
            {activeError && <div role="alert" className="rounded-lg border border-semantic-danger/25 bg-semantic-danger/8 px-3 py-2.5 text-xs leading-5 text-semantic-danger">{activeError}</div>}
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-3 text-xs leading-5 text-ink-subtle">
              <p className="font-semibold text-ink">Catatan siswa</p>
              <p className="mt-1 whitespace-pre-wrap">{record?.return_notes || 'Tidak ada catatan tambahan.'}</p>
            </div>

            <div className="space-y-3">
              {record?.items.map((item) => (
                <section key={item.equipment_id} className="space-y-3 rounded-lg border border-hairline bg-surface-2/35 p-3">
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-mono text-[11px] font-bold text-primary">{item.kode_alat}</p><p className="truncate text-xs font-semibold text-ink">{item.nama_alat}</p></div><span className="shrink-0 text-[10px] text-ink-tertiary">{evidenceByEquipment[item.equipment_id]?.length ?? 0} foto</span></div>
                  {(evidenceByEquipment[item.equipment_id]?.length ?? 0) > 0 ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{evidenceByEquipment[item.equipment_id].map((photo) => <a key={photo.evidence_id} href={photo.access_url} target="_blank" rel="noreferrer" className="group relative aspect-square overflow-hidden rounded-md border border-hairline bg-surface-1"><img src={photo.access_url} alt={`Bukti ${item.kode_alat}`} className="h-full w-full object-cover transition group-hover:scale-105" /><span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-white">Lihat</span></a>)}</div> : <div className="flex items-center gap-2 rounded-md border border-dashed border-semantic-warning/40 px-3 py-3 text-xs text-semantic-warning"><ImageIcon size={15} aria-hidden="true" />Foto belum tersedia.</div>}
                  {decision === 'approve' && (() => {
                    const state = itemStates[item.equipment_id] ?? { condition: 'bagus', settlement_method: 'none' as const };
                    return (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-ink-muted">Kondisi saat diverifikasi</Label>
                          <Select value={state.condition} onValueChange={(value) => {
                            if (!value) return;
                            setItemStates((current) => ({
                              ...current,
                              [item.equipment_id]: {
                                ...current[item.equipment_id],
                                condition: value,
                                settlement_method: defaultSettlement(value),
                                repair_cost: value === 'bagus' || value === 'hilang' ? undefined : current[item.equipment_id]?.repair_cost,
                              },
                            }));
                          }}>
                            <SelectTrigger className="h-10 bg-surface-2 text-xs"><SelectValue placeholder="Pilih kondisi" /></SelectTrigger>
                            <SelectContent>{Object.entries(conditionLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        {state.condition !== 'bagus' && <div className="space-y-1">
                          <Label className="text-[10px] text-ink-muted">Penyelesaian</Label>
                          <Select value={state.settlement_method} onValueChange={(value) => {
                            if (value !== 'repair' && value !== 'replacement') return;
                            setItemStates((current) => ({ ...current, [item.equipment_id]: { ...current[item.equipment_id], settlement_method: value } }));
                          }} disabled={state.condition === 'hilang'}>
                            <SelectTrigger className="h-10 bg-surface-2 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="repair">Perbaikan / servis</SelectItem>
                              <SelectItem value="replacement">Ganti dengan nilai alat</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>}
                        {state.settlement_method === 'repair' && <div className="space-y-1 sm:col-span-2">
                          <Label className="text-[10px] text-ink-muted">Biaya perbaikan <span className="text-semantic-danger">*</span></Label>
                          <Input type="number" min="1" step="1" value={state.repair_cost ?? ''} onChange={(event) => setItemStates((current) => ({ ...current, [item.equipment_id]: { ...current[item.equipment_id], repair_cost: event.target.value ? Number(event.target.value) : undefined } }))} className="h-10 bg-surface-2 text-xs" placeholder="Masukkan nominal biaya" />
                        </div>}
                        {state.settlement_method === 'replacement' && <p className="sm:col-span-2 rounded-md border border-dashed border-hairline bg-surface-2 px-2.5 py-2 text-[10px] leading-4 text-ink-subtle">
                          Nilai penggantian dihitung dari valuasi alat yang aktif.
                        </p>}
                      </div>
                    );
                  })()}
                </section>
              ))}
            </div>

            <div className="space-y-2 rounded-lg border border-hairline bg-surface-2/35 p-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label className="text-xs text-ink-muted">Keputusan</Label><Select value={decision} onValueChange={(value) => { if (value === 'approve' || value === 'reject') setDecision(value); }}><SelectTrigger className="h-10 bg-surface-2 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="approve"><span className="flex items-center gap-2"><CheckCircle2 size={14} className="text-semantic-success" />Setujui pengembalian</span></SelectItem><SelectItem value="reject"><span className="flex items-center gap-2"><XCircle size={14} className="text-semantic-danger" />Tolak dan minta perbaikan</span></SelectItem></SelectContent></Select></div><div className="space-y-1.5"><Label className="text-xs text-ink-muted">Dasar verifikasi</Label><Select value={verificationMethod} onValueChange={(value) => { if (value === 'photo' || value === 'physical_check' || value === 'photo_and_physical') setVerificationMethod(value); }}><SelectTrigger className="h-10 bg-surface-2 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="photo">Foto</SelectItem><SelectItem value="physical_check">Cek fisik langsung</SelectItem><SelectItem value="photo_and_physical">Foto dan cek fisik</SelectItem></SelectContent></Select></div></div>
              {decision === 'reject' && <div className="space-y-1.5"><Label htmlFor="return-rejection-reason" className="text-xs text-ink-muted">Alasan penolakan <span className="text-semantic-danger">*</span></Label><Textarea id="return-rejection-reason" rows={3} value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="Contoh: foto belum menunjukkan nomor seri dan lokasi rak..." className="resize-none bg-surface-2 text-xs" /></div>}
              <div className="space-y-1.5"><Label htmlFor="verify-return-reason" className="text-xs text-ink-muted">Alasan audit <span className="text-semantic-danger">*</span></Label><Input id="verify-return-reason" value={changeReason} onChange={(event) => setChangeReason(event.target.value)} className={cn('h-10 bg-surface-2 text-xs', changeReason.trim().length > 0 && changeReason.trim().length < 5 && 'border-semantic-danger')} /></div>
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t border-hairline bg-surface-2/45 px-4 py-3 sm:px-5 md:pb-5"><Button type="button" variant="secondary" onClick={handleClose} disabled={isBusy}>Batal</Button><Button type="submit" disabled={isBusy || !record} className={decision === 'approve' ? 'bg-semantic-success text-white hover:bg-semantic-success/90' : 'bg-semantic-danger text-white hover:bg-semantic-danger/90'}>{isBusy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : decision === 'approve' ? <CheckCircle2 size={15} aria-hidden="true" /> : <XCircle size={15} aria-hidden="true" />}{decision === 'approve' ? 'Setujui pengembalian' : 'Tolak laporan'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
