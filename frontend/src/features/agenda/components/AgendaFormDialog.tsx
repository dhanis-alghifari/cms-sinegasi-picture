import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/primitives/dialog';
import { Button } from '@/shared/ui/primitives/button';
import { Input } from '@/shared/ui/primitives/input';
import { Label } from '@/shared/ui/primitives/label';
import { Textarea } from '@/shared/ui/primitives/textarea';
import { ImageFileUploadField } from '@/shared/ui/ImageFileUploadField';
import { getErrorMessage } from '@/shared/api/errors';
import { agendaSchema } from '../schemas/agendaSchema';
import type { AgendaActivity, AgendaFormValues } from '../types/agenda.types';

interface AgendaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: AgendaActivity | null;
  onSubmit: (values: AgendaFormValues) => Promise<void>;
  isLoading?: boolean;
  error?: unknown;
}

function jakartaToday(): string { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()); }

export function AgendaFormDialog({ open, onOpenChange, initialData, onSubmit, isLoading = false, error }: AgendaFormDialogProps) {
  const [values, setValues] = useState<AgendaFormValues>(() => initialData ? { activity_date: initialData.activity_date, activity_name: initialData.activity_name, activity_description: initialData.activity_description, instructor_name: initialData.instructor_name, pic_names: initialData.pic_names.join(', '), photo: null, change_reason: '' } : { activity_date: jakartaToday(), activity_name: '', activity_description: '', instructor_name: '', pic_names: '', photo: null, change_reason: '' });
  const [formError, setFormError] = useState('');
  const update = (field: keyof AgendaFormValues, value: string | File | null) => setValues((current) => ({ ...current, [field]: value }));
  const submit = async (event: FormEvent) => { event.preventDefault(); setFormError(''); const parsed = agendaSchema.safeParse(values); if (!parsed.success) { setFormError(parsed.error.issues[0]?.message || 'Periksa kembali isian agenda.'); return; } if (values.activity_date > jakartaToday()) { setFormError('Tanggal agenda tidak boleh di masa depan.'); return; } if (initialData && (values.change_reason || '').trim().length < 5) { setFormError('Alasan perubahan minimal 5 karakter.'); return; } try { await onSubmit(values); onOpenChange(false); } catch (submitError) { setFormError(getErrorMessage(submitError)); } };
  const visibleError = formError || (error ? getErrorMessage(error) : '');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid h-[min(90dvh,48rem)] max-h-[90dvh] max-w-lg grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden border-hairline bg-surface-1 p-0 text-ink">
        <DialogHeader className="shrink-0 border-b border-hairline px-4 py-4 pr-11 sm:px-5">
          <DialogTitle>{initialData ? 'Edit agenda kegiatan' : 'Tambah agenda kegiatan'}</DialogTitle>
          <DialogDescription>Catat kegiatan yang sudah berlangsung hari ini atau sebelumnya.</DialogDescription>
        </DialogHeader>

        <form id="agenda-form" noValidate onSubmit={submit} className="flex min-h-0 min-w-0 flex-1 flex-col space-y-4 overflow-hidden overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          <div role="alert" aria-live="polite" className={visibleError ? 'text-xs text-semantic-danger' : 'sr-only'}>
            {visibleError || 'Tidak ada kesalahan.'}
          </div>

          <div className="space-y-1">
            <Label htmlFor="agenda-date">Tanggal kegiatan *</Label>
            <Input id="agenda-date" type="date" max={jakartaToday()} value={values.activity_date} onChange={(event) => update('activity_date', event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="agenda-name">Nama kegiatan *</Label>
            <Input id="agenda-name" value={values.activity_name} onChange={(event) => update('activity_name', event.target.value)} placeholder="Contoh: Latihan produksi film" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="agenda-description">Uraian kegiatan *</Label>
            <Textarea id="agenda-description" rows={4} value={values.activity_description} onChange={(event) => update('activity_description', event.target.value)} placeholder="Apa yang dikerjakan di kelas hari ini?" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="agenda-instructor">Nama pengajar *</Label>
            <Input id="agenda-instructor" value={values.instructor_name} onChange={(event) => update('instructor_name', event.target.value)} placeholder="Nama pengajar atau pembimbing" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="agenda-pic">PIC/BPH *</Label>
            <Input id="agenda-pic" value={values.pic_names} onChange={(event) => update('pic_names', event.target.value)} placeholder="Contoh: Ketua" />
            <p className="text-[11px] text-ink-tertiary">Jika lebih dari satu PIC/BPH, pisahkan dengan koma. Maksimal 10 nama.</p>
          </div>

          {initialData?.photo ? (
            <p className="text-xs text-ink-tertiary">Dokumentasi foto sudah tersimpan. Hapus atau ganti foto belum tersedia dari form ini.</p>
          ) : (
            <ImageFileUploadField
              id="agenda-photo"
              label="Foto dokumentasi (opsional)"
              value={values.photo ?? null}
              onChange={(file) => update('photo', file)}
            />
          )}

          {initialData && (
            <div className="space-y-1">
              <Label htmlFor="agenda-reason">Alasan perubahan *</Label>
              <Input id="agenda-reason" value={values.change_reason} onChange={(event) => update('change_reason', event.target.value)} placeholder="Contoh: Koreksi uraian kegiatan" />
            </div>
          )}

        </form>

        <DialogFooter className="shrink-0 border-t border-hairline bg-surface-2/45 px-4 py-3 sm:px-5 md:pb-3">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} className="sm:min-w-24">Batal</Button>
          <Button form="agenda-form" type="submit" disabled={isLoading} className="sm:min-w-32">
            {isLoading && <Loader2 className="animate-spin" />}
            {isLoading ? 'Menyimpan...' : 'Simpan agenda'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
