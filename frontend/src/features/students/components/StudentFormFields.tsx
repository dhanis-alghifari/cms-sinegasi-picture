
import { useMemo } from 'react';
import { X } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';

import { Button } from '@/shared/ui/primitives/button';
import { FieldError } from '@/shared/ui/FieldError';
import { Input } from '@/shared/ui/primitives/input';
import { Label } from '@/shared/ui/primitives/label';
import { RadioGroup } from '@/shared/ui/primitives/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select';
import { SearchableCombobox } from '@/shared/ui/SearchableCombobox';
import { cn } from '@/shared/utils/cn';

import type { ClassSelectorOption } from '@/features/classes/types/classes.types';
import { formatRoleLabel } from '@/shared/utils/formatLabels';
import { STUDENT_ROLE_VALUES, type StudentRole } from '@/shared/types/common';
import type { StudentFormValues } from '../schemas/studentSchema';
import { PEMINATAN_VALUES, type Peminatan } from '../types/students.types';
import { isOneOf } from '@/shared/utils/isOneOf';
import { PhotoSourcePicker } from '@/shared/ui/PhotoSourcePicker';

interface StudentFormFieldsProps {
  form: UseFormReturn<StudentFormValues>;
  showRoleSelection?: boolean;
  state: {
    isEditing: boolean;
    selectedKelas?: string;
    selectedPeminatan?: Peminatan;
    selectedRole?: StudentRole;
    activePreview: string | null;
    isProcessingImage: boolean;
  };
  classes: {
    options: ClassSelectorOption[];
    isLoading: boolean;
    error: string | null;
    onRetry: () => void | Promise<void>;
  };
  image: {
    onFilesSelected: (files: File[]) => void;
    onRemove: () => void;
    error?: string | null;
  };
}

export function StudentFormFields({
  form,
  showRoleSelection = true,
  state,
  classes,
  image,
}: StudentFormFieldsProps) {
  const { isEditing, selectedKelas, selectedPeminatan, selectedRole, activePreview, isProcessingImage } = state;
  const {
    options: classOptions,
    isLoading: classOptionsLoading,
    error: classOptionsError,
    onRetry: onRetryLoadClasses,
  } = classes;
  const { onFilesSelected, onRemove: onRemoveImage, error: imageError } = image;
  const searchableClassOptions = useMemo(
    () => classOptions.map((option) => ({
      id: option.id,
      label: option.nama_kelas,
      secondaryLabel: `Tingkat ${option.tingkat}`,
    })),
    [classOptions],
  );
  const selectedClassOption = useMemo(
    () => searchableClassOptions.find((option) => option.label === selectedKelas) ?? null,
    [searchableClassOptions, selectedKelas],
  );
  const handleClassValueChange = (value: string) => {
    const selectedClass = classOptions.find((option) => option.id === value);
    if (!selectedClass) return;
    form.setValue('kelas', selectedClass.nama_kelas, { shouldValidate: true });
  };
  const handleSpecializationChange = (value: string) => {
    form.setValue('peminatan', isOneOf(value, PEMINATAN_VALUES) ? value : undefined);
  };
  const handleRoleChange = (value: string | null) => {
    if (value && isOneOf(value, STUDENT_ROLE_VALUES)) form.setValue('role', value, { shouldValidate: true });
  };
  return (
    <>
          {/* NIS & Nama */}
          <div className="grid grid-cols-1 gap-3">
            <div className="min-w-0 space-y-1">
              <Label htmlFor="nis" className="text-ink-muted text-xs">NIS *</Label>
              <Input
                id="nis"
                placeholder="2026xxxx"
                disabled={isEditing}
                className={cn('w-full min-w-0 bg-surface-2 border-hairline text-ink text-xs font-mono', form.formState.errors.nis && 'border-semantic-danger')}
                {...form.register('nis')}
              />
              {form.formState.errors.nis && (
                <p className="text-semantic-danger text-[10px]">{form.formState.errors.nis.message}</p>
              )}
            </div>

            <div className="min-w-0 space-y-1">
              <Label htmlFor="nama" className="text-ink-muted text-xs">Nama Lengkap *</Label>
              <Input
                id="nama"
                placeholder="Nama lengkap siswa"
                className={cn('w-full min-w-0 bg-surface-2 border-hairline text-ink text-xs', form.formState.errors.nama && 'border-semantic-danger')}
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
              <SearchableCombobox
                options={searchableClassOptions}
                value={selectedClassOption?.id}
                selectedOption={selectedClassOption}
                onValueChange={handleClassValueChange}
                isLoading={classOptionsLoading}
                disabled={classOptionsLoading || Boolean(classOptionsError)}
                errorMessage={form.formState.errors.kelas?.message}
                ariaLabel="Cari dan pilih kelas siswa"
                triggerLabel="Buka daftar kelas"
                placeholder="Cari atau pilih kelas..."
                emptyMessage="Kelas tidak ditemukan."
                loadingMessage="Memuat pilihan kelas..."
              />
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
                    onClick={() => void onRetryLoadClasses()}
                    className="h-6 px-2 text-[10px] text-primary"
                  >
                    Coba lagi
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <RadioGroup
                name="student-specialization"
                legend="Peminatan Crew"
                value={selectedPeminatan ?? ''}
                options={[
                  { value: 'kamera', label: 'Kamera' },
                  { value: 'editing', label: 'Editing' },
                  { value: 'naskah', label: 'Naskah' },
                ]}
                onValueChange={handleSpecializationChange}
              />
            </div>

            {!isEditing && showRoleSelection && (
              <div className="space-y-1">
                <Label className="text-ink-muted text-xs">Peran Akun Siswa *</Label>
                <Select value={selectedRole ?? 'member'} onValueChange={handleRoleChange}>
                  <SelectTrigger className="w-full bg-surface-2 border-hairline text-ink text-xs">
                    <SelectValue placeholder="Pilih peran akun siswa" />
                  </SelectTrigger>
                  <SelectContent>
                    {STUDENT_ROLE_VALUES.map((role) => (
                      <SelectItem key={role} value={role}>{formatRoleLabel(role)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-ink-tertiary text-[10px]">Role Bendahara memberi akses kelola kas; pilih hanya untuk siswa yang ditugaskan. Teacher khusus akun operasional.</p>
                {form.formState.errors.role && (
                  <p className="text-semantic-danger text-[10px]">{form.formState.errors.role.message}</p>
                )}
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="no_telepon" className="text-ink-muted text-xs">No. Telepon / WA</Label>
              <Input
                id="no_telepon"
                placeholder="0812xxxxxxxx"
                className="bg-surface-2 border-hairline text-ink text-xs"
                {...form.register('no_telepon')}
              />
            </div>
          </div>

          {/* Image File Upload & Compression */}
          <div className="space-y-1">
            <Label className="text-ink-muted text-xs font-medium">Foto Profil Siswa (Upload File Gambar)</Label>

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
                    ✓ Foto siap dikirim ke server
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onRemoveImage}
                  disabled={isProcessingImage}
                  aria-label="Hapus foto profil"
                  className="min-h-11 min-w-11 text-ink-subtle hover:text-semantic-danger"
                >
                  <X size={16} />
                </Button>
              </div>
            ) : null}
            <PhotoSourcePicker
              id="student-photo"
              accept="image/jpeg,image/png,image/webp"
              disabled={isProcessingImage}
              onFilesSelected={onFilesSelected}
              galleryLabel={isProcessingImage ? 'Memproses foto...' : activePreview ? 'Ganti dari Galeri' : 'Pilih dari Galeri'}
              cameraLabel={activePreview ? 'Ambil Foto Baru' : 'Ambil Foto'}
              className="w-full"
              buttonClassName={cn('flex-1 bg-surface-1', imageError && 'border-semantic-danger')}
              aria-invalid={Boolean(imageError)}
              aria-describedby={imageError ? 'student-photo-error' : undefined}
            />
            <p className="text-[10px] text-ink-tertiary">JPG, PNG, atau WebP · ukuran sumber maksimal 5 MB.</p>
            <FieldError id="student-photo-error" message={imageError} />
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
                className={cn('bg-surface-2 border-hairline text-ink text-xs', form.formState.errors.change_reason && 'border-semantic-danger')}
                {...form.register('change_reason')}
              />
              {form.formState.errors.change_reason && (
                <p className="text-semantic-danger text-[10px]">{form.formState.errors.change_reason.message}</p>
              )}
            </div>
          )}

    </>
  );
}
