// src/features/students/components/StudentFormDialog.tsx
// Dialog form for creating or editing student records with Image File Upload & Preview

import { useCallback, useEffect, useState, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { User, Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui/primitives/dialog';
import { Button } from '@/shared/ui/primitives/button';
import { getErrorMessage } from '@/shared/api/errors';
import { compressImageFile, MAX_SOURCE_IMAGE_BYTES } from '@/shared/utils/compressImage';
import { StudentFormFields } from './StudentFormFields';

import { studentSchema, type StudentFormValues } from '../schemas/studentSchema';
import type { Student } from '../types/students.types';
import { classesService } from '@/features/classes/api/classes.service';
import type { ClassSelectorOption } from '@/features/classes/types/classes.types';

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
  const [classOptions, setClassOptions] = useState<ClassSelectorOption[]>([]);
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
    } catch (error) {
      setFormError(getErrorMessage(error));
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

          <StudentFormFields
            form={form}
            isEditing={isEditing}
            selectedKelas={selectedKelas}
            selectedPeminatan={selectedPeminatan}
            activePreview={activePreview}
            fileInputRef={fileInputRef}
            classOptions={classOptions}
            classOptionsLoading={classOptionsLoading}
            classOptionsError={classOptionsError}
            onFileChange={handleFileChange}
            onRemoveImage={handleRemoveImage}
            onRetryLoadClasses={loadClassOptions}
          />

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDialogOpenChange(false)}
              className="bg-surface-2 border-hairline text-ink text-xs"
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
