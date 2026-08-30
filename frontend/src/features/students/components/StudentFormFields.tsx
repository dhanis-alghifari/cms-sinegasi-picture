// src/features/students/components/StudentFormFields.tsx
// Presentational fields for the student create/edit dialog.

import type { ChangeEvent, RefObject } from 'react';
import { Image as ImageIcon, Upload, X } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';

import { Button } from '@/shared/ui/primitives/button';
import { Input } from '@/shared/ui/primitives/input';
import { Label } from '@/shared/ui/primitives/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select';
import { cn } from '@/shared/utils/cn';

import type { ClassOption } from '@/features/classes/types/classes.types';
import type { StudentFormValues } from '../schemas/studentSchema';
import { PEMINATAN_VALUES, type Peminatan } from '../types/students.types';
import { isOneOf } from '@/shared/utils/isOneOf';

interface StudentFormFieldsProps {
  form: UseFormReturn<StudentFormValues>;
  isEditing: boolean;
  selectedKelas?: string;
  selectedPeminatan?: Peminatan;
  activePreview: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  classOptions: ClassOption[];
  classOptionsLoading: boolean;
  classOptionsError: string | null;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
  onRetryLoadClasses: () => void | Promise<void>;
}

export function StudentFormFields({
  form,
  isEditing,
  selectedKelas,
  selectedPeminatan,
  activePreview,
  fileInputRef,
  classOptions,
  classOptionsLoading,
  classOptionsError,
  onFileChange,
  onRemoveImage,
  onRetryLoadClasses,
}: StudentFormFieldsProps) {
  return (
    <>
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
                    onClick={() => void onRetryLoadClasses()}
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
                onValueChange={(val) => form.setValue('peminatan', isOneOf(val, PEMINATAN_VALUES) ? val : undefined)}
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
              onChange={onFileChange}
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
                  onClick={onRemoveImage}
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

    </>
  );
}
