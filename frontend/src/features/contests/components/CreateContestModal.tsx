// src/features/contests/components/CreateContestModal.tsx
// Dialog form for creating or editing film contest & festival records

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
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/shared/api/errors';

import { contestSchema, type ContestFormValues } from '../schemas/contestSchema';
import type { Contest, ContestLevel, ContestStatus } from '../types/contests.types';

interface CreateContestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contest?: Contest | null;
  onSubmit: (values: ContestFormValues) => Promise<void>;
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
  const isEditing = Boolean(contest);

  const form = useForm<ContestFormValues>({
    resolver: zodResolver(contestSchema),
    defaultValues: {
      nama_lomba: '',
      penyelenggara: '',
      tingkat: 'Nasional',
      deadline: new Date().toISOString().split('T')[0],
      status: 'buka',
      website_url: '',
      deskripsi: '',
      change_reason: '',
    },
  });

  const selectedLevel = useWatch({ control: form.control, name: 'tingkat' });
  const selectedStatus = useWatch({ control: form.control, name: 'status' });

  useEffect(() => {
    if (contest) {
      form.reset({
        nama_lomba: contest.nama_lomba,
        penyelenggara: contest.penyelenggara,
        tingkat: contest.tingkat,
        deadline: contest.deadline,
        status: contest.status,
        website_url: contest.website_url ?? '',
        deskripsi: contest.deskripsi ?? '',
        change_reason: '',
      });
    } else {
      form.reset({
        nama_lomba: '',
        penyelenggara: '',
        tingkat: 'Nasional',
        deadline: new Date().toISOString().split('T')[0],
        status: 'buka',
        website_url: '',
        deskripsi: '',
        change_reason: '',
      });
    }
  }, [contest, form, open]);

  const handleSubmit = form.handleSubmit(async (data) => {
    if (isEditing && (!data.change_reason || data.change_reason.trim().length < 5)) {
      form.setError('change_reason', { message: 'Alasan perubahan wajib diisi (minimal 5 karakter)' });
      return;
    }
    await onSubmit(data);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface-1 border-hairline text-ink max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Trophy size={18} className="text-semantic-warning" />
            <DialogTitle className="text-ink text-base font-semibold">
              {isEditing ? 'Edit Event Lomba Film' : 'Tambah Event Festival / Lomba Film'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-ink-subtle text-xs">
            {isEditing
              ? 'Perbarui informasi festival film atau status penjurian.'
              : 'Daftarkan perlombaan atau festival film pendek baru.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {Boolean(error) && (
            <div role="alert" className="px-3 py-2 rounded bg-semantic-danger/10 border border-semantic-danger/30 text-semantic-danger text-xs">
              {getErrorMessage(error)}
            </div>
          )}

          {/* Nama Lomba */}
          <div className="space-y-1">
            <Label htmlFor="nama_lomba" className="text-ink-muted text-xs">Nama Festival / Lomba *</Label>
            <Input
              id="nama_lomba"
              placeholder="cth. Festival Film Pelajar Indonesia 2026 / FLS2N Film Pendek"
              className={cn('bg-surface-2 border-hairline text-ink text-xs h-9', form.formState.errors.nama_lomba && 'border-semantic-danger')}
              {...form.register('nama_lomba')}
            />
            {form.formState.errors.nama_lomba && (
              <p className="text-semantic-danger text-[10px]">{form.formState.errors.nama_lomba.message}</p>
            )}
          </div>

          {/* Penyelenggara */}
          <div className="space-y-1">
            <Label htmlFor="penyelenggara" className="text-ink-muted text-xs">Instansi Penyelenggara *</Label>
            <Input
              id="penyelenggara"
              placeholder="cth. Kemendikbudristek / ISI Yogyakarta / XXI Short Film Festival"
              className={cn('bg-surface-2 border-hairline text-ink text-xs h-9', form.formState.errors.penyelenggara && 'border-semantic-danger')}
              {...form.register('penyelenggara')}
            />
            {form.formState.errors.penyelenggara && (
              <p className="text-semantic-danger text-[10px]">{form.formState.errors.penyelenggara.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Tingkat */}
            <div className="space-y-1">
              <Label className="text-ink-muted text-xs">Tingkat Lomba *</Label>
              <Select
                value={selectedLevel}
                onValueChange={(val) => val && form.setValue('tingkat', val as ContestLevel)}
              >
                <SelectTrigger className="bg-surface-2 border-hairline text-ink text-xs h-9">
                  <SelectValue placeholder="Pilih tingkat lomba" />
                </SelectTrigger>
                <SelectContent className="bg-surface-3 border-hairline text-ink">
                  <SelectItem value="Lokal">Lokal</SelectItem>
                  <SelectItem value="Regional">Regional</SelectItem>
                  <SelectItem value="Nasional">Nasional</SelectItem>
                  <SelectItem value="Internasional">Internasional</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status Event */}
            <div className="space-y-1">
              <Label className="text-ink-muted text-xs">Status Event *</Label>
              <Select
                value={selectedStatus}
                onValueChange={(val) => val && form.setValue('status', val as ContestStatus)}
              >
                <SelectTrigger className="bg-surface-2 border-hairline text-ink text-xs h-9">
                  <SelectValue placeholder="Pilih status event" />
                </SelectTrigger>
                <SelectContent className="bg-surface-3 border-hairline text-ink">
                  <SelectItem value="buka">Buka Pendaftaran</SelectItem>
                  <SelectItem value="proses_penjurian">Proses Penjurian</SelectItem>
                  <SelectItem value="selesai">Selesai</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Deadline & Website */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="deadline" className="text-ink-muted text-xs">Deadline Pendaftaran *</Label>
              <Input
                id="deadline"
                type="date"
                className="bg-surface-2 border-hairline text-ink text-xs h-9"
                {...form.register('deadline')}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="website_url" className="text-ink-muted text-xs">Link Website / Panduan</Label>
              <Input
                id="website_url"
                placeholder="https://..."
                className="bg-surface-2 border-hairline text-ink text-xs h-9"
                {...form.register('website_url')}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="deskripsi" className="text-ink-muted text-xs">Syarat &amp; Ketentuan (Opsional)</Label>
            <Textarea
              id="deskripsi"
              rows={2}
              placeholder="Tema film, durasi maksimal, resolusi video..."
              className="bg-surface-2 border-hairline text-ink text-xs"
              {...form.register('deskripsi')}
            />
          </div>

          {/* Change Reason (Zero Silent Edits Requirement — Wajib hanya saat Edit/Ubah Data) */}
          {isEditing && (
            <div className="space-y-1 pt-2 border-t border-hairline">
              <Label htmlFor="change_reason" className="text-ink-muted text-xs font-semibold">
                Alasan Perubahan (Audit Header) *
              </Label>
              <Input
                id="change_reason"
                placeholder="cth. Perubahan deadline pendaftaran / update status event"
                className={cn('bg-surface-2 border-hairline text-ink text-xs h-9', form.formState.errors.change_reason && 'border-semantic-danger')}
                {...form.register('change_reason')}
              />
              {form.formState.errors.change_reason && (
                <p className="text-semantic-danger text-[10px]">{form.formState.errors.change_reason.message}</p>
              )}
            </div>
          )}

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
                'Simpan Event Lomba'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
