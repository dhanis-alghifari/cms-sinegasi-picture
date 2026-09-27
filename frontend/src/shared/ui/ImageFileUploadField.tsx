import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Eye, Image as ImageIcon, Loader2, Upload, X } from 'lucide-react';

import { Button } from '@/shared/ui/primitives/button';
import { FieldError } from '@/shared/ui/FieldError';
import { Label } from '@/shared/ui/primitives/label';
import { ImagePreviewDialog } from './ImagePreviewDialog';

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
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const previewUrl = useMemo(() => (value ? URL.createObjectURL(value) : null), [value]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!SUPPORTED_IMAGE_TYPES.includes(file.type as (typeof SUPPORTED_IMAGE_TYPES)[number])) {
      setLocalError('File harus berupa gambar JPEG, PNG, atau WebP.');
      event.target.value = '';
      return;
    }

    if (file.size < 1 || file.size > maxBytes) {
      setLocalError(`Ukuran foto maksimal ${formatBytes(maxBytes)}.`);
      event.target.value = '';
      return;
    }

    setLocalError(null);
    onChange(file);
  };

  const handleRemove = () => {
    onChange(null);
    setLocalError(null);
    setPreviewOpen(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  let actionLabel = 'Pilih foto';
  if (value) actionLabel = 'Ganti foto';
  if (disabled) actionLabel = 'Memproses...';

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={SUPPORTED_IMAGE_TYPES.join(',')}
        onChange={handleFileChange}
        disabled={disabled}
        className="sr-only"
        aria-invalid={Boolean(localError)}
        aria-describedby={localError ? `${id}-error` : `${id}-help`}
      />

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
                <Button type="button" variant="outline" size="sm" onClick={() => setPreviewOpen(true)} disabled={disabled}>
                  <Eye size={14} className="mr-1.5" />
                  Lihat preview
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={handleRemove} disabled={disabled} className="text-semantic-danger">
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

        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="w-full bg-surface-1 sm:w-auto"
        >
          {disabled ? <Loader2 size={15} className="mr-1.5 animate-spin" /> : <Upload size={15} className="mr-1.5" />}
          {actionLabel}
        </Button>
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
