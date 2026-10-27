import { useState } from 'react';
import { Download, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/shared/ui/primitives/button';
import { Skeleton } from '@/shared/ui/primitives/skeleton';
import { usePrivateImage } from '@/shared/hooks/usePrivateImage';
import { isLocalImagePreview, isPrivateImageEndpoint } from '@/shared/api/privateMedia';
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

function ImageLoading() {
  return (
    <div role="status" className="flex h-full w-full items-center justify-center">
      <Skeleton className="h-full w-full bg-surface-3" />
      <span className="sr-only">Memuat foto...</span>
    </div>
  );
}

function ImageFailure({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 text-center text-sm text-ink-subtle">
      <p>Foto tidak tersedia atau gagal dimuat. Periksa koneksi Anda.</p>
      <Button type="button" variant="outline" className="min-h-12" onClick={onRetry}>Coba lagi</Button>
    </div>
  );
}

function PreviewImage({ src, alt, zoom, onRetry }: { src: string; alt: string; zoom: number; onRetry: () => void }) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'failed'>('loading');
  if (status === 'failed') return <ImageFailure onRetry={onRetry} />;
  return (
    <>
      {status === 'loading' && <ImageLoading />}
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        className={`max-h-full max-w-full select-none object-contain transition-transform duration-150 ${status === 'loading' ? 'absolute opacity-0' : ''}`}
        style={{ transform: `scale(${zoom})` }}
        draggable={false}
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('failed')}
      />
    </>
  );
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
  const [attempt, setAttempt] = useState(0);
  const privateImage = usePrivateImage(src, open);
  // Only local user-selected previews may bypass authenticated API fetching.
  const previewSrc = open && src && isLocalImagePreview(src) ? src : privateImage.src;
  const canLoad = Boolean(src && (isPrivateImageEndpoint(src) || isLocalImagePreview(src)));
  const retry = () => { setAttempt((value) => value + 1); privateImage.retry(); };

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

        <div className="relative flex h-[min(58dvh,32rem)] min-h-48 items-center justify-center overflow-auto rounded-lg border border-hairline bg-surface-2 p-3">
          {previewSrc && <PreviewImage key={`${previewSrc}:${attempt}`} src={previewSrc} alt={alt} zoom={zoom} onRetry={retry} />}
          {!previewSrc && privateImage.failed && <ImageFailure onRetry={retry} />}
          {!previewSrc && !privateImage.failed && canLoad && open && <ImageLoading />}
          {!previewSrc && !privateImage.failed && (!canLoad || !open) && (
            <p role="status" className="text-center text-sm text-ink-subtle">
              Foto belum tersedia.
            </p>
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
          <DialogClose render={<Button type="button" variant="secondary" className="min-h-11 w-full sm:w-auto" />}>Tutup</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
