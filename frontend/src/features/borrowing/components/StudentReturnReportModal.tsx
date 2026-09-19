import { useMemo, useState, type FormEvent } from 'react';
import { Camera, Loader2, PackageCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/primitives/dialog';
import { Button } from '@/shared/ui/primitives/button';
import { Input } from '@/shared/ui/primitives/input';
import { Label } from '@/shared/ui/primitives/label';
import { Textarea } from '@/shared/ui/primitives/textarea';
import { getErrorMessage } from '@/shared/api/errors';
import { cn } from '@/shared/utils/cn';
import { borrowingService } from '../api/borrowing.service';
import type { BorrowingRecord } from '../types/borrowing.types';
import { ReturnEvidenceUploadField } from './ReturnEvidenceUploadField';

interface StudentReturnReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: BorrowingRecord | null;
  onSubmit: (values: { borrowing_id: string; report_id: string; evidence_ids: string[]; notes?: string; change_reason: string }) => Promise<void>;
  isLoading?: boolean;
  error?: unknown;
}

type ItemFiles = Record<string, File[]>;

export function StudentReturnReportModal({ open, onOpenChange, record, onSubmit, isLoading, error }: StudentReturnReportModalProps) {
  const [filesByEquipment, setFilesByEquipment] = useState<ItemFiles>({});
  const [notes, setNotes] = useState('');
  const [changeReason, setChangeReason] = useState('Melaporkan pengembalian alat ke gudang untuk diverifikasi guru');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const items = record?.items ?? [];
  const totalPhotos = useMemo(() => Object.values(filesByEquipment).reduce((total, files) => total + files.length, 0), [filesByEquipment]);
  const isBusy = Boolean(isLoading || isUploading || isSubmitting);

  const reset = () => {
    setFilesByEquipment({});
    setNotes('');
    setChangeReason('Melaporkan pengembalian alat ke gudang untuk diverifikasi guru');
    setLocalError(null);
    setIsUploading(false);
    setIsSubmitting(false);
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
      setLocalError('Alasan laporan minimal 5 karakter.');
      return;
    }
    const missingItems = items.filter((item) => (filesByEquipment[item.equipment_id]?.length ?? 0) < 2);
    if (missingItems.length > 0) {
      setLocalError(`Tambahkan minimal 2 foto untuk ${missingItems.map((item) => item.kode_alat).join(', ')}.`);
      return;
    }

    setLocalError(null);
    setIsSubmitting(true);
    try {
      setIsUploading(true);
      const uploaded = (await Promise.all(items.map(async (item) => {
        const files = filesByEquipment[item.equipment_id] ?? [];
        return Promise.all(files.map((file) => borrowingService.uploadReturnReportEvidence(record.id, item.equipment_id, file)));
      }))).flat();
      const reportId = uploaded.find((reservation) => reservation.report_id)?.report_id;
      if (!reportId) throw new Error('Identitas laporan pengembalian belum tersedia. Silakan coba lagi.');
      setIsUploading(false);
      await onSubmit({
        borrowing_id: record.id,
        report_id: reportId,
        evidence_ids: uploaded.map((reservation) => reservation.evidence_id),
        notes: notes.trim() || undefined,
        change_reason: changeReason.trim(),
      });
      reset();
      onOpenChange(false);
    } catch (submitError) {
      setLocalError(getErrorMessage(submitError));
    } finally {
      setIsUploading(false);
      setIsSubmitting(false);
    }
  };

  const activeError = localError || (error ? getErrorMessage(error) : null);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : handleClose())}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-2xl gap-0 overflow-hidden border-hairline bg-surface-1 p-0 text-ink sm:max-h-[min(92dvh,760px)]">
        <DialogHeader className="shrink-0 border-b border-hairline px-4 py-4 sm:px-5">
          <div className="flex items-start gap-3 pr-8">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><PackageCheck size={17} aria-hidden="true" /></span>
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold text-ink">Laporkan Pengembalian Alat</DialogTitle>
              <DialogDescription className="mt-1 text-xs leading-5 text-ink-subtle">Unggah foto alat yang sudah diletakkan di gudang. Status akan menunggu verifikasi guru.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form noValidate onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
            {activeError && <div role="alert" className="rounded-lg border border-semantic-danger/25 bg-semantic-danger/8 px-3 py-2.5 text-xs leading-5 text-semantic-danger">{activeError}</div>}
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-3 text-xs leading-5 text-ink-subtle">
              <p className="font-semibold text-ink">{record?.borrower_nama}</p>
              <p className="mt-1">Setiap alat memerlukan minimal 2 foto: tampak kondisi alat dan lokasi penyimpanan.</p>
            </div>

            <div className="space-y-3">
              {items.length === 0 ? <p className="rounded-lg border border-semantic-danger/25 px-3 py-4 text-xs text-semantic-danger">Detail alat belum tersedia.</p> : items.map((item) => (
                <section key={item.equipment_id} className="space-y-2 rounded-lg border border-hairline bg-surface-2/35 p-3">
                  <div className="flex items-start gap-2">
                    <Camera size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] font-bold text-primary">{item.kode_alat}</p>
                      <p className="truncate text-xs font-semibold text-ink">{item.nama_alat}</p>
                    </div>
                  </div>
                  <ReturnEvidenceUploadField
                    field={{
                      id: `return-report-evidence-${item.equipment_id}`,
                      label: `Foto ${item.kode_alat}`,
                      values: filesByEquipment[item.equipment_id] ?? [],
                      onChange: (files) => {
                        setLocalError(null);
                        setFilesByEquipment((current) => ({ ...current, [item.equipment_id]: files }));
                      },
                    }}
                    validation={{ required: true, minFiles: 2, maxFiles: 5 }}
                    state={{ disabled: isBusy }}
                  />
                </section>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="return-report-notes" className="text-xs text-ink-muted">Catatan lokasi penyimpanan <span className="font-normal text-ink-tertiary">(opsional)</span></Label>
              <Textarea id="return-report-notes" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Contoh: disimpan di rak A, baterai dan kabel sudah dikembalikan..." className="resize-none bg-surface-2 text-xs" disabled={isBusy} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="return-report-reason" className="text-xs text-ink-muted">Alasan audit <span className="text-semantic-danger">*</span></Label>
              <Input id="return-report-reason" value={changeReason} onChange={(event) => setChangeReason(event.target.value)} className={cn('h-10 bg-surface-2 text-xs', changeReason.trim().length > 0 && changeReason.trim().length < 5 && 'border-semantic-danger')} disabled={isBusy} />
            </div>
            <p className="text-[10px] text-ink-tertiary">{totalPhotos} foto siap diunggah. Foto hanya dapat dilihat oleh pengguna yang berwenang.</p>
          </div>
          <DialogFooter className="shrink-0 border-t border-hairline bg-surface-2/45 px-4 py-3 sm:px-5 md:pb-5">
            <Button type="button" variant="secondary" onClick={handleClose} disabled={isBusy}>Batal</Button>
            <Button type="submit" disabled={isBusy || !record || items.length === 0} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {isBusy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <PackageCheck size={15} aria-hidden="true" />}
              {isUploading ? 'Mengunggah foto...' : isBusy ? 'Mengirim laporan...' : 'Kirim laporan pengembalian'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
