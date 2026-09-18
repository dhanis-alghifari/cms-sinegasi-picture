
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/ui/primitives/dialog';
import { Button } from '@/shared/ui/primitives/button';
import { FieldError } from '@/shared/ui/FieldError';
import { Input } from '@/shared/ui/primitives/input';
import { Label } from '@/shared/ui/primitives/label';
import { RadioGroup } from '@/shared/ui/primitives/radio-group';
import { cn } from '@/shared/utils/cn';
import type { ClassRecord } from '../types/classes.types';

interface ClassFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: ClassRecord | null;
  onSubmit: (values: { nama_kelas: string; tingkat: string; change_reason?: string }) => Promise<void>;
  isLoading?: boolean;
}

export function ClassFormDialog({
  open,
  onOpenChange,
  initialData,
  onSubmit,
  isLoading = false,
}: ClassFormDialogProps) {
  const [namaKelas, setNamaKelas] = useState('');
  const [tingkat, setTingkat] = useState<'X' | 'XI' | 'XII'>('X');
  const [changeReason, setChangeReason] = useState('');
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ namaKelas?: string; changeReason?: string }>({});

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (initialData) {
        setNamaKelas(initialData.nama_kelas);
        setTingkat((initialData.tingkat as 'X' | 'XI' | 'XII') || 'X');
      } else {
        setNamaKelas('');
        setTingkat('X');
      }
      setChangeReason('');
      setFormError('');
      setFieldErrors({});
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialData, open]);

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setFormError('');
      setFieldErrors({});
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFieldErrors({});
    if (!namaKelas.trim()) {
      setFieldErrors({ namaKelas: 'Nama kelas wajib diisi.' });
      return;
    }
    if (initialData && (!changeReason.trim() || changeReason.trim().length < 5)) {
      setFieldErrors({ changeReason: 'Alasan perubahan wajib diisi (minimal 5 karakter).' });
      return;
    }

    try {
      await onSubmit({
        nama_kelas: namaKelas.trim(),
        tingkat,
        ...(initialData ? { change_reason: changeReason.trim() } : {}),
      });
      handleDialogOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setFormError(err.message);
      } else {
        setFormError('Gagal menyimpan data kelas.');
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="bg-surface-1 border-hairline text-ink md:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-ink text-base font-semibold">
            {initialData ? 'Edit Data Kelas' : 'Tambah Kelas Baru'}
          </DialogTitle>
        </DialogHeader>

        <form noValidate onSubmit={handleSubmit} className="space-y-4 pt-2">
          {formError && (
            <div role="alert" className="p-2.5 rounded bg-semantic-danger/10 border border-semantic-danger/20 text-semantic-danger text-xs">
              {formError}
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="nama_kelas" className="text-ink-muted text-xs">
              Nama Kelas *
            </Label>
            <Input
              id="nama_kelas"
              placeholder="Contoh: X TKJ 1, XII AK 5"
              value={namaKelas}
              onChange={(e) => {
                setNamaKelas(e.target.value);
                setFieldErrors((current) => ({ ...current, namaKelas: undefined }));
              }}
              aria-invalid={Boolean(fieldErrors.namaKelas)}
              aria-describedby={fieldErrors.namaKelas ? 'class-name-error' : undefined}
              className={cn('bg-surface-2 border-hairline text-ink text-xs', fieldErrors.namaKelas && 'border-semantic-danger')}
            />
            <FieldError id="class-name-error" message={fieldErrors.namaKelas} />
          </div>

          <div className="space-y-1">
            <RadioGroup
              name="class-level"
              legend="Tingkat *"
              value={tingkat}
              options={[
                { value: 'X', label: 'Kelas X' },
                { value: 'XI', label: 'Kelas XI' },
                { value: 'XII', label: 'Kelas XII' },
              ]}
              onValueChange={setTingkat}
            />
          </div>

          {initialData && <div className="space-y-1">
            <Label htmlFor="changeReason" className="text-ink-muted text-xs">
              Alasan Perubahan *
            </Label>
            <Input
              id="changeReason"
              placeholder="Contoh: Penambahan rombel baru tahun ajaran 2026/2027"
              value={changeReason}
              onChange={(e) => {
                setChangeReason(e.target.value);
                setFieldErrors((current) => ({ ...current, changeReason: undefined }));
              }}
              aria-invalid={Boolean(fieldErrors.changeReason)}
              aria-describedby={fieldErrors.changeReason ? 'class-change-reason-error' : undefined}
              className={cn('bg-surface-2 border-hairline text-ink text-xs', fieldErrors.changeReason && 'border-semantic-danger')}
            />
            <FieldError id="class-change-reason-error" message={fieldErrors.changeReason} />
          </div>}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleDialogOpenChange(false)}
              className="text-xs"
            >
              Batal
            </Button>
            <Button type="submit" size="sm" disabled={isLoading} className="bg-primary text-primary-foreground text-xs">
              {isLoading ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
