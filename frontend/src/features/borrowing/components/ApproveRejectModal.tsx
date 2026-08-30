// src/features/borrowing/components/ApproveRejectModal.tsx
// Modal for approving or rejecting borrowing requests with notes and audit header

import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui/primitives/dialog';
import { Button } from '@/shared/ui/primitives/button';
import { Input } from '@/shared/ui/primitives/input';
import { Label } from '@/shared/ui/primitives/label';
import { Textarea } from '@/shared/ui/primitives/textarea';
import { cn } from '@/shared/utils/cn';
import { getErrorMessage } from '@/shared/api/errors';
import { formatNumber } from '@/shared/utils/formatNumber';

import { approveRejectSchema, type ApproveRejectFormValues } from '../schemas/borrowingSchema';
import type { BorrowingRecord } from '../types/borrowing.types';

interface ApproveRejectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: BorrowingRecord | null;
  onSubmit: (values: ApproveRejectFormValues) => Promise<void>;
  isLoading?: boolean;
  error?: unknown;
}

export function ApproveRejectModal({
  open,
  onOpenChange,
  record,
  onSubmit,
  isLoading,
  error,
}: ApproveRejectModalProps) {
  const form = useForm<ApproveRejectFormValues>({
    resolver: zodResolver(approveRejectSchema),
    defaultValues: {
      action: 'approve',
      catatan: '',
      change_reason: '',
    },
  });

  const selectedAction = useWatch({ control: form.control, name: 'action' });

  useEffect(() => {
    if (record) {
      form.reset({
        action: 'approve',
        catatan: '',
        change_reason: '',
      });
    }
  }, [record, form, open]);

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit(data);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface-1 border-hairline text-ink max-w-md">
        <DialogHeader>
          <DialogTitle className="text-ink text-base font-semibold">
            Persetujuan Peminjaman Alat
          </DialogTitle>
          <DialogDescription className="text-ink-subtle text-xs">
            Tinjau ajuan peminjaman atas nama <strong className="text-ink">{record?.borrower_nama}</strong> ({formatNumber(record?.items.length ?? 0)} unit barang).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {Boolean(error) && (
            <div role="alert" className="px-3 py-2 rounded bg-semantic-danger/10 border border-semantic-danger/30 text-semantic-danger text-xs">
              {getErrorMessage(error)}
            </div>
          )}

          <div className="rounded border border-hairline bg-surface-2/60 p-2 space-y-1">
            <p className="text-[10px] font-semibold text-ink-muted">Detail alat yang diajukan</p>
            {record?.items.length ? record.items.map((item) => (
              <div key={item.borrowing_item_id ?? item.equipment_id} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-ink"><span className="font-mono text-primary mr-1">{item.kode_alat}</span>{item.nama_alat}</span>
                <span className="text-[10px] text-ink-tertiary shrink-0">Kondisi: {item.kondisi_awal}</span>
              </div>
            )) : <p className="text-[10px] text-semantic-danger">Detail alat belum tersedia pada transaksi ini.</p>}
          </div>

          {/* Action Choice */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => form.setValue('action', 'approve')}
              className={cn(
                'p-3 rounded border text-xs flex flex-col items-center gap-1 transition-colors',
                selectedAction === 'approve'
                  ? 'bg-semantic-success/15 border-semantic-success text-semantic-success font-bold'
                  : 'bg-surface-2 border-hairline text-ink-subtle hover:text-ink',
              )}
            >
              <CheckCircle2 size={20} />
              Setujui Peminjaman
            </button>

            <button
              type="button"
              onClick={() => form.setValue('action', 'reject')}
              className={cn(
                'p-3 rounded border text-xs flex flex-col items-center gap-1 transition-colors',
                selectedAction === 'reject'
                  ? 'bg-semantic-danger/15 border-semantic-danger text-semantic-danger font-bold'
                  : 'bg-surface-2 border-hairline text-ink-subtle hover:text-ink',
              )}
            >
              <XCircle size={20} />
              Tolak Ajuan
            </button>
          </div>

          {/* Catatan */}
          <div className="space-y-1">
            <Label htmlFor="catatan" className="text-ink-muted text-xs">Catatan / Alasan (Opsional)</Label>
            <Textarea
              id="catatan"
              rows={2}
              placeholder={selectedAction === 'reject' ? 'Jelaskan alasan penolakan...' : 'Instruksi pengambilan barang di gudang...'}
              className="bg-surface-2 border-hairline text-ink text-xs"
              {...form.register('catatan')}
            />
          </div>

          {/* Change Reason (Zero Silent Edits Requirement) */}
          <div className="space-y-1 pt-2 border-t border-hairline">
            <Label htmlFor="change_reason" className="text-ink-muted text-xs font-semibold">
              Alasan Keputusan (Audit Header) *
            </Label>
            <Input
              id="change_reason"
              placeholder="cth. Verifikasi ketersediaan jadwal shooting & tim alat"
              className={cn('bg-surface-2 border-hairline text-ink text-xs h-9', form.formState.errors.change_reason && 'border-semantic-danger')}
              {...form.register('change_reason')}
            />
            {form.formState.errors.change_reason && (
              <p className="text-semantic-danger text-[10px]">{form.formState.errors.change_reason.message}</p>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="bg-surface-2 border-hairline text-ink text-xs h-9">
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className={cn(
                'text-xs h-9 font-medium',
                selectedAction === 'approve'
                  ? 'bg-semantic-success hover:bg-semantic-success/80 text-white'
                  : 'bg-semantic-danger hover:bg-semantic-danger/80 text-white',
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1.5" />
                  Memproses...
                </>
              ) : selectedAction === 'approve' ? (
                'Simpan Persetujuan'
              ) : (
                'Proses Penolakan'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
