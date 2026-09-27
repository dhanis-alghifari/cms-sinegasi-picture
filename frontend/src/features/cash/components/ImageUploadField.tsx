import { useState } from 'react';
import { Image as ImageIcon, X } from 'lucide-react';

import { Button } from '@/shared/ui/primitives/button';
import { FieldError } from '@/shared/ui/FieldError';
import { Input } from '@/shared/ui/primitives/input';
import { Label } from '@/shared/ui/primitives/label';
import { cn } from '@/shared/utils/cn';
import { getErrorMessage } from '@/shared/api/errors';
import { compressImageFile, MAX_SOURCE_IMAGE_BYTES } from '@/shared/utils/compressImage';
import { PhotoSourcePicker } from '@/shared/ui/PhotoSourcePicker';

interface ImageUploadFieldProps {
  field: {
    id: string;
    label: string;
    value?: string;
    onChange: (value: string) => void;
  };
  validation?: {
    error?: string;
    required?: boolean;
  };
  state?: {
    disabled?: boolean;
    onProcessingChange?: (isProcessing: boolean) => void;
  };
}

export function ImageUploadField({
  field,
  validation,
  state,
}: ImageUploadFieldProps) {
  const { id, label, value, onChange } = field;
  const { error, required } = validation ?? {};
  const { disabled, onProcessingChange } = state ?? {};
  const [isProcessing, setIsProcessing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const setProcessing = (next: boolean) => {
    setIsProcessing(next);
    onProcessingChange?.(next);
  };

  const handleFilesSelected = async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    const mimeType = file.type.toLowerCase();
    if (!mimeType.startsWith('image/') || mimeType === 'image/svg+xml') {
      setLocalError('Pilih file foto yang didukung perangkat.');
      return;
    }
    if (file.size < 1 || file.size > MAX_SOURCE_IMAGE_BYTES) {
      setLocalError('Ukuran foto sumber maksimal 5 MB.');
      return;
    }

    setLocalError(null);
    setProcessing(true);
    try {
      onChange(await compressImageFile(file));
    } catch (err) {
      setLocalError(getErrorMessage(err));
    } finally {
      setProcessing(false);
    }
  };

  const handleRemove = () => {
    onChange('');
    setLocalError(null);
  };

  return (
    <div className="space-y-1">
      <Label htmlFor={`${id}-photo`} className="text-ink-muted text-xs font-medium">
        {label} {required && '*'}
      </Label>
      <div className="flex items-center gap-3 rounded-md border border-dashed border-hairline bg-surface-2 p-3">
        {value ? (
          <img src={value} alt="Preview bukti" className="h-16 w-16 rounded object-cover border border-hairline" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded border border-hairline text-ink-tertiary">
            <ImageIcon size={22} />
          </div>
        )}
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <PhotoSourcePicker
            id={`${id}-photo`}
            accept="image/*"
            disabled={disabled || isProcessing}
            onFilesSelected={handleFilesSelected}
            galleryLabel={isProcessing ? 'Memproses...' : 'Pilih dari Galeri'}
            aria-invalid={Boolean(error || localError)}
            aria-describedby={error || localError ? `${id}-error` : undefined}
            buttonClassName="w-full bg-surface-1 border-hairline text-ink text-xs md:w-auto"
            className="w-full"
          />
          {value && (
            <Button type="button" variant="ghost" onClick={handleRemove} disabled={disabled || isProcessing} className="min-h-12 h-auto w-full text-semantic-danger text-xs md:min-h-0 md:h-9 md:w-auto">
              <X size={14} className="mr-1" />
              Hapus
            </Button>
          )}
          <span className="basis-full text-[10px] text-ink-tertiary">Pilih foto dari galeri atau ambil langsung dengan kamera. Maksimal 5 MB.</span>
        </div>
      </div>
      <Input
        id={id}
        type="text"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Atau masukkan URL foto https://..."
        disabled={disabled || isProcessing}
        aria-invalid={Boolean(error || localError)}
        aria-describedby={error || localError ? `${id}-error` : undefined}
        className={cn('bg-surface-2 border-hairline text-ink text-xs', (error || localError) && 'border-semantic-danger')}
      />
      <FieldError id={`${id}-error`} message={localError || error} />
    </div>
  );
}
