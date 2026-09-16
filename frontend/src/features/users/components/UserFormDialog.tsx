
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui/primitives/dialog';
import { Button } from '@/shared/ui/primitives/button';
import { Input } from '@/shared/ui/primitives/input';
import { Label } from '@/shared/ui/primitives/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select';
import { cn } from '@/shared/utils/cn';
import { ApiError, getErrorMessage } from '@/shared/api/errors';
import { type UserRole } from '@/shared/types/common';
import { isOneOf } from '@/shared/utils/isOneOf';

import { userSchema, type UserFormValues } from '../schemas/userSchema';
import type { UserAccount } from '../types/users.types';

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userAccount?: UserAccount | null;
  onSubmit: (values: UserFormValues) => Promise<void>;
  isLoading?: boolean;
  error?: unknown;
}

const ROLE_OPTIONS: ReadonlyArray<{ value: UserRole; label: string }> = [
  { value: 'teacher', label: 'Teacher (Guru Pembina)' },
  { value: 'leader', label: 'Leader (Ketua)' },
  { value: 'vice_leader', label: 'Vice Leader (Wakil Ketua)' },
  { value: 'treasurer', label: 'Treasurer (Bendahara)' },
  { value: 'secretary', label: 'Secretary (Sekretaris)' },
  { value: 'equipment_team', label: 'Equipment Team' },
  { value: 'contest_team', label: 'Contest Team' },
  { value: 'member', label: 'Member (Siswa)' },
];

const STUDENT_ROLE_OPTIONS = ROLE_OPTIONS.filter(({ value }) => value !== 'teacher');
const OPERATIONAL_ROLE_OPTIONS = ROLE_OPTIONS.filter(({ value }) => value !== 'member');

export function UserFormDialog({
  open,
  onOpenChange,
  userAccount,
  onSubmit,
  isLoading,
  error,
}: UserFormDialogProps) {
  const isEditing = Boolean(userAccount);
  const isLinkedStudent = Boolean(userAccount?.is_linked_student);
  const roleOptions = isEditing && isLinkedStudent ? STUDENT_ROLE_OPTIONS : OPERATIONAL_ROLE_OPTIONS;

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      username: '',
      nama: '',
      role: undefined,
      password: '',
      change_reason: '',
    },
  });

  const selectedRole = useWatch({
    control: form.control,
    name: 'role',
  });

  const watchedUsername = useWatch({ control: form.control, name: 'username' });
  const watchedName = useWatch({ control: form.control, name: 'nama' });
  const hasAccountChanges = !isEditing || !userAccount
    || watchedUsername !== userAccount.username
    || watchedName !== userAccount.nama
    || selectedRole !== userAccount.role;

  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (userAccount) {
      form.reset({
        username: userAccount.username,
        nama: userAccount.nama,
        role: userAccount.role,
        password: '',
        change_reason: '',
      });
    } else {
      form.reset({
        username: '',
        nama: '',
        role: undefined,
        password: '',
        change_reason: '',
      });
    }
  }, [userAccount, form, open]);

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setFormError(null);
    onOpenChange(nextOpen);
  };

  const handleSubmit = form.handleSubmit(async (data) => {
    setFormError(null);
    if (!isEditing && (!data.password || data.password.trim().length < 8)) {
      setFormError('Kata sandi akun operasional wajib diisi minimal 8 karakter.');
      return;
    }
    if (isEditing && (!data.change_reason || data.change_reason.trim().length < 5)) {
      setFormError('Alasan perubahan wajib diisi (minimal 5 karakter)');
      return;
    }
    try {
      await onSubmit(data);
      handleDialogOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.errorCode === 'DUPLICATE_USERNAME') {
        form.setError('username', { type: 'server', message: 'Nama pengguna ini sudah digunakan akun lain.' });
        setFormError('Nama pengguna tidak tersedia. Gunakan nama pengguna lain.');
        return;
      }
      setFormError(getErrorMessage(err) || 'Terjadi kesalahan saat menyimpan data pengguna');
    }
  });

  const handleRoleValueChange = (value: string | null) => {
    if (value === null) return;
    if (!isOneOf(value, roleOptions.map(({ value: role }) => role))) return;
    form.setValue('role', value);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="bg-surface-1 border-hairline text-ink max-w-md">
        <DialogHeader>
          <DialogTitle className="text-ink text-base font-semibold">
            {isEditing ? 'Edit Akun Pengguna' : 'Tambah Akun Pengguna Baru'}
          </DialogTitle>
          <DialogDescription className="text-ink-subtle text-xs">
            {isEditing
              ? 'Ubah username login, nama, atau peran pengguna. Wajib mencantumkan alasan perubahan.'
              : 'Buat akun operasional. Akun siswa dibuat otomatis dari halaman Data Siswa.'}
          </DialogDescription>
        </DialogHeader>

        <form noValidate onSubmit={handleSubmit} className="space-y-4 pt-2">
          {(formError || Boolean(error)) && (
            <div role="alert" className="px-3.5 py-2.5 rounded-md bg-semantic-danger/10 border border-semantic-danger/30 text-semantic-danger text-xs font-medium">
              {formError || getErrorMessage(error)}
            </div>
          )}

          {/* Nama pengguna */}
          <div className="space-y-1">
            <Label htmlFor="username" className="text-ink-muted text-xs">Nama Pengguna *</Label>
            <Input
              id="username"
              placeholder="cth. budi_kamera"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={cn('bg-surface-2 border-hairline text-ink text-xs', form.formState.errors.username && 'border-semantic-danger')}
              {...form.register('username')}
            />
            {form.formState.errors.username && (
              <p className="text-semantic-danger text-[10px]">{form.formState.errors.username.message}</p>
            )}
            {isEditing && !form.formState.errors.username && (
              <p className="text-ink-tertiary text-[10px]">
                Username dipakai untuk login. Setelah disimpan, login berikutnya harus memakai username baru.
              </p>
            )}
          </div>

          {/* Nama */}
          <div className="space-y-1">
            <Label htmlFor="nama" className="text-ink-muted text-xs">Nama Lengkap *</Label>
            <Input
              id="nama"
              placeholder="Masukkan nama lengkap"
              readOnly={isLinkedStudent}
              className={cn('bg-surface-2 border-hairline text-ink text-xs', form.formState.errors.nama && 'border-semantic-danger')}
              {...form.register('nama')}
            />
            {form.formState.errors.nama && (
              <p className="text-semantic-danger text-[10px]">{form.formState.errors.nama.message}</p>
            )}
            {isLinkedStudent && !form.formState.errors.nama && (
              <p className="text-ink-tertiary text-[10px]">Nama akun mengikuti data siswa. Ubah dari halaman Data Siswa.</p>
            )}
          </div>

          {/* Role */}
          <div className="space-y-1">
            <Label className="text-ink-muted text-xs">{isLinkedStudent ? 'Peran Siswa' : 'Peran Akses'} *</Label>
            <Select
              value={selectedRole}
              onValueChange={handleRoleValueChange}
            >
              <SelectTrigger className="bg-surface-2 border-hairline text-ink text-xs">
                <SelectValue placeholder="Pilih Role" />
              </SelectTrigger>
              <SelectContent className="bg-surface-3 border-hairline text-ink">
                {roleOptions.map(({ value, label }) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
            {form.formState.errors.role && (
              <p className="text-semantic-danger text-[10px]">{form.formState.errors.role.message}</p>
            )}
            {isLinkedStudent && !form.formState.errors.role && (
              <p className="text-ink-tertiary text-[10px]">Role kepengurusan dapat diberikan kepada akun siswa. Teacher hanya untuk akun guru.</p>
            )}
          </div>

          {/* Kata sandi awal (hanya saat membuat akun) */}
          {!isEditing && (
            <div className="space-y-1">
              <Label htmlFor="password" className="text-ink-muted text-xs">Kata Sandi Bawaan *</Label>
              <Input
                id="password"
                type="password"
                placeholder="Password bawaan akun baru"
              className={cn('bg-surface-2 border-hairline text-ink text-xs', form.formState.errors.password && 'border-semantic-danger')}
                {...form.register('password')}
              />
              <p className="text-ink-tertiary text-[10px]">
                Pengguna akan diwajibkan mengganti password ini saat login pertama kali. Jangan gunakan password yang sama untuk banyak akun.
              </p>
            </div>
          )}

          {/* Change Reason (Zero Silent Edits Requirement — Wajib hanya saat Edit/Ubah Data) */}
          {isEditing && (
            <div className="space-y-1 pt-2 border-t border-hairline">
              <Label htmlFor="change_reason" className="text-ink-muted text-xs font-semibold">
                Alasan Perubahan (Audit Header) *
              </Label>
              <Input
                id="change_reason"
                placeholder="cth. Perubahan nama pengurus / promosi role"
              className={cn('bg-surface-2 border-hairline text-ink text-xs', form.formState.errors.change_reason && 'border-semantic-danger')}
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
              disabled={isLoading || (isEditing && !hasAccountChanges)}
              className="bg-primary hover:bg-primary-hover text-primary-foreground text-xs h-9 font-medium"
            >
              {isLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1.5" />
                  Menyimpan...
                </>
              ) : (
                'Simpan Akun'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
