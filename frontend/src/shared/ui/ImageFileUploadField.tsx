import { useEffect, useMemo, useState } from 'react';
import { Eye, Image as ImageIcon, X } from 'lucide-react';

import { getErrorMessage } from '@/shared/api/errors';
import { compressImageFileToFile, MAX_SOURCE_IMAGE_BYTES } from '@/shared/utils/compressImage';
import { Button } from '@/shared/ui/primitives/button';
import { FieldError } from '@/shared/ui/FieldError';
import { Label } from '@/shared/ui/primitives/label';
import { ImagePreviewDialog } from './ImagePreviewDialog';
import { PhotoSourcePicker } from './PhotoSourcePicker';

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const DEFAULT_MAX_BYTES = 614_400;

interface ImageFileUploadFieldProps {
  id: string;
  label: string;
  value: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
  maxBytes?: number;
  helperText?: string;
}

function formatBytes(bytes: number): string {
  return `${Math.round(bytes / 1024)} KB`;
}

export function ImageFileUploadField({
  id,
  label,
  value,
  onChange,
  disabled = false,
  maxBytes = DEFAULT_MAX_BYTES,
  helperText = `JPEG, PNG, atau WebP maksimal ${formatBytes(DEFAULT_MAX_BYTES)}.`,
}: ImageFileUploadFieldProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const previewUrl = useMemo(() => (value ? URL.createObjectURL(value) : null), [value]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFilesSelected = async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    if (!SUPPORTED_IMAGE_TYPES.includes(file.type as (typeof SUPPORTED_IMAGE_TYPES)[number])) {
      setLocalError('File harus berupa gambar JPEG, PNG, atau WebP.');
      return;
    }

    if (file.size < 1 || file.size > MAX_SOURCE_IMAGE_BYTES) {
      setLocalError('Ukuran foto sumber maksimal 5 MB.');
      return;
    }

    setLocalError(null);
    setIsProcessing(true);
    try {
      const compressedFile = await compressImageFileToFile(file);
      if (compressedFile.size > maxBytes) {
        setLocalError(`Foto tidak dapat diperkecil hingga ${formatBytes(maxBytes)}.`);
        return;
      }
      onChange(compressedFile);
    } catch (error) {
      setLocalError(getErrorMessage(error));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemove = () => {
    onChange(null);
    setLocalError(null);
    setPreviewOpen(false);
  };

  let actionLabel = 'Pilih foto';
  if (value) actionLabel = 'Ganti foto';
  if (disabled || isProcessing) actionLabel = 'Memproses...';

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="space-y-3 rounded-lg border border-dashed border-hairline bg-surface-2 p-3">
        {value && previewUrl ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="h-20 w-20 shrink-0 overflow-hidden rounded-md border border-hairline bg-surface-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-success"
              onClick={() => setPreviewOpen(true)}
              aria-label="Buka pratinjau foto dokumentasi"
            >
              <img src={previewUrl} alt="Pratinjau foto dokumentasi" className="h-full w-full object-cover" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-ink">{value.name}</p>
              <p className="mt-1 text-[11px] text-ink-tertiary">{formatBytes(value.size)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setPreviewOpen(true)} disabled={disabled || isProcessing}>
                  <Eye size={14} className="mr-1.5" />
                  Lihat preview
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={handleRemove} disabled={disabled || isProcessing} className="min-h-11 text-semantic-danger">
                  <X size={14} className="mr-1.5" />
                  Hapus
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-ink-tertiary">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-1">
              <ImageIcon size={22} aria-hidden="true" />
            </div>
            <p className="text-xs">Belum ada foto dokumentasi.</p>
          </div>
        )}

        <PhotoSourcePicker
          id={id}
          accept={SUPPORTED_IMAGE_TYPES.join(',')}
          disabled={disabled || isProcessing}
          onFilesSelected={handleFilesSelected}
          galleryLabel={actionLabel}
          cameraLabel={value ? 'Ambil foto baru' : 'Ambil foto'}
          className="w-full sm:w-auto"
          buttonClassName="flex-1 bg-surface-1 sm:flex-none"
          aria-invalid={Boolean(localError)}
          aria-describedby={localError ? `${id}-error` : `${id}-help`}
        />
      </div>

      <p id={`${id}-help`} className="text-[11px] text-ink-tertiary">{helperText}</p>
      <FieldError id={`${id}-error`} message={localError} />

      <ImagePreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        src={previewUrl}
        alt="Pratinjau foto dokumentasi agenda"
        title="Pratinjau foto dokumentasi"
        description={value?.name}
      />
    </div>
  );
}
