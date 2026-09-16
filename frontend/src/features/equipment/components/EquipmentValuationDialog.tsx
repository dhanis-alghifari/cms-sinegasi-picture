import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/primitives/dialog';
import { Button } from '@/shared/ui/primitives/button';
import { Input } from '@/shared/ui/primitives/input';
import { Label } from '@/shared/ui/primitives/label';
import { Textarea } from '@/shared/ui/primitives/textarea';
import { FormattedNumberInput } from '@/shared/ui/FormattedNumberInput';
import { getErrorMessage } from '@/shared/api/errors';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { useEquipmentValuationsQuery } from '../hooks/useEquipmentValuation';
import { z } from 'zod';
import type { Equipment, CreateEquipmentValuationPayload } from '../types/equipment.types';

const replacementValueSchema = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? undefined : value),
  z.number({ error: 'Nilai penggantian wajib diisi.' }).positive('Nilai penggantian harus lebih besar dari 0.'),
);

const valuationFormSchema = z.object({
  equipment_id: z.string({ error: 'Alat wajib dipilih.' }).min(1, 'Alat wajib dipilih.'),
  replacement_value: replacementValueSchema,
  effective_at: z.string({ error: 'Tanggal mulai berlaku wajib diisi.' }).min(1, 'Tanggal mulai berlaku wajib diisi.'),
  source_url: z.string().url('URL sumber tidak valid').optional().or(z.literal('')),
  notes: z.string().max(1000).optional(),
  change_reason: z.string({ error: 'Alasan perubahan wajib diisi.' }).min(5, 'Alasan perubahan minimal 5 karakter'),
});
type ValuationFormValues = z.infer<typeof valuationFormSchema>;

const createDefaultValues = () => ({
  equipment_id: '',
  replacement_value: undefined,
  effective_at: new Date().toISOString().slice(0, 10),
  source_url: '',
  notes: '',
  change_reason: 'Pembaruan nilai penggantian alat',
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: Equipment[];
  onSubmit: (equipmentId: string, payload: CreateEquipmentValuationPayload, changeReason: string) => Promise<void>;
  isLoading?: boolean;
  error?: unknown;
}

export function EquipmentValuationDialog({ open, onOpenChange, equipment, onSubmit, isLoading, error }: Props) {
  const form = useForm<ValuationFormValues>({
    resolver: zodResolver(valuationFormSchema) as never,
    defaultValues: createDefaultValues(),
  });
  const selectedId = useWatch({ control: form.control, name: 'equipment_id' });
  const valuations = useEquipmentValuationsQuery(selectedId || undefined, open);
  const current = valuations.data?.[0];
  const errorMessage = error ? String(getErrorMessage(error)) : '';

  useEffect(() => {
    if (!selectedId || current?.equipment_id !== selectedId) {
      form.resetField('replacement_value');
      return;
    }

    if (!form.getFieldState('replacement_value').isDirty) {
      form.setValue('replacement_value', current.replacement_value);
    }
  }, [current, form, selectedId]);

  useEffect(() => {
    if (!open) {
      form.reset(createDefaultValues());
    }
  }, [form, open]);

  const handleSubmit = form.handleSubmit(async ({ equipment_id, replacement_value, effective_at, source_url, notes, change_reason }) => {
    await onSubmit(equipment_id, { replacement_value, currency: 'IDR', effective_at, source_url: source_url || undefined, notes: notes || undefined }, change_reason);
    onOpenChange(false);
  });

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-lg bg-surface-1 text-ink">
      <DialogHeader><DialogTitle>Kelola Nilai Penggantian</DialogTitle><DialogDescription>Tambahkan revisi nilai baru. Nilai sebelumnya tetap tersimpan sebagai histori audit dan dipakai untuk tagihan lama.</DialogDescription></DialogHeader>
      <form noValidate onSubmit={handleSubmit} className="space-y-3">
        {Boolean(error) && <div role="alert" className="rounded border border-semantic-danger/30 bg-semantic-danger/10 px-3 py-2 text-xs text-semantic-danger">{errorMessage}</div>}
        <div className="space-y-1"><Label htmlFor="valuation-equipment">Alat *</Label><select id="valuation-equipment" aria-invalid={Boolean(form.formState.errors.equipment_id)} aria-describedby={form.formState.errors.equipment_id ? 'valuation-equipment-error' : undefined} {...form.register('equipment_id')} className="h-9 w-full rounded-md border border-hairline bg-surface-2 px-2 text-sm"><option value="">Pilih alat</option>{equipment.map((item) => <option key={item.id} value={item.id}>{item.kode_alat} - {item.nama_alat}</option>)}</select>{form.formState.errors.equipment_id && <p id="valuation-equipment-error" role="alert" className="text-[10px] text-semantic-danger">{form.formState.errors.equipment_id.message}</p>}</div>
        {selectedId && <div className="rounded-md border border-hairline bg-surface-2 px-3 py-2"><div className="flex items-center justify-between gap-3 text-xs"><span className="text-ink-tertiary">Nilai aktif</span><span className="font-medium text-ink">{current ? formatCurrency(current.replacement_value) : 'Belum ada'}</span></div><p className="mt-1 text-[11px] text-ink-tertiary">Untuk mengubah nilai, masukkan nominal baru lalu simpan sebagai revisi.</p></div>}
        <div className="space-y-1"><Label htmlFor="replacement-value">Nilai penggantian baru (IDR) *</Label><Controller control={form.control} name="replacement_value" render={({ field, fieldState }) => <><FormattedNumberInput id="replacement-value" min="1" step="0.01" required aria-required="true" placeholder="Masukkan nominal" value={field.value} onChange={field.onChange} onBlur={field.onBlur} ref={field.ref} aria-invalid={fieldState.invalid} aria-describedby={fieldState.error ? 'replacement-value-error' : undefined} />{fieldState.error && <p id="replacement-value-error" role="alert" className="text-[10px] text-semantic-danger">{fieldState.error.message}</p>}</>} /></div>
        <div className="space-y-1"><Label htmlFor="effective-at">Berlaku mulai *</Label><Input id="effective-at" type="date" aria-invalid={Boolean(form.formState.errors.effective_at)} aria-describedby={form.formState.errors.effective_at ? 'effective-at-error' : undefined} {...form.register('effective_at')} />{form.formState.errors.effective_at && <p id="effective-at-error" role="alert" className="text-[10px] text-semantic-danger">{form.formState.errors.effective_at.message}</p>}</div>
        <div className="space-y-1"><Label htmlFor="source-url">Sumber harga (opsional)</Label><Input id="source-url" type="url" placeholder="https://..." {...form.register('source_url')} /></div>
        <div className="space-y-1"><Label htmlFor="valuation-notes">Catatan (opsional)</Label><Textarea id="valuation-notes" rows={2} {...form.register('notes')} /></div>
        <div className="space-y-1"><Label htmlFor="valuation-reason">Alasan audit *</Label><Input id="valuation-reason" aria-invalid={Boolean(form.formState.errors.change_reason)} aria-describedby={form.formState.errors.change_reason ? 'valuation-reason-error' : undefined} {...form.register('change_reason')} />{form.formState.errors.change_reason && <p id="valuation-reason-error" role="alert" className="text-[10px] text-semantic-danger">{form.formState.errors.change_reason.message}</p>}</div>
        <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button><Button type="submit" disabled={isLoading}>{isLoading ? 'Menyimpan...' : 'Simpan Revisi'}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
