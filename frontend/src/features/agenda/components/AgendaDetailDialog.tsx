import { useState } from 'react';
import { Eye } from 'lucide-react';

import { ImagePreviewDialog } from '@/shared/ui/ImagePreviewDialog';
import { Button } from '@/shared/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/primitives/dialog';
import { useAgendaPhotoQuery } from '../hooks/useAgendaQueries';
import type { AgendaActivity } from '../types/agenda.types';

interface AgendaDetailDialogProps {
  activity: AgendaActivity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AgendaDetailDialog({ activity, open, onOpenChange }: AgendaDetailDialogProps) {
  const [photoPreviewOpen, setPhotoPreviewOpen] = useState(false);
  const photo = useAgendaPhotoQuery(activity?.id ?? null, open && Boolean(activity?.photo));

  if (!activity) return null;

  const handleDetailOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setPhotoPreviewOpen(false);
    onOpenChange(nextOpen);
  };

  let photoContent = null;
  if (activity.photo && photo.isLoading) {
    photoContent = <div className="h-48 animate-pulse rounded-lg bg-surface-2" aria-label="Memuat foto dokumentasi" />;
  } else if (activity.photo && photo.data) {
    photoContent = (
      <div className="space-y-2">
        <button
          type="button"
          className="block w-full rounded-lg border border-hairline bg-surface-2 p-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onClick={() => setPhotoPreviewOpen(true)}
          aria-label={`Lihat foto dokumentasi ${activity.activity_name}`}
        >
          <img
            src={photo.data}
            alt={`Dokumentasi ${activity.activity_name}`}
            className="max-h-56 w-full rounded-md object-contain"
          />
        </button>
        <Button type="button" variant="outline" onClick={() => setPhotoPreviewOpen(true)}>
          <Eye size={15} className="mr-1.5" aria-hidden="true" />
          Lihat foto
        </Button>
      </div>
    );
  } else if (activity.photo) {
    photoContent = <p className="text-xs text-ink-tertiary">Foto belum dapat dimuat.</p>;
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleDetailOpenChange}>
        <DialogContent className="grid h-[min(85dvh,48rem)] max-h-[85dvh] max-w-lg grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden border-hairline bg-surface-1 p-0 text-ink">
          <DialogHeader className="shrink-0 border-b border-hairline px-4 py-4 pr-11">
            <DialogTitle>{activity.activity_name}</DialogTitle>
            <DialogDescription>
              {activity.activity_date} · Dicatat {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(activity.created_at))}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 space-y-4 overflow-y-auto px-4 py-4 text-sm">
            <p className="whitespace-pre-wrap text-ink-subtle">{activity.activity_description}</p>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-ink-tertiary">Pengajar</dt>
                <dd className="font-medium">{activity.instructor_name}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-tertiary">PIC/BPH</dt>
                <dd className="font-medium">{activity.pic_names.join(', ')}</dd>
              </div>
            </dl>
            {photoContent}
            <p className="text-xs text-ink-tertiary">
              Versi data {activity.version}. Terakhir diubah {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(activity.updated_at))}.
            </p>
          </div>

          <DialogFooter className="shrink-0 border-t border-hairline bg-surface-2/45 px-4 py-3 md:pb-3">
            <Button type="button" variant="outline" onClick={() => handleDetailOpenChange(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImagePreviewDialog
        open={photoPreviewOpen}
        onOpenChange={setPhotoPreviewOpen}
        src={photo.data ?? null}
        alt={`Pratinjau dokumentasi ${activity.activity_name}`}
        title="Foto dokumentasi agenda"
        description={activity.photo?.original_filename}
      />
    </>
  );
}
