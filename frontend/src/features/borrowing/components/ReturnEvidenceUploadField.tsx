import { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, Loader2, Upload, X } from 'lucide-react';

import { getErrorMessage } from '@/shared/api/errors';
import { Button } from '@/shared/ui/primitives/button';
import { FieldError } from '@/shared/ui/FieldError';
import { Label } from '@/shared/ui/primitives/label';
import { cn } from '@/shared/utils/cn';
import { compressImageFileToFile, MAX_COMPRESSED_IMAGE_BYTES, MAX_SOURCE_IMAGE_BYTES } from '@/shared/utils/compressImage';
import { formatNumber } from '@/shared/utils/formatNumber';

interface ReturnEvidenceUploadFieldProps {
  field: {
    id: string;
    label: string;
    values: File[];
    onChange: (values: File[]) => void;
  };
  validation?: {
    error?: string;
    required?: boolean;
    minFiles?: number;
    maxFiles?: number;
  };
  state?: {
    disabled?: boolean;
    onProcessingChange?: (isProcessing: boolean) => void;
  };
}

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function ReturnEvidenceUploadField({
  field,
  validation,
  state,
}: ReturnEvidenceUploadFieldProps) {
  const { id, label, values, onChange } = field;
  const {
    error,
    required,
    minFiles = 2,
    maxFiles = 5,
  } = validation ?? {};
  const { disabled, onProcessingChange } = state ?? {};
  const inputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const setProcessing = (next: boolean) => {
    setIsProcessing(next);
    onProcessingChange?.(next);
  };
  const previews = useMemo(
    () => values.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [values],
  );

  useEffect(() => () => previews.forEach(({ url }) => URL.revokeObjectURL(url)), [previews]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;
    if (values.length + files.length > maxFiles) {
      setLocalError(`Maksimal ${maxFiles} foto untuk ${label.toLowerCase()}.`);
      return;
    }
    const invalidFile = files.find((file) => !ALLOWED_TYPES.has(file.type) || file.size < 1 || file.size > MAX_SOURCE_IMAGE_BYTES);
    if (invalidFile) {
      setLocalError('Foto harus berupa JPG, PNG, atau WebP dengan ukuran sumber maksimal 5 MB.');
      return;
    }

    setProcessing(true);
    setLocalError(null);
    try {
      const compressedFiles = await Promise.all(files.map((file) => compressImageFileToFile(file)));
      if (compressedFiles.some((file) => file.size > MAX_COMPRESSED_IMAGE_BYTES)) {
        throw new Error('Foto terlalu besar untuk diproses. Pilih foto lain.');
      }
      onChange([...values, ...compressedFiles]);
    } catch (processingError) {
      setLocalError(getErrorMessage(processingError));
    } finally {
      setProcessing(false);
    }
  };

  const removeFile = (index: number) => {
    onChange(values.filter((_, candidateIndex) => candidateIndex !== index));
    setLocalError(null);
  };

  const hasError = Boolean(error || localError);
  const emptyStateLabel = required
    ? `Belum ada foto. Tambahkan minimal ${minFiles} foto.`
    : 'Belum ada foto. Tambahkan bila diperlukan.';

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[10px] text-ink-muted">
        {label} {required && <span className="text-semantic-danger">*</span>}
      </Label>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        aria-required={required}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${id}-error` : undefined}
        onChange={handleFileChange}
        disabled={disabled || isProcessing || values.length >= maxFiles}
        className="sr-only"
      />
      <div className={cn('rounded-md border border-dashed bg-surface-2 p-2.5', hasError ? 'border-semantic-danger' : 'border-hairline')}>
        {previews.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {previews.map(({ file, url }, index) => (
              <div key={`${file.name}-${file.lastModified}-${index}`} className="relative aspect-square overflow-hidden rounded border border-hairline bg-surface-1">
                <img src={url} alt={`${label} ${index + 1}`} className="h-full w-full object-cover" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(index)}
                  disabled={disabled || isProcessing}
                  aria-label={`Hapus foto ${index + 1}`}
                  className="absolute right-1 top-1 h-7 w-7 bg-black/60 text-white hover:bg-semantic-danger"
                >
                  <X size={13} />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 py-2 text-ink-tertiary">
            <ImagePlus size={20} aria-hidden="true" />
            <span className="text-[10px]">
              {emptyStateLabel}
            </span>
          </div>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || isProcessing || values.length >= maxFiles}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${id}-error` : undefined}
          className="mt-2 min-h-11 border-hairline bg-surface-1 text-xs sm:min-h-9"
        >
          {isProcessing ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Upload size={14} className="mr-1.5" />}
          {isProcessing ? 'Menyiapkan foto...' : 'Tambah foto'}
        </Button>
        <p className="mt-2 text-[10px] leading-4 text-ink-tertiary">
          {formatNumber(values.length)} foto dipilih; {required ? `minimal ${formatNumber(minFiles)}, ` : ''}maksimal {formatNumber(maxFiles)} foto. JPG, PNG, atau WebP.
        </p>
      </div>
      <FieldError id={`${id}-error`} message={localError || error} />
    </div>
  );
}
