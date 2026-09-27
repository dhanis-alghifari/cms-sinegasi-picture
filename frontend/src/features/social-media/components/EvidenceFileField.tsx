import { useEffect, useMemo, useState } from 'react';
import { Image as ImageIcon, X } from 'lucide-react';
import { Button } from '@/shared/ui/primitives/button';
import { Label } from '@/shared/ui/primitives/label';
import { ImagePreviewDialog } from '@/shared/ui/ImagePreviewDialog';
import { PhotoSourcePicker } from '@/shared/ui/PhotoSourcePicker';
import { isSupportedEvidenceFile } from '../utils/publicationRules';

interface EvidenceFileFieldProps {
  id: string;
  label: string;
  value: File | null;
  onChange: (file: File | null) => void;
  required?: boolean;
  disabled?: boolean;
  helperText?: string;
}

function formatBytes(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function EvidenceFileField({ id, label, value, onChange, required = false, disabled = false, helperText }: EvidenceFileFieldProps) {
  const [error, setError] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewUrl = useMemo(() => value ? URL.createObjectURL(value) : null, [value]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const handleSelected = (files: File[]) => {
    const file = files[0];
    if (!file) return;
    if (!isSupportedEvidenceFile(file)) {
      setError('Pilih gambar JPEG, PNG, atau WebP berukuran maksimal 5 MB.');
      return;
    }
    setError('');
    onChange(file);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}{required ? ' *' : ''}</Label>
      <div className="space-y-3 rounded-lg border border-dashed border-hairline bg-surface-2 p-3">
        {value && previewUrl ? (
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-hairline bg-surface-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => setPreviewOpen(true)}
              aria-label={`Pratinjau ${label}`}
            >
              <img src={previewUrl} alt={`Pratinjau ${label}`} className="max-h-full max-w-full object-contain" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-ink">{value.name}</p>
              <p className="mt-1 text-[11px] text-ink-tertiary">{formatBytes(value.size)} · gambar tidak dikompres ulang agar teks grafik tetap terbaca</p>
              <Button type="button" variant="ghost" onClick={() => onChange(null)} disabled={disabled} className="mt-2 min-h-11 text-semantic-danger">
                <X size={14} aria-hidden="true" /> Hapus foto
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-ink-tertiary">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-1">
              <ImageIcon size={22} aria-hidden="true" />
            </div>
            <p className="text-xs">Belum ada bukti gambar.</p>
          </div>
        )}
        <PhotoSourcePicker
          id={id}
          accept="image/jpeg,image/png,image/webp"
          disabled={disabled}
          onFilesSelected={handleSelected}
          galleryLabel={value ? 'Pilih gambar lain' : 'Pilih dari galeri'}
          cameraLabel={value ? 'Ambil gambar baru' : 'Ambil dari kamera'}
          className="w-full sm:w-auto"
          buttonClassName="min-h-11 flex-1 bg-surface-1 sm:flex-none"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : `${id}-help`}
        />
      </div>
      <p id={`${id}-help`} className="text-[11px] text-ink-tertiary">{helperText ?? 'JPEG, PNG, atau WebP; maksimal 5 MB. Gambar grafik dipertahankan apa adanya supaya angka dan label tidak kabur.'}</p>
      {error && <p id={`${id}-error`} role="alert" className="text-xs text-semantic-danger">{error}</p>}
      <ImagePreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} src={previewUrl} alt={`Pratinjau ${label}`} title={label} description={value?.name} />
    </div>
  );
}
