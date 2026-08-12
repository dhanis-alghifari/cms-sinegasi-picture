// src/features/users/components/UserFormDialog.tsx
// Dialog form for adding or editing user accounts

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
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ApiError, getErrorMessage } from '@/shared/api/errors';
import type { UserRole } from '@/shared/types/common';

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

export function UserFormDialog({
  open,
  onOpenChange,
  userAccount,
  onSubmit,
  isLoading,
  error,
}: UserFormDialogProps) {
  const isEditing = Boolean(userAccount);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      username: '',
      nama: '',
      role: '' as UserRole,
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
        role: '' as UserRole,
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
      setFormError('Password akun operasional wajib diisi minimal 8 karakter.');
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
        form.setError('username', { type: 'server', message: 'Username ini sudah digunakan pengguna lain.' });
        setFormError('Username tidak tersedia. Gunakan username lain.');
        return;
      }
      setFormError(getErrorMessage(err) || 'Terjadi kesalahan saat menyimpan data pengguna');
    }
  });

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

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {(formError || Boolean(error)) && (
            <div role="alert" className="px-3.5 py-2.5 rounded-md bg-semantic-danger/10 border border-semantic-danger/30 text-semantic-danger text-xs font-medium">
              {formError || getErrorMessage(error)}
            </div>
          )}

          {/* Username */}
          <div className="space-y-1">
            <Label htmlFor="username" className="text-ink-muted text-xs">Username *</Label>
            <Input
              id="username"
              placeholder="cth. budi_kamera"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={cn('bg-surface-2 border-hairline text-ink text-xs h-9', form.formState.errors.username && 'border-semantic-danger')}
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
              className={cn('bg-surface-2 border-hairline text-ink text-xs h-9', form.formState.errors.nama && 'border-semantic-danger')}
              {...form.register('nama')}
            />
            {form.formState.errors.nama && (
              <p className="text-semantic-danger text-[10px]">{form.formState.errors.nama.message}</p>
            )}
          </div>

          {/* Role */}
          <div className="space-y-1">
            <Label className="text-ink-muted text-xs">Peran (Role Akses) *</Label>
            <Select
              value={selectedRole}
              onValueChange={(val) => val && form.setValue('role', val as UserRole)}
            >
              <SelectTrigger className="bg-surface-2 border-hairline text-ink text-xs h-9">
                <SelectValue placeholder="Pilih Role" />
              </SelectTrigger>
            <SelectContent className="bg-surface-3 border-hairline text-ink">
                <SelectItem value="teacher">Teacher (Guru Pembina)</SelectItem>
                <SelectItem value="leader">Leader (Ketua)</SelectItem>
                <SelectItem value="vice_leader">Vice Leader (Wakil Ketua)</SelectItem>
                <SelectItem value="treasurer">Treasurer (Bendahara)</SelectItem>
                <SelectItem value="secretary">Secretary (Sekretaris)</SelectItem>
                <SelectItem value="equipment_team">Equipment Team</SelectItem>
                <SelectItem value="contest_team">Contest Team</SelectItem>
                {isEditing && userAccount?.role === 'member' && (
                  <SelectItem value="member">Member (Siswa)</SelectItem>
                )}
              </SelectContent>
            </Select>
            {form.formState.errors.role && (
              <p className="text-semantic-danger text-[10px]">{form.formState.errors.role.message}</p>
            )}
          </div>

          {/* Initial Password (only for creation) */}
          {!isEditing && (
            <div className="space-y-1">
              <Label htmlFor="password" className="text-ink-muted text-xs">Password Bawaan *</Label>
              <Input
                id="password"
                type="password"
                placeholder="Password bawaan akun baru"
                className={cn('bg-surface-2 border-hairline text-ink text-xs h-9', form.formState.errors.password && 'border-semantic-danger')}
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
