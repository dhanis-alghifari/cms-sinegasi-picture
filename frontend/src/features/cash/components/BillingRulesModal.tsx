// src/features/cash/components/BillingRulesModal.tsx
// Global Billing Rules Setting Modal (Nominal Iuran Wajib >= 500)

import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Settings, Loader2 } from 'lucide-react';

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
import { cn } from '@/shared/utils/cn';
import { getErrorMessage } from '@/shared/api/errors';
import { FormattedNumberInput } from './FormattedNumberInput';

import { billingRulesSchema, type BillingRulesFormValues } from '../schemas/cashSchema';
import type { BillingRule } from '../types/cash.types';

interface BillingRulesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billingRules?: BillingRule | null;
  onSubmit: (values: BillingRulesFormValues) => Promise<void>;
  isLoading?: boolean;
  error?: unknown;
}

export function BillingRulesModal({
  open,
  onOpenChange,
  billingRules,
  onSubmit,
  isLoading,
  error,
}: BillingRulesModalProps) {
  const form = useForm<BillingRulesFormValues>({
    resolver: zodResolver(billingRulesSchema),
    defaultValues: {
      nominal_iuran_wajib: 5000,
      holiday_start_date: '',
      holiday_end_date: '',
      skip_week: false,
      change_reason: '',
    },
  });

  useEffect(() => {
    if (billingRules) {
      form.reset({
        nominal_iuran_wajib: billingRules.nominal_iuran_wajib,
        holiday_start_date: billingRules.holiday_start_date ?? '',
        holiday_end_date: billingRules.holiday_end_date ?? '',
        skip_week: billingRules.skip_week,
        change_reason: '',
      });
    }
  }, [billingRules, form, open]);

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit(data);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface-1 border-hairline text-ink max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Settings size={18} className="text-primary" />
            <DialogTitle className="text-ink text-base font-semibold">Pengaturan Iuran Wajib (Global)</DialogTitle>
          </div>
          <DialogDescription className="text-ink-subtle text-xs">
            Atur tarif nominal iuran mingguan wajib dan libur semester.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {Boolean(error) && (
            <div role="alert" className="px-3 py-2 rounded bg-semantic-danger/10 border border-semantic-danger/30 text-semantic-danger text-xs">
              {getErrorMessage(error)}
            </div>
          )}

          {/* Nominal Iuran Wajib */}
          <div className="space-y-1">
            <Label htmlFor="nominal_iuran_wajib" className="text-ink-muted text-xs">Nominal Iuran Wajib Mingguan (Rp) *</Label>
            <Controller
              control={form.control}
              name="nominal_iuran_wajib"
              render={({ field }) => (
                <FormattedNumberInput
                  {...field}
                  id="nominal_iuran_wajib"
                  placeholder="5,000"
                  className={cn('bg-surface-2 border-hairline text-ink text-xs h-9 font-mono', form.formState.errors.nominal_iuran_wajib && 'border-semantic-danger')}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? 0)}
                />
              )}
            />
            {form.formState.errors.nominal_iuran_wajib && (
              <p className="text-semantic-danger text-[10px]">{form.formState.errors.nominal_iuran_wajib.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {/* Start Date */}
            <div className="space-y-1">
              <Label htmlFor="holiday_start_date" className="text-ink-muted text-xs">Mulai Libur Semester</Label>
              <Input
                id="holiday_start_date"
                type="date"
                className="bg-surface-2 border-hairline text-ink text-xs h-9"
                {...form.register('holiday_start_date')}
              />
            </div>

            {/* End Date */}
            <div className="space-y-1">
              <Label htmlFor="holiday_end_date" className="text-ink-muted text-xs">Selesai Libur Semester</Label>
              <Input
                id="holiday_end_date"
                type="date"
                className="bg-surface-2 border-hairline text-ink text-xs h-9"
                {...form.register('holiday_end_date')}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 rounded border border-hairline bg-surface-2 px-3 py-2 text-xs text-ink-muted">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              {...form.register('skip_week')}
            />
            Lewati penagihan minggu berikutnya satu kali
          </label>

          {/* Change Reason */}
          <div className="space-y-1 pt-2 border-t border-hairline">
            <Label htmlFor="change_reason" className="text-ink-muted text-xs font-semibold">
              Alasan Perubahan Pengaturan (Audit Header) *
            </Label>
            <Input
              id="change_reason"
              placeholder="cth. Penyesuaian tarif iuran semester baru"
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
            <Button type="submit" disabled={isLoading} className="bg-primary hover:bg-primary-hover text-primary-foreground text-xs h-9 font-medium">
              {isLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1.5" />
                  Menyimpan...
                </>
              ) : (
                'Simpan Pengaturan'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
