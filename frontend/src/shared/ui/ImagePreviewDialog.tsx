import { useState } from 'react';
import { Download, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/shared/ui/primitives/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/primitives/dialog';

interface ImagePreviewDownload {
  onDownload: () => void | Promise<void>;
  isLoading?: boolean;
  hasError?: boolean;
  label?: string;
  loadingLabel?: string;
  errorMessage?: string;
}

interface ImagePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string | null;
  alt: string;
  title: string;
  description?: string;
  download?: ImagePreviewDownload;
}

export function ImagePreviewDialog({
  open,
  onOpenChange,
  src,
  alt,
  title,
  description,
  download,
}: ImagePreviewDialogProps) {
  const [zoom, setZoom] = useState(1);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setZoom(1);
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl gap-3 border-hairline bg-surface-1 p-4 text-ink sm:p-5">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-ink">{title}</DialogTitle>
          {description && <DialogDescription className="truncate text-ink-subtle">{description}</DialogDescription>}
        </DialogHeader>

        <div className="flex h-[min(58dvh,32rem)] min-h-48 items-center justify-center overflow-auto rounded-lg border border-hairline bg-surface-2 p-3">
          {src && (
            <img
              src={src}
              alt={alt}
              referrerPolicy="no-referrer"
              className="max-h-full max-w-full select-none object-contain transition-transform duration-150"
              style={{ transform: `scale(${zoom})` }}
              draggable={false}
            />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2" aria-label="Kontrol pratinjau foto">
          <Button type="button" size="icon-sm" variant="outline" aria-label="Perkecil foto" disabled={zoom <= 0.75} onClick={() => setZoom((value) => Math.max(0.75, Number((value - 0.25).toFixed(2))))}>
            <ZoomOut size={15} />
          </Button>
          <span className="min-w-14 text-center text-xs font-medium text-ink-subtle" aria-live="polite">{Math.round(zoom * 100)}%</span>
          <Button type="button" size="icon-sm" variant="outline" aria-label="Perbesar foto" disabled={zoom >= 3} onClick={() => setZoom((value) => Math.min(3, Number((value + 0.25).toFixed(2))))}>
            <ZoomIn size={15} />
          </Button>
          <Button type="button" size="icon-sm" variant="ghost" aria-label="Atur ulang ukuran foto" disabled={zoom === 1} onClick={() => setZoom(1)}>
            <RotateCcw size={15} />
          </Button>
        </div>

        {download?.hasError && <p role="alert" className="text-center text-xs text-semantic-danger">{download.errorMessage || 'Download langsung tidak tersedia. Simpan gambar melalui browser.'}</p>}

        <DialogFooter className="gap-2 border-t border-hairline bg-transparent pt-3 sm:flex-row sm:items-center sm:justify-end">
          {download && (
            <Button type="button" className="min-h-11 w-full sm:w-auto" disabled={download.isLoading} onClick={() => void download.onDownload()}>
              <Download size={14} className="mr-1" />
              {download.isLoading ? (download.loadingLabel || 'Menyiapkan...') : (download.label || 'Download')}
            </Button>
          )}
          <DialogClose render={<Button type="button" variant="outline" className="min-h-11 w-full border-hairline bg-surface-2 text-ink sm:w-auto" />}>Tutup</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
