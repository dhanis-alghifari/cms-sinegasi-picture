import { useRef, type ChangeEvent } from 'react';
import { Camera, Image as ImageIcon } from 'lucide-react';

import { Button } from '@/shared/ui/primitives/button';
import { cn } from '@/shared/utils/cn';

interface PhotoSourcePickerProps {
  id: string;
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  galleryLabel?: string;
  cameraLabel?: string;
  className?: string;
  buttonClassName?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

export function PhotoSourcePicker({
  id,
  onFilesSelected,
  accept = 'image/*',
  multiple = false,
  disabled = false,
  galleryLabel = 'Pilih dari Galeri',
  cameraLabel = 'Ambil Foto',
  className,
  buttonClassName,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}: PhotoSourcePickerProps) {
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (files.length > 0) onFilesSelected(files);
  };

  const inputProps = {
    accept,
    multiple,
    onChange: handleFileChange,
    disabled,
    className: 'hidden',
    'aria-hidden': true as const,
    tabIndex: -1,
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <input {...inputProps} ref={galleryInputRef} id={id} type="file" />
      <input
        {...inputProps}
        ref={cameraInputRef}
        id={`${id}-camera`}
        type="file"
        capture="environment"
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => galleryInputRef.current?.click()}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        className={cn('min-h-11 h-auto whitespace-normal', buttonClassName)}
      >
        <ImageIcon aria-hidden="true" />
        {galleryLabel}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => cameraInputRef.current?.click()}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        className={cn('min-h-11 h-auto whitespace-normal', buttonClassName)}
      >
        <Camera aria-hidden="true" />
        {cameraLabel}
      </Button>
    </div>
  );
}
