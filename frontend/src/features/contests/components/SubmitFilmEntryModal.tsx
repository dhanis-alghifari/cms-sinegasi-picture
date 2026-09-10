// src/features/contests/components/SubmitFilmEntryModal.tsx
// Modal for submitting student film entry to a contest / recording achievements

import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Film, Loader2 } from 'lucide-react';

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select';
import { cn } from '@/shared/utils/cn';
import { getErrorMessage } from '@/shared/api/errors';

import { awardStatusEnum, submitFilmEntrySchema, type SubmitFilmEntryFormValues } from '../schemas/contestSchema';
import type { Contest } from '../types/contests.types';

interface StudentOption {
  id: string;
  nama: string;
  kelas: string;
}

interface SubmitFilmEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contest?: Contest | null;
  students: StudentOption[];
  onSubmit: (values: SubmitFilmEntryFormValues) => Promise<void>;
  isLoading?: boolean;
  error?: unknown;
}

export function SubmitFilmEntryModal({
  open,
  onOpenChange,
  contest,
  students,
  onSubmit,
  isLoading,
  error,
}: SubmitFilmEntryModalProps) {
  const form = useForm<SubmitFilmEntryFormValues>({
    resolver: zodResolver(submitFilmEntrySchema),
    defaultValues: {
      contest_id: contest?.id ?? '',
      judul_film: '',
      sutradara_id: '',
      link_video: '',
      award_status: 'Peserta',
      sertifikat_url: '',
    },
  });

  const selectedDirectorId = useWatch({ control: form.control, name: 'sutradara_id' });
  const selectedAwardStatus = useWatch({ control: form.control, name: 'award_status' });
  const selectedDirector = students.find((student) => student.id === selectedDirectorId);

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit({
      ...data,
      contest_id: contest?.id ?? data.contest_id,
    });
    form.reset();
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface-1 border-hairline text-ink max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Film size={18} className="text-primary" />
            <DialogTitle className="text-ink text-base font-semibold">Daftarkan Karya Film &amp; Prestasi</DialogTitle>
          </div>
          <DialogDescription className="text-ink-subtle text-xs">
            Daftarkan karya film pendek siswa ke event <strong className="text-ink">{contest?.nama_lomba}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {Boolean(error) && (
            <div role="alert" className="px-3 py-2 rounded bg-semantic-danger/10 border border-semantic-danger/30 text-semantic-danger text-xs">
              {getErrorMessage(error)}
            </div>
          )}

          {/* Judul Film */}
          <div className="space-y-1">
            <Label htmlFor="judul_film" className="text-ink-muted text-xs">Judul Karya Film *</Label>
            <Input
              id="judul_film"
              placeholder="cth. Jejak di Atas Kanvas / Lentera Malam"
              className={cn('bg-surface-2 border-hairline text-ink text-xs', form.formState.errors.judul_film && 'border-semantic-danger')}
              {...form.register('judul_film')}
            />
            {form.formState.errors.judul_film && (
              <p className="text-semantic-danger text-[10px]">{form.formState.errors.judul_film.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Sutradara */}
            <div className="space-y-1">
              <Label className="text-ink-muted text-xs">Sutradara / Pembuat Karya *</Label>
              <Select
                value={selectedDirectorId}
                onValueChange={(val) => val && form.setValue('sutradara_id', val)}
              >
                <SelectTrigger className="bg-surface-2 border-hairline text-ink text-xs">
                  <SelectValue placeholder="Pilih Sutradara">
                    {selectedDirector ? `${selectedDirector.nama} (${selectedDirector.kelas})` : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-surface-3 border-hairline text-ink">
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nama} ({s.kelas})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Penghargaan */}
            <div className="space-y-1">
              <Label className="text-ink-muted text-xs">Status Prestasi / Penghargaan *</Label>
              <Select
                value={selectedAwardStatus}
                onValueChange={(val) => {
                  const parsedAwardStatus = awardStatusEnum.safeParse(val);
                  if (parsedAwardStatus.success) form.setValue('award_status', parsedAwardStatus.data);
                }}
              >
                <SelectTrigger className="bg-surface-2 border-hairline text-ink text-xs font-semibold">
                  <SelectValue placeholder="Pilih status penghargaan" />
                </SelectTrigger>
                <SelectContent className="bg-surface-3 border-hairline text-ink">
                  <SelectItem value="Juara 1">Juara 1 (Gold Winner)</SelectItem>
                  <SelectItem value="Juara 2">Juara 2 (Silver Winner)</SelectItem>
                  <SelectItem value="Juara 3">Juara 3 (Bronze Winner)</SelectItem>
                  <SelectItem value="Harapan">Juara Harapan</SelectItem>
                  <SelectItem value="Finalis">Finalis Festival</SelectItem>
                  <SelectItem value="Peserta">Peserta (Official Selection)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Link Video & Link Sertifikat */}
          <div className="space-y-1">
            <Label htmlFor="link_video" className="text-ink-muted text-xs">Link Video / Trailer (YouTube / Drive) *</Label>
            <Input
              id="link_video"
              placeholder="https://youtube.com/watch?v=... / https://drive.google.com/..."
              className={cn('bg-surface-2 border-hairline text-ink text-xs', form.formState.errors.link_video && 'border-semantic-danger')}
              {...form.register('link_video')}
            />
            {form.formState.errors.link_video && (
              <p className="text-semantic-danger text-[10px]">{form.formState.errors.link_video.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="sertifikat_url" className="text-ink-muted text-xs">URL Sertifikat / Piagam (Opsional)</Label>
            <Input
              id="sertifikat_url"
              placeholder="https://drive.google.com/file/d/..."
              className="bg-surface-2 border-hairline text-ink text-xs"
              {...form.register('sertifikat_url')}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="bg-surface-2 border-hairline text-ink text-xs h-9">
              Batal
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-primary hover:bg-primary-hover text-primary-foreground text-xs h-9 font-medium">
              {isLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1.5" />
                  Mendaftarkan...
                </>
              ) : (
                'Simpan Karya Film'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
