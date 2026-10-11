import { useState } from 'react';
import { Image as ImageIcon, Plus, X } from 'lucide-react';

import { Button } from '@/shared/ui/primitives/button';
import { FieldError } from '@/shared/ui/FieldError';
import { Input } from '@/shared/ui/primitives/input';
import { Label } from '@/shared/ui/primitives/label';
import { cn } from '@/shared/utils/cn';
import { getErrorMessage } from '@/shared/api/errors';
import { compressImageFile, MAX_SOURCE_IMAGE_BYTES } from '@/shared/utils/compressImage';
import { formatNumber } from '@/shared/utils/formatNumber';
import { PhotoSourcePicker } from '@/shared/ui/PhotoSourcePicker';

interface MultiImageUploadFieldProps {
  field: {
    id: string;
    label: string;
    values?: string[];
    onChange: (values: string[]) => void;
  };
  validation?: {
    error?: string;
    required?: boolean;
    minFiles?: number;
  };
  state?: {
    disabled?: boolean;
    onProcessingChange?: (isProcessing: boolean) => void;
  };
}

function isSupportedImageUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:image/');
}

export function MultiImageUploadField({
  field,
  validation,
  state,
}: MultiImageUploadFieldProps) {
  const {
    id,
    label,
    values = [],
    onChange,
  } = field;
  const { error, required, minFiles = 3 } = validation ?? {};
  const { disabled, onProcessingChange } = state ?? {};
  const [isProcessing, setIsProcessing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [urlValue, setUrlValue] = useState('');

  const setProcessing = (next: boolean) => {
    setIsProcessing(next);
    onProcessingChange?.(next);
  };

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;

    const invalidType = files.find(
      (file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type),
    );
    if (invalidType) {
      setLocalError('Semua file harus berupa gambar JPEG, PNG, atau WebP.');
      return;
    }

    const oversized = files.find((file) => file.size < 1 || file.size > MAX_SOURCE_IMAGE_BYTES);
    if (oversized) {
      setLocalError('Ukuran setiap foto sumber maksimal 5 MB.');
      return;
    }

    setLocalError(null);
    setProcessing(true);
    try {
      const compressed = await Promise.all(files.map((file) => compressImageFile(file)));
      onChange([...values, ...compressed]);
    } catch (err) {
      setLocalError(getErrorMessage(err));
    } finally {
      setProcessing(false);
    }
  };

  const handleAddUrl = () => {
    const nextUrl = urlValue.trim();
    if (!nextUrl) return;
    if (!isSupportedImageUrl(nextUrl)) {
      setLocalError('URL foto harus berupa http(s) atau data:image yang valid.');
      return;
    }

    setLocalError(null);
    onChange([...values, nextUrl]);
    setUrlValue('');
  };

  const handleRemove = (index: number) => {
    onChange(values.filter((_, valueIndex) => valueIndex !== index));
    setLocalError(null);
  };

  const hasError = Boolean(error || localError);

  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-ink-muted text-xs font-medium">
        {label} {required && '*'}
      </Label>
      <div className={cn('rounded-md border border-dashed bg-surface-2 p-3', hasError ? 'border-semantic-danger' : 'border-hairline')}>
        {values.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {values.map((value, index) => (
              <div key={`${value.slice(0, 32)}-${index}`} className="relative aspect-square overflow-hidden rounded border border-hairline bg-surface-1">
                <img src={value} alt={`${label} ${index + 1}`} className="h-full w-full object-cover" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(index)}
                  disabled={disabled || isProcessing}
                  aria-label={`Hapus foto ${index + 1}`}
                  className="absolute right-1 top-1 h-6 w-6 bg-black/60 text-white hover:bg-semantic-danger"
                >
                  <X size={13} />
                </Button>
                <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                  {index + 1}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 py-2 text-ink-tertiary">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded border border-hairline">
              <ImageIcon size={22} />
            </div>
            <span className="text-xs">Belum ada foto. Unggah minimal {minFiles} sudut alat.</span>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <PhotoSourcePicker
            id={id}
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={disabled || isProcessing}
            onFilesSelected={handleFilesSelected}
            galleryLabel={isProcessing ? 'Memproses...' : 'Pilih dari Galeri'}
            aria-invalid={hasError}
            aria-describedby={hasError ? `${id}-error` : undefined}
            buttonClassName="border-hairline bg-surface-1 text-ink text-xs"
          />
          <span className="text-[10px] text-ink-tertiary">Bisa pilih beberapa file sekaligus.</span>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <Input
            value={urlValue}
            onChange={(event) => setUrlValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleAddUrl();
              }
            }}
            placeholder="Atau tempel URL foto https://..."
            disabled={disabled || isProcessing}
            density="compact"
            className="flex-1 border-hairline bg-surface-1 text-ink text-xs"
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleAddUrl}
            disabled={disabled || isProcessing || !urlValue.trim()}
            size="sm"
            className="border-hairline bg-surface-1 text-ink text-xs"
          >
            <Plus size={14} className="mr-1" />
            Tambah URL
          </Button>
        </div>

        <p className="mt-2 text-[10px] text-ink-tertiary">
          Foto {formatNumber(values.length)}/{formatNumber(minFiles)} minimum • Disarankan depan, samping, dan atas/belakang.
        </p>
      </div>
      <FieldError id={`${id}-error`} message={localError || error} />
    </div>
  );
}
