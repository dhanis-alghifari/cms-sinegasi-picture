
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/ui/primitives/dialog';
import { Button } from '@/shared/ui/primitives/button';
import { Input } from '@/shared/ui/primitives/input';
import { Label } from '@/shared/ui/primitives/label';
import { RadioGroup } from '@/shared/ui/primitives/radio-group';
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
  const [error, setError] = useState('');

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
      setError('');
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialData, open]);

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setError('');
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaKelas.trim()) {
      setError('Nama kelas wajib diisi');
      return;
    }
    if (initialData && (!changeReason.trim() || changeReason.trim().length < 5)) {
      setError('Alasan perubahan wajib diisi (minimal 5 karakter)');
      return;
    }

    try {
      setError('');
      await onSubmit({
        nama_kelas: namaKelas.trim(),
        tingkat,
        ...(initialData ? { change_reason: changeReason.trim() } : {}),
      });
      handleDialogOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Gagal menyimpan data kelas');
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
          {error && (
            <div className="p-2.5 rounded bg-semantic-danger/10 border border-semantic-danger/20 text-semantic-danger text-xs">
              {error}
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
              onChange={(e) => setNamaKelas(e.target.value)}
              className="bg-surface-2 border-hairline text-ink text-xs"
            />
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
              onChange={(e) => setChangeReason(e.target.value)}
              className="bg-surface-2 border-hairline text-ink text-xs"
            />
          </div>}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleDialogOpenChange(false)}
              className="border-hairline text-ink hover:bg-surface-2 text-xs"
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
