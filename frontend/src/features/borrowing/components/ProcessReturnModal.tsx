// src/features/borrowing/components/ProcessReturnModal.tsx
// Modal for processing equipment return with physical condition check and fine calculation

import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RotateCcw, Loader2 } from 'lucide-react';

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select';
import { cn } from '@/shared/utils/cn';
import { getErrorMessage } from '@/shared/api/errors';
import { formatCurrency } from '@/shared/utils/formatCurrency';

import { processReturnSchema, type ProcessReturnFormValues } from '../schemas/borrowingSchema';
import type { BorrowingRecord, ReturnItemCondition } from '../types/borrowing.types';

interface ProcessReturnModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: BorrowingRecord | null;
  onSubmit: (values: {
    borrowing_id: string;
    tanggal_dikembalikan: string;
    item_conditions: ReturnItemCondition[];
    catatan_pengembalian?: string;
    total_denda?: number;
    change_reason: string;
  }) => Promise<void>;
  isLoading?: boolean;
  error?: unknown;
}

export function ProcessReturnModal({
  open,
  onOpenChange,
  record,
  onSubmit,
  isLoading,
  error,
}: ProcessReturnModalProps) {
  const [itemConditions, setItemConditions] = useState<Record<string, { kondisi: string; denda: number }>>({});

  const form = useForm<ProcessReturnFormValues>({
    resolver: zodResolver(processReturnSchema),
    defaultValues: {
      tanggal_dikembalikan: new Date().toISOString().split('T')[0],
      catatan_pengembalian: '',
      total_denda: 0,
      change_reason: 'Pemeriksaan & pengembalian fisik barang inventaris',
    },
  });
  const totalFine = useWatch({ control: form.control, name: 'total_denda', defaultValue: 0 });

  const handleConditionChange = (equipmentId: string, kondisi: string) => {
    const damageFine: Record<string, number> = {
      bagus: 0,
      sedikit_kerusakan: 50000,
      rusak: 200000,
      rusak_besar: 300000,
      sedang_diperbaiki: 200000,
      hilang: 500000,
    };

    const nextMap = {
      ...itemConditions,
      [equipmentId]: { kondisi, denda: damageFine[kondisi] ?? 0 },
    };
    setItemConditions(nextMap);

    // Sum total fine
    const totalDamageFine = Object.values(nextMap).reduce((acc, curr) => acc + curr.denda, 0);
    form.setValue('total_denda', totalDamageFine);
  };

  const handleClose = () => {
    setItemConditions({});
    onOpenChange(false);
  };

  const handleSubmit = form.handleSubmit(async (data) => {
    if (!record) return;

    const conditions: ReturnItemCondition[] = record.items.map((item) => {
      const state = itemConditions[item.equipment_id] ?? { kondisi: 'bagus', denda: 0 };
      return {
        equipment_id: item.equipment_id,
        kondisi_kembali: state.kondisi,
        denda: state.denda,
      };
    });

    await onSubmit({
      borrowing_id: record.id,
      tanggal_dikembalikan: data.tanggal_dikembalikan,
      item_conditions: conditions,
      catatan_pengembalian: data.catatan_pengembalian || undefined,
      total_denda: data.total_denda,
      change_reason: data.change_reason,
    });

    handleClose();
  });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[85dvh] max-w-lg overflow-hidden border-hairline bg-surface-1 text-ink">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <RotateCcw size={18} className="text-semantic-warning" />
            <DialogTitle className="text-ink text-base font-semibold">Proses Pengembalian Peralatan</DialogTitle>
          </div>
          <DialogDescription className="text-ink-subtle text-xs">
            Pemeriksaan kondisi fisik barang dari peminjam <strong className="text-ink">{record?.borrower_nama}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="min-h-0 flex-1 space-y-4 overflow-hidden flex flex-col pt-1">
          {Boolean(error) && (
            <div role="alert" className="px-3 py-2 rounded bg-semantic-danger/10 border border-semantic-danger/30 text-semantic-danger text-xs shrink-0">
              {getErrorMessage(error)}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 shrink-0 sm:grid-cols-2">
            {/* Tanggal Dikembalikan */}
            <div className="space-y-1">
              <Label htmlFor="tanggal_dikembalikan" className="text-ink-muted text-xs">Tanggal Pengembalian *</Label>
              <Input
                id="tanggal_dikembalikan"
                type="date"
                className="bg-surface-2 border-hairline text-ink text-xs"
                {...form.register('tanggal_dikembalikan')}
              />
            </div>

            {/* Total Denda */}
            <div className="space-y-1">
              <Label htmlFor="total_denda" className="text-ink-muted text-xs">Total Denda (Kerusakan/Keterlambatan)</Label>
              <Input
                id="total_denda"
                type="text"
                value={formatCurrency(totalFine ?? 0)}
                readOnly
                aria-describedby="total-denda-help"
                className="bg-surface-2 border-hairline text-semantic-danger font-mono font-bold text-xs"
              />
              <p id="total-denda-help" className="text-[10px] text-ink-tertiary">Dihitung ulang oleh server berdasarkan kondisi alat.</p>
            </div>
          </div>

          {/* Item Condition Checks */}
          <div className="min-h-0 flex-1 overflow-y-auto space-y-2 pr-1 border-t border-b border-hairline py-2 my-1">
            <Label className="text-ink-muted text-xs font-semibold">Kondisi Fisik Peralatan yang Dikembalikan *</Label>

            {record?.items.length === 0 ? (
              <p className="text-semantic-danger text-xs py-4">Detail alat tidak tersedia. Data peminjaman lama perlu direkonsiliasi sebelum dapat diproses.</p>
            ) : record?.items.map((item) => {
              const state = itemConditions[item.equipment_id] ?? { kondisi: 'bagus', denda: 0 };
              return (
                <div key={item.equipment_id} className="flex flex-col items-stretch justify-between gap-2 rounded border border-hairline/60 bg-surface-2/60 p-2.5 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <span className="font-mono text-[11px] font-bold text-primary mr-1.5">{item.kode_alat}</span>
                    <span className="text-ink font-semibold text-xs">{item.nama_alat}</span>
                    <p className="text-[10px] text-ink-tertiary">Kondisi awal: {item.kondisi_awal}</p>
                  </div>

                  <Select
                    value={state.kondisi}
                    onValueChange={(val) => val && handleConditionChange(item.equipment_id, val)}
                  >
                    <SelectTrigger className="w-full bg-surface-1 border-hairline text-ink text-xs sm:w-36">
                      <SelectValue placeholder="Pilih kondisi pengembalian" />
                    </SelectTrigger>
                    <SelectContent className="bg-surface-3 border-hairline text-ink">
                      <SelectItem value="bagus">Bagus (Normal)</SelectItem>
                      <SelectItem value="sedikit_kerusakan">Sedikit Rusak</SelectItem>
                      <SelectItem value="rusak">Rusak</SelectItem>
                      <SelectItem value="rusak_besar">Rusak Berat</SelectItem>
                      <SelectItem value="sedang_diperbaiki">Sedang Diperbaiki</SelectItem>
                      <SelectItem value="hilang">Hilang</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>

          {/* Catatan Pengembalian */}
          <div className="space-y-1 shrink-0">
            <Label htmlFor="catatan_pengembalian" className="text-ink-muted text-xs">Catatan Pemeriksaan (Opsional)</Label>
            <Textarea
              id="catatan_pengembalian"
              rows={2}
              placeholder="Catatan kelengkapan aksesoris, kabel, atau baret halus..."
              className="bg-surface-2 border-hairline text-ink text-xs"
              {...form.register('catatan_pengembalian')}
            />
          </div>

          {/* Change Reason (Zero Silent Edits Requirement) */}
          <div className="space-y-1 shrink-0 pt-2 border-t border-hairline">
            <Label htmlFor="change_reason" className="text-ink-muted text-xs font-semibold">
              Alasan Pengembalian (Audit Header) *
            </Label>
            <Input
              id="change_reason"
              placeholder="cth. Verifikasi pengembalian alat oleh Tim Peralatan"
              className={cn('bg-surface-2 border-hairline text-ink text-xs', form.formState.errors.change_reason && 'border-semantic-danger')}
              {...form.register('change_reason')}
            />
            {form.formState.errors.change_reason && (
              <p className="text-semantic-danger text-[10px]">{form.formState.errors.change_reason.message}</p>
            )}
          </div>

          <DialogFooter className="shrink-0 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} className="bg-surface-2 border-hairline text-ink text-xs h-9">
              Batal
            </Button>
            <Button type="submit" disabled={isLoading || !record || record.items.length === 0} className="bg-semantic-warning hover:bg-semantic-warning/80 text-black font-semibold text-xs h-9">
              {isLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1.5" />
                  Memproses...
                </>
              ) : (
                'Simpan Pengembalian'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
