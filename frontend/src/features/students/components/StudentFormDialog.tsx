// src/features/students/components/StudentFormDialog.tsx
// Dialog form for creating or editing student records with Image File Upload & Preview

import { useCallback, useEffect, useState, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { User, Loader2, Upload, X, Image as ImageIcon } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/shared/api/errors';
import { compressImageFile, MAX_SOURCE_IMAGE_BYTES } from '@/shared/utils/compressImage';

import { studentSchema, type StudentFormValues } from '../schemas/studentSchema';
import type { Student, Peminatan } from '../types/students.types';
import { classesService } from '@/features/classes/services/classes.service';
import type { ClassOption } from '@/features/classes/types/classes.types';

interface StudentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student?: Student | null;
  onSubmit: (values: StudentFormValues) => Promise<void>;
  isLoading?: boolean;
  error?: unknown;
}

export function StudentFormDialog({
  open,
  onOpenChange,
  student,
  onSubmit,
  isLoading,
  error,
}: StudentFormDialogProps) {
  const isEditing = Boolean(student);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFilePreview, setSelectedFilePreview] = useState<string | null>(null);
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [classOptionsLoading, setClassOptionsLoading] = useState(false);
  const [classOptionsError, setClassOptionsError] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadClassOptions = useCallback(async () => {
    setClassOptionsLoading(true);
    setClassOptionsError(null);

    try {
      const options = await classesService.getOptions();
      if (options.length === 0) {
        throw new Error('Pilihan kelas belum tersedia. Pastikan backend dan database aktif.');
      }
      setClassOptions(options);
    } catch (err) {
      setClassOptions([]);
      setClassOptionsError(getErrorMessage(err));
    } finally {
      setClassOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => void loadClassOptions(), 0);
    return () => window.clearTimeout(timer);
  }, [loadClassOptions, open]);

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      nis: '',
      nama: '',
      kelas: '',
      peminatan: undefined,
      no_telepon: '',
      foto_url: '',
      change_reason: '',
    },
  });

  const selectedKelas = useWatch({ control: form.control, name: 'kelas' });
  const selectedPeminatan = useWatch({ control: form.control, name: 'peminatan' });
  const watchedFotoUrl = useWatch({ control: form.control, name: 'foto_url' });

  // Reset form when dialog target student changes
  useEffect(() => {
    if (student) {
      form.reset({
        nis: student.nis,
        nama: student.nama,
        kelas: student.kelas,
        peminatan: student.peminatan,
        no_telepon: student.no_telepon ?? '',
        foto_url: student.foto_url ?? '',
        change_reason: 'Penyesuaian data siswa',
      });
    } else {
      form.reset({
        nis: '',
        nama: '',
        kelas: '',
        peminatan: undefined,
        no_telepon: '',
        foto_url: '',
        change_reason: '',
      });
    }
  }, [student, form, open]);

  // Clean up object URL when component unmounts or selected file preview changes (Memory Safety)
  useEffect(() => {
    return () => {
      if (selectedFilePreview?.startsWith('blob:')) {
        URL.revokeObjectURL(selectedFilePreview);
      }
    };
  }, [selectedFilePreview]);

  useEffect(() => {
    if (!open && fileInputRef.current) fileInputRef.current.value = '';
  }, [open]);

  // Active preview: priority to local file preview, or react-hook-form watched foto_url
  const activePreview = selectedFilePreview || (watchedFotoUrl ? watchedFotoUrl : null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setFormError('File harus berupa gambar JPEG, PNG, atau WebP.');
      return;
    }
    if (file.size > MAX_SOURCE_IMAGE_BYTES) {
      setFormError('Ukuran foto sumber maksimal 5 MB.');
      return;
    }

    setFormError(null);
    setIsProcessingImage(true);
    try {
      const compressedDataUrl = await compressImageFile(file);
      setSelectedFilePreview(compressedDataUrl);
      form.setValue('foto_url', compressedDataUrl, { shouldValidate: true, shouldDirty: true });
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleRemoveImage = () => {
    if (selectedFilePreview && selectedFilePreview.startsWith('blob:')) {
      URL.revokeObjectURL(selectedFilePreview);
    }
    setSelectedFilePreview(null);
    form.setValue('foto_url', '', { shouldValidate: true, shouldDirty: true });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setFormError(null);
      setSelectedFilePreview(null);
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = form.handleSubmit(async (data: StudentFormValues) => {
    setFormError(null);
    if (isEditing && (!data.change_reason || data.change_reason.trim().length < 5)) {
      setFormError('Alasan perubahan wajib diisi (minimal 5 karakter)');
      return;
    }
    try {
      await onSubmit(data);
      handleDialogOpenChange(false);
    } catch (err: any) {
      const msg = err?.message || 'Terjadi kesalahan saat menyimpan data siswa';
      setFormError(msg);
    }
  });

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="bg-surface-1 border-hairline text-ink max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <User size={18} className="text-primary" />
            <DialogTitle className="text-ink text-base font-semibold">
              {isEditing ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-ink-subtle text-xs">
            {isEditing
              ? 'Perbarui informasi identitas siswa atau peminatan crew.'
              : 'Isi formulir untuk mendaftarkan siswa. Sistem otomatis membuat akun Anggota dengan username dari NIS.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {(formError || Boolean(error)) && (
            <div role="alert" className="px-3.5 py-2.5 rounded-md bg-semantic-danger/10 border border-semantic-danger/30 text-semantic-danger text-xs font-medium">
              {formError || getErrorMessage(error)}
            </div>
          )}

          {/* NIS & Nama */}
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1 col-span-1">
              <Label htmlFor="nis" className="text-ink-muted text-xs">NIS *</Label>
              <Input
                id="nis"
                placeholder="2026xxxx"
                disabled={isEditing}
                className={cn('bg-surface-2 border-hairline text-ink text-xs h-9 font-mono', form.formState.errors.nis && 'border-semantic-danger')}
                {...form.register('nis')}
              />
              {form.formState.errors.nis && (
                <p className="text-semantic-danger text-[10px]">{form.formState.errors.nis.message}</p>
              )}
            </div>

            <div className="space-y-1 col-span-2">
              <Label htmlFor="nama" className="text-ink-muted text-xs">Nama Lengkap *</Label>
              <Input
                id="nama"
                placeholder="Nama lengkap siswa"
                className={cn('bg-surface-2 border-hairline text-ink text-xs h-9', form.formState.errors.nama && 'border-semantic-danger')}
                {...form.register('nama')}
              />
              {form.formState.errors.nama && (
                <p className="text-semantic-danger text-[10px]">{form.formState.errors.nama.message}</p>
              )}
            </div>
          </div>

          {/* Kelas, Peminatan, No HP */}
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1">
              <Label className="text-ink-muted text-xs">Kelas *</Label>
              <Select
                value={selectedKelas || ''}
                disabled={classOptionsLoading || Boolean(classOptionsError)}
                onValueChange={(val) => val && form.setValue('kelas', val, { shouldValidate: true })}
              >
                <SelectTrigger
                  className={cn(
                    'w-full bg-surface-2 border-hairline text-ink text-xs h-9',
                    form.formState.errors.kelas && 'border-semantic-danger'
                  )}
                >
                  <SelectValue placeholder="Pilih Kelas Siswa" />
                </SelectTrigger>
                <SelectContent className="bg-surface-3 border-hairline text-ink max-h-56 overflow-y-auto">
                  {classOptions.map((item) => (
                    <SelectItem key={item.id} value={item.nama_kelas}>
                      {item.nama_kelas}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.kelas && (
                <p className="text-semantic-danger text-[10px]">{form.formState.errors.kelas.message}</p>
              )}
              {classOptionsLoading && (
                <p className="text-ink-tertiary text-[10px]">Memuat pilihan kelas...</p>
              )}
              {classOptionsError && (
                <div className="flex items-center justify-between gap-2 text-semantic-danger text-[10px]">
                  <span>{classOptionsError}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void loadClassOptions()}
                    className="h-6 px-2 text-[10px] text-primary"
                  >
                    Coba lagi
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-ink-muted text-xs">Peminatan Crew</Label>
              <Select
                value={selectedPeminatan ?? ''}
                onValueChange={(val) => form.setValue('peminatan', val as Peminatan)}
              >
                <SelectTrigger className="w-full bg-surface-2 border-hairline text-ink text-xs h-9">
                  <SelectValue placeholder="Pilih Peminatan" />
                </SelectTrigger>
                <SelectContent className="bg-surface-3 border-hairline text-ink">
                  <SelectItem value="kamera">Kamera</SelectItem>
                  <SelectItem value="editing">Editing</SelectItem>
                  <SelectItem value="naskah">Naskah</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="no_telepon" className="text-ink-muted text-xs">No. Telepon / WA</Label>
              <Input
                id="no_telepon"
                placeholder="0812xxxxxxxx"
                className="bg-surface-2 border-hairline text-ink text-xs h-9"
                {...form.register('no_telepon')}
              />
            </div>
          </div>

          {/* Image File Upload & Compression */}
          <div className="space-y-1">
            <Label className="text-ink-muted text-xs font-medium">Foto Profil Siswa (Upload File Gambar)</Label>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />

            {activePreview ? (
              <div className="flex items-center gap-3 p-2 rounded-lg border border-hairline bg-surface-2">
                <img
                  src={activePreview}
                  alt="Preview Foto Profil"
                  className="w-12 h-12 rounded-full object-cover border border-primary/30 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-ink truncate">Foto Profil Terpilih</p>
                  <p className="text-[10px] text-semantic-success truncate">
                    ✓ Foto sudah dikompres agar aman dikirim ke server
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleRemoveImage}
                  className="h-8 w-8 text-ink-subtle hover:text-semantic-danger"
                >
                  <X size={16} />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-hairline hover:border-primary/50 bg-surface-2/50 hover:bg-surface-2 p-3 rounded-lg flex items-center justify-center gap-2.5 transition-colors cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center shrink-0">
                  <Upload size={16} className="text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-medium text-ink flex items-center gap-1">
                    <span>Pilih Foto Profil dari Komputer</span>
                    <ImageIcon size={12} className="text-ink-tertiary" />
                  </p>
                  <p className="text-[10px] text-ink-tertiary">PNG, JPG, atau WebP (Sumber maksimal 5 MB)</p>
                </div>
              </button>
            )}
          </div>

          {/* Change Reason (Zero Silent Edits Requirement — Wajib hanya saat Edit/Ubah Data) */}
          {isEditing && (
            <div className="space-y-1 pt-2 border-t border-hairline">
              <Label htmlFor="change_reason" className="text-ink-muted text-xs font-semibold">
                Alasan Perubahan Data (Audit Header) *
              </Label>
              <Input
                id="change_reason"
                placeholder="cth. Penyesuaian kelas siswa / perbaikan penulisan nama"
                className={cn('bg-surface-2 border-hairline text-ink text-xs h-9', form.formState.errors.change_reason && 'border-semantic-danger')}
                {...form.register('change_reason')}
              />
              {form.formState.errors.change_reason && (
                <p className="text-semantic-danger text-[10px]">{form.formState.errors.change_reason.message}</p>
              )}
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDialogOpenChange(false)}
              className="bg-surface-2 border-hairline text-ink text-xs h-9"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isLoading || isProcessingImage}
              className="bg-primary hover:bg-primary-hover text-primary-foreground text-xs h-9 font-medium"
            >
              {isLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1.5" />
                  Menyimpan...
                </>
              ) : (
                'Simpan'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
