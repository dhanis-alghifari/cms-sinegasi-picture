
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Wrench, Loader2 } from 'lucide-react';

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
import { isOneOf } from '@/shared/utils/isOneOf';

import { updateConditionSchema, type UpdateConditionFormValues } from '../schemas/equipmentSchema';
import {
  EQUIPMENT_CONDITION_VALUES,
} from '../types/equipment.types';
import type { Equipment } from '../types/equipment.types';

interface UpdateConditionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment?: Equipment | null;
  onSubmit: (values: UpdateConditionFormValues) => Promise<void>;
  isLoading?: boolean;
  error?: unknown;
}

export function UpdateConditionDialog({
  open,
  onOpenChange,
  equipment,
  onSubmit,
  isLoading,
  error,
}: UpdateConditionDialogProps) {
  const form = useForm<UpdateConditionFormValues>({
    resolver: zodResolver(updateConditionSchema),
    defaultValues: {
      kondisi: 'bagus',
      status: 'tersedia',
      catatan_kerusakan: '',
      change_reason: '',
    },
  });

  const selectedCondition = useWatch({ control: form.control, name: 'kondisi' });

  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (equipment) {
      form.reset({
        kondisi: equipment.kondisi,
        status: equipment.kondisi === 'bagus' ? 'tersedia' : 'maintenance',
        catatan_kerusakan: '',
        change_reason: '',
      });
    }
  }, [equipment, form, open]);

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setFormError(null);
    onOpenChange(nextOpen);
  };

  const handleSubmit = form.handleSubmit(async (data) => {
    setFormError(null);
    try {
      await onSubmit(data);
      handleDialogOpenChange(false);
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  });

  const handleConditionValueChange = (value: string | null) => {
    if (value === null) return;
    if (!isOneOf(value, EQUIPMENT_CONDITION_VALUES)) return;
    form.setValue('kondisi', value, { shouldValidate: true });
    form.setValue('status', value === 'bagus' ? 'tersedia' : 'maintenance', { shouldValidate: true });
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="bg-surface-1 border-hairline text-ink max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Wrench size={18} className="text-semantic-warning" />
            <DialogTitle className="text-ink text-base font-semibold">Lapor Kondisi &amp; Maintenance Alat</DialogTitle>
          </div>
          <DialogDescription className="text-ink-subtle text-xs">
            Perbarui kondisi fisik atau status maintenance untuk alat <strong className="text-ink">[{equipment?.kode_alat}] {equipment?.nama_alat}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form noValidate onSubmit={handleSubmit} className="space-y-4 pt-2">
          {(formError || Boolean(error)) && (
            <div role="alert" className="px-3.5 py-2.5 rounded-md bg-semantic-danger/10 border border-semantic-danger/30 text-semantic-danger text-xs font-medium">
              {formError || getErrorMessage(error)}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Kondisi Fisik Baru */}
            <div className="space-y-1">
              <Label className="text-ink-muted text-xs font-semibold">Kondisi Fisik Baru *</Label>
              <Select
                value={selectedCondition}
                onValueChange={handleConditionValueChange}
              >
                <SelectTrigger className="bg-surface-2 border-hairline text-ink text-xs">
                  <SelectValue placeholder="Pilih kondisi baru" />
                </SelectTrigger>
                <SelectContent className="bg-surface-3 border-hairline text-ink">
                  <SelectItem value="bagus">Bagus</SelectItem>
                  <SelectItem value="sedikit_kerusakan">Sedikit Rusak</SelectItem>
                  <SelectItem value="rusak">Rusak</SelectItem>
                  <SelectItem value="rusak_besar">Rusak Besar</SelectItem>
                  <SelectItem value="sedang_diperbaiki">Sedang Diperbaiki</SelectItem>
                  <SelectItem value="hilang">Hilang</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-xs text-ink-muted">
              Status otomatis: <strong className="text-ink">{selectedCondition === 'bagus' ? 'Tersedia' : 'Maintenance'}</strong>. Status dipinjam hanya berubah melalui proses serah-terima.
            </div>
          </div>

          {/* Catatan Kerusakan */}
          <div className="space-y-1">
            <Label htmlFor="catatan_kerusakan" className="text-ink-muted text-xs">Catatan Kerusakan / Laporan Maintenance</Label>
            <Textarea
              id="catatan_kerusakan"
              rows={3}
              placeholder="Detail bagian yang mengalami kendala (cth: Tombol shutter agak macet / LCD bergaris tipis)..."
              className="bg-surface-2 border-hairline text-ink text-xs"
              {...form.register('catatan_kerusakan')}
            />
          </div>

          <div className="space-y-1 pt-2 border-t border-hairline">
            <Label htmlFor="change_reason" className="text-ink-muted text-xs font-semibold">
              Alasan Perubahan Kondisi (Audit Header) *
            </Label>
            <Input
              id="change_reason"
              placeholder="cth. Laporan pengecekan rutin tim alat setelah penggunaan"
              className={cn('bg-surface-2 border-hairline text-ink text-xs', form.formState.errors.change_reason && 'border-semantic-danger')}
              {...form.register('change_reason')}
            />
            {form.formState.errors.change_reason && (
              <p className="text-semantic-danger text-[10px]">{form.formState.errors.change_reason.message}</p>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)} className="bg-surface-2 border-hairline text-ink text-xs h-9">
              Batal
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-semantic-warning text-white hover:bg-semantic-warning/90 font-semibold text-xs h-9">
              {isLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1.5" />
                  Menyimpan...
                </>
              ) : (
                'Simpan Laporan'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
