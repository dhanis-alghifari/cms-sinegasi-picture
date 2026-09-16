
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trophy, Loader2 } from 'lucide-react';

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
import { RadioGroup } from '@/shared/ui/primitives/radio-group';
import { Textarea } from '@/shared/ui/primitives/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select';
import { cn } from '@/shared/utils/cn';
import { getErrorMessage } from '@/shared/api/errors';

import { contestEditSchema, contestSchema, type ContestFormValues } from '../schemas/contestSchema';
import type { Contest } from '../types/contests.types';
import { getFutureDateInputValue } from '@/shared/utils/formatDate';
import {
  CONTEST_SCOPE_OPTIONS,
  CONTEST_STATUS_OPTIONS,
  isContestScope,
  isContestStatus,
  normalizeContestScope,
} from '../utils/contestLabels';

interface CreateContestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contest?: Contest | null;
  onSubmit: (formValues: ContestFormValues) => Promise<void>;
  isLoading?: boolean;
  error?: unknown;
}

export function CreateContestModal({
  open,
  onOpenChange,
  contest,
  onSubmit,
  isLoading,
  error,
}: CreateContestModalProps) {
  const isEditingContest = Boolean(contest);

  const form = useForm<ContestFormValues>({
    resolver: zodResolver(isEditingContest ? contestEditSchema : contestSchema),
    defaultValues: {
      nama_lomba: '',
      kota: '',
      tingkat: 'nasional',
      deadline: getFutureDateInputValue(1),
      status: 'buka',
      tahun_event: new Date().getFullYear(),
      website_url: '',
      deskripsi: '',
      change_reason: '',
    },
  });

  const selectedContestScope = useWatch({ control: form.control, name: 'tingkat' });
  const selectedContestStatus = useWatch({ control: form.control, name: 'status' });

  const handleContestScopeValueChange = (value: string | null) => {
    if (value === null) return;
    if (!isContestScope(value)) return;
    form.setValue('tingkat', value, { shouldDirty: true, shouldValidate: true });
  };

  const handleContestStatusValueChange = (value: string | null) => {
    if (value === null) return;
    if (!isContestStatus(value)) return;
    form.setValue('status', value, { shouldDirty: true, shouldValidate: true });
  };

  useEffect(() => {
    if (contest) {
      form.reset({
        nama_lomba: contest.nama_lomba,
        kota: contest.kota ?? '',
        tingkat: normalizeContestScope(contest.tingkat) ?? 'nasional',
        deadline: contest.deadline,
        status: contest.status_public ?? (contest.status === 'selesai' ? 'selesai' : 'proses_penjurian'),
        tahun_event: contest.tahun_event ?? new Date().getFullYear(),
        website_url: contest.website_url ?? '',
        deskripsi: contest.deskripsi ?? '',
        change_reason: '',
      });
    } else {
      form.reset({
        nama_lomba: '',
        kota: '',
        tingkat: 'nasional',
        deadline: getFutureDateInputValue(1),
        status: 'buka',
        tahun_event: new Date().getFullYear(),
        website_url: '',
        deskripsi: '',
        change_reason: '',
      });
    }
  }, [contest, form, open]);

  const handleContestFormSubmit = form.handleSubmit(async (formValues) => {
    if (isEditingContest && (!formValues.change_reason || formValues.change_reason.trim().length < 5)) {
      form.setError('change_reason', { message: 'Alasan perubahan wajib diisi (minimal 5 karakter)' });
      return;
    }
    await onSubmit(formValues);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92dvh,760px)] w-[calc(100%-1rem)] max-w-2xl flex-col gap-3 overflow-hidden border-hairline bg-surface-1 p-3 text-ink sm:w-[calc(100%-2rem)] sm:gap-4 sm:p-4">
        <DialogHeader className="shrink-0 pr-8">
          <div className="mb-1 flex min-w-0 items-start gap-2">
            <Trophy size={18} className="text-semantic-warning" />
            <DialogTitle className="min-w-0 text-ink text-base font-semibold leading-snug">
              {isEditingContest ? 'Edit Event Perlombaan' : 'Tambah Event Festival / Perlombaan'}
            </DialogTitle>
          </div>

          <DialogDescription className="text-ink-subtle text-xs">
            {isEditingContest
              ? 'Perbarui informasi festival film atau status penjurian.'
              : 'Daftarkan event yang dapat menerima karya film, foto, animasi, atau media lain.'}
          </DialogDescription>
        </DialogHeader>

        <form noValidate onSubmit={handleContestFormSubmit} className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden overflow-y-auto overscroll-contain px-0.5 pb-1 pt-1 pr-1 sm:gap-5">
          {Boolean(error) && (
            <div role="alert" className="shrink-0 rounded border border-semantic-danger/30 bg-semantic-danger/10 px-3 py-2 text-xs text-semantic-danger">
              {getErrorMessage(error)}
            </div>
          )}

          <section className="w-full min-w-0 shrink-0 space-y-3 rounded-lg border border-hairline bg-surface-2/40 p-3 sm:p-4">
            <div>
              <p className="text-xs font-semibold text-ink">Informasi event</p>
              <p className="mt-0.5 text-[11px] text-ink-tertiary">Data utama festival atau perlombaan yang akan ditampilkan di direktori.</p>
            </div>
            {/* Nama Lomba */}
            <div className="space-y-1">
            <Label htmlFor="nama_lomba" className="text-xs text-ink-muted">Nama Festival / Lomba <span className="text-semantic-danger" aria-hidden="true">*</span></Label>
            <Input
              id="nama_lomba"
              placeholder="cth. Festival Film Pelajar Indonesia 2026 / FLS2N Film Pendek"
              className={cn('bg-surface-2 border-hairline text-ink text-xs', form.formState.errors.nama_lomba && 'border-semantic-danger')}
              {...form.register('nama_lomba')}
            />
            {form.formState.errors.nama_lomba && (
              <p className="text-semantic-danger text-[10px]">{form.formState.errors.nama_lomba.message}</p>
            )}
            </div>

            {/* Kota */}
            <div className="space-y-1">
              <Label htmlFor="kota" className="text-xs text-ink-muted">Kota <span className="text-semantic-danger" aria-hidden="true">*</span></Label>
              <Input id="kota" placeholder="cth. Bekasi" className={cn('bg-surface-2 border-hairline text-ink text-xs', form.formState.errors.kota && 'border-semantic-danger')} {...form.register('kota')} />
              {form.formState.errors.kota && <p className="text-semantic-danger text-[10px]">{form.formState.errors.kota.message}</p>}
            </div>

            {/* Tingkat dan status — dua kolom desktop, satu kolom mobile */}
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="tingkat" className="text-xs text-ink-muted">Tingkat Lomba <span className="text-semantic-danger" aria-hidden="true">*</span></Label>
              <Select
                items={CONTEST_SCOPE_OPTIONS}
                value={selectedContestScope}
                onValueChange={handleContestScopeValueChange}
              >
                <SelectTrigger id="tingkat" className="w-full bg-surface-2 border-hairline text-ink text-xs">
                  <SelectValue placeholder="Pilih tingkat lomba" />
                </SelectTrigger>
                <SelectContent className="bg-surface-3 border-hairline text-ink">
                  {CONTEST_SCOPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <RadioGroup
                name="contest-status"
                legend={<>Status Event <span className="text-semantic-danger" aria-hidden="true">*</span></>}
                value={selectedContestStatus ?? ''}
                options={CONTEST_STATUS_OPTIONS}
                onValueChange={handleContestStatusValueChange}
              />
            </div>
          </div>

          <div className="space-y-1">
              <Label htmlFor="tahun_event" className="text-xs text-ink-muted">Tahun Event <span className="text-semantic-danger" aria-hidden="true">*</span></Label>
              <Input id="tahun_event" type="number" inputMode="numeric" min={1900} max={2200} className={cn('w-full bg-surface-2 border-hairline text-ink text-xs', form.formState.errors.tahun_event && 'border-semantic-danger')} {...form.register('tahun_event', { setValueAs: (value) => value === '' ? undefined : Number(value) })} />
              {form.formState.errors.tahun_event && <p className="text-semantic-danger text-[10px]">{form.formState.errors.tahun_event.message}</p>}
          </div>
          </section>

          <section className="w-full min-w-0 shrink-0 space-y-3 rounded-lg border border-hairline bg-surface-2/40 p-3 sm:p-4">
            <div>
              <p className="text-xs font-semibold text-ink">Pendaftaran</p>
              <p className="mt-0.5 text-[11px] text-ink-tertiary">Deadline tidak boleh hari ini atau tanggal yang sudah lewat.</p>
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="deadline" className="text-xs text-ink-muted">Batas Waktu Pendaftaran <span className="text-semantic-danger" aria-hidden="true">*</span></Label>
              <Input
                id="deadline"
                type="date"
                min={getFutureDateInputValue(1)}
                className="bg-surface-2 border-hairline text-ink text-xs"
                {...form.register('deadline')}
              />
              {form.formState.errors.deadline && <p className="text-semantic-danger text-[10px]">{form.formState.errors.deadline.message}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="website_url" className="text-ink-muted text-xs">Link Website / Form Pendaftaran (Opsional)</Label>
              <Input
                id="website_url"
                placeholder="https://..."
                className="bg-surface-2 border-hairline text-ink text-xs"
                {...form.register('website_url')}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="deskripsi" className="text-xs text-ink-muted">Syarat &amp; Ketentuan <span className="font-normal text-ink-tertiary">(Opsional)</span></Label>
            <Textarea
              id="deskripsi"
              rows={3}
              placeholder="Tema film, durasi maksimal, resolusi video..."
              className="bg-surface-2 border-hairline text-ink text-xs"
              {...form.register('deskripsi')}
            />
          </div>
          </section>

          {/* Change Reason (Zero Silent Edits Requirement — Wajib hanya saat Edit/Ubah Data) */}
          {isEditingContest && (
            <section className="space-y-2 rounded-lg border border-semantic-warning/40 bg-semantic-warning/5 p-3 sm:p-4">
              <div>
                <Label htmlFor="change_reason" className="text-xs font-semibold text-ink">
                  Alasan Perubahan <span className="text-semantic-danger" aria-hidden="true">*</span>
                </Label>
                <p className="mt-1 text-[11px] text-ink-subtle">Wajib untuk mencatat audit perubahan event. Minimal 5 karakter.</p>
              </div>
              <Input
                id="change_reason"
                aria-required="true"
                placeholder="Contoh: Memperbarui deadline pendaftaran"
                className={cn('bg-surface-1 text-xs', form.formState.errors.change_reason && 'border-semantic-danger')}
                {...form.register('change_reason')}
              />
              {form.formState.errors.change_reason && (
                <p className="text-[10px] text-semantic-danger">{form.formState.errors.change_reason.message}</p>
              )}
            </section>
          )}

          <DialogFooter className="sticky bottom-0 -mx-0.5 shrink-0 flex-col-reverse gap-2 border-t border-hairline bg-surface-1/95 pt-3 backdrop-blur sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-10 w-full border-hairline bg-surface-2 text-xs text-ink sm:w-auto">
              Batal
            </Button>
            <Button type="submit" disabled={isLoading} className="h-10 w-full bg-primary text-xs font-medium text-primary-foreground hover:bg-primary-hover sm:w-auto">
              {isLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1.5" />
                  Menyimpan...
                </>
              ) : (
                'Simpan Event Lomba'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
