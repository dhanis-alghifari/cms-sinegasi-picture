
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
import { FieldError } from '@/shared/ui/FieldError';
import { STUDENT_ROLE_VALUES, type StudentRole, type UserRole } from '@/shared/types/common';
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
  { value: 'treasurer', label: 'Treasurer (Bendahara)' },
];

const STUDENT_ROLE_LABELS: Record<StudentRole, string> = {
  leader: 'Leader (Ketua)',
  vice_leader: 'Vice Leader (Wakil Ketua)',
  secretary: 'Secretary (Sekretaris)',
  treasurer: 'Treasurer (Bendahara)',
  equipment_team: 'Equipment Team',
  contest_team: 'Contest Team',
  member: 'Member (Siswa)',
};
const STUDENT_ROLE_OPTIONS: ReadonlyArray<{ value: StudentRole; label: string }> = STUDENT_ROLE_VALUES.map((value) => ({
  value,
  label: STUDENT_ROLE_LABELS[value],
}));

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
  const isLegacyStudentAccount = Boolean(
    userAccount
    && !isLinkedStudent
    && userAccount.role !== 'treasurer'
    && isOneOf(userAccount.role, STUDENT_ROLE_VALUES),
  );
  let roleOptions: ReadonlyArray<{ value: UserRole; label: string }> = ROLE_OPTIONS;
  if (isLinkedStudent) roleOptions = STUDENT_ROLE_OPTIONS;
  if (isLegacyStudentAccount && userAccount) {
    roleOptions = [{ value: userAccount.role, label: STUDENT_ROLE_LABELS[userAccount.role as StudentRole] }];
  }
  let roleFieldLabel = 'Peran Akses';
  if (isLinkedStudent) roleFieldLabel = 'Peran Siswa';
  if (isLegacyStudentAccount) roleFieldLabel = 'Peran Akun Siswa Lama';
  let dialogDescription = isEditing
    ? 'Ubah username login, nama, atau peran pengguna. Wajib mencantumkan alasan perubahan.'
    : 'Buat akun operasional. Akun siswa baru dan penautan akun siswa lama dikelola dari halaman Data Siswa.';
  if (isLegacyStudentAccount) {
    dialogDescription = 'Akun siswa lama ini belum terhubung ke profil. Tautkan melalui Data Siswa sebelum mengubah perannya.';
  }

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
    form.clearErrors(['password', 'change_reason']);
    if (!isEditing && (!data.password || data.password.trim().length < 8)) {
      form.setError('password', {
        type: 'manual',
        message: 'Kata sandi akun operasional wajib diisi minimal 8 karakter.',
      });
      return;
    }
    if (isEditing && (!data.change_reason || data.change_reason.trim().length < 5)) {
      form.setError('change_reason', {
        type: 'manual',
        message: 'Alasan perubahan wajib diisi (minimal 5 karakter).',
      });
      return;
    }
    try {
      await onSubmit(data);
      handleDialogOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.errorCode === 'DUPLICATE_USERNAME') {
        form.setError('username', { type: 'server', message: 'Nama pengguna ini sudah digunakan akun lain.' });
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
            {dialogDescription}
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
            <Label className="text-ink-muted text-xs">{roleFieldLabel} *</Label>
            <Select
              value={selectedRole}
              onValueChange={handleRoleValueChange}
              disabled={isLegacyStudentAccount}
            >
              <SelectTrigger className="bg-surface-2 border-hairline text-ink text-xs">
                <SelectValue placeholder="Pilih Role" />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map(({ value, label }) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
            {form.formState.errors.role && (
              <p className="text-semantic-danger text-[10px]">{form.formState.errors.role.message}</p>
            )}
            {isLegacyStudentAccount && !form.formState.errors.role && (
              <p className="text-ink-tertiary text-[10px]">Tautkan akun ini dari halaman Data Siswa sebelum mengubah perannya.</p>
            )}
            {isLinkedStudent && !form.formState.errors.role && (
              <p className="text-ink-tertiary text-[10px]">Teacher khusus akun operasional; Bendahara dapat menjadi role siswa maupun akun operasional.</p>
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
                aria-invalid={Boolean(form.formState.errors.password)}
                aria-describedby={form.formState.errors.password ? 'password-error' : undefined}
                className={cn('bg-surface-2 border-hairline text-ink text-xs', form.formState.errors.password && 'border-semantic-danger')}
                {...form.register('password')}
              />
              <FieldError id="password-error" message={form.formState.errors.password?.message} />
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
                aria-invalid={Boolean(form.formState.errors.change_reason)}
                aria-describedby={form.formState.errors.change_reason ? 'user-change-reason-error' : undefined}
                className={cn('bg-surface-2 border-hairline text-ink text-xs', form.formState.errors.change_reason && 'border-semantic-danger')}
                {...form.register('change_reason')}
              />
              <FieldError id="user-change-reason-error" message={form.formState.errors.change_reason?.message} />
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleDialogOpenChange(false)}
              className="text-xs h-9"
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
