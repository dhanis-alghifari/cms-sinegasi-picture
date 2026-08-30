import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Eye, EyeOff, Loader2, LogOut, ShieldCheck } from 'lucide-react';

import { Button } from '@/shared/ui/primitives/button';
import { Input } from '@/shared/ui/primitives/input';
import { Label } from '@/shared/ui/primitives/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui/primitives/card';
import { cn } from '@/shared/utils/cn';
import { getErrorMessage } from '@/shared/api/errors';

import { changePasswordSchema, type ChangePasswordFormValues } from '../schemas/loginSchema';
import { useChangePasswordMutation } from '../hooks/useChangePasswordMutation';
import { useAuthStore } from '../hooks/useAuthStore';

interface PasswordChangeFormProps {
  forced?: boolean;
  onSuccess: () => void;
  onCancel?: () => void;
}

const fields = ['current_password', 'new_password', 'confirm_password'] as const;

export function PasswordChangeForm({ forced = false, onSuccess, onCancel }: PasswordChangeFormProps) {
  const logout = useAuthStore((state) => state.logout);
  const changePasswordMutation = useChangePasswordMutation();
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({});

  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { current_password: '', new_password: '', confirm_password: '' },
  });

  const newPassword = useWatch({ control: form.control, name: 'new_password', defaultValue: '' });
  const currentPassword = useWatch({ control: form.control, name: 'current_password', defaultValue: '' });
  const passwordRules = [
    { label: 'Minimal 8 karakter', valid: newPassword.length >= 8 },
    { label: 'Memiliki huruf dan angka', valid: /[A-Za-z]/.test(newPassword) && /\d/.test(newPassword) },
    { label: 'Berbeda dari password saat ini', valid: newPassword.length > 0 && newPassword !== currentPassword },
  ];

  const handleSubmit = form.handleSubmit(async (data) => {
    try {
      await changePasswordMutation.mutateAsync(data);
      onSuccess();
    } catch {
      // Error is rendered in the form; no silent failure or browser alert.
    }
  });

  const handleLogout = () => {
    logout();
    window.location.assign('/login');
  };

  const labels: Record<(typeof fields)[number], string> = {
    current_password: 'Password Saat Ini',
    new_password: 'Password Baru',
    confirm_password: 'Konfirmasi Password Baru',
  };

  const ids: Record<(typeof fields)[number], string> = {
    current_password: 'current-password',
    new_password: 'new-password',
    confirm_password: 'confirm-password',
  };

  return (
    <Card className="bg-surface-1 border-hairline shadow-none">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck size={18} className="text-primary" aria-hidden="true" />
          <CardTitle className="text-ink text-lg font-semibold">
            {forced ? 'Ganti Password' : 'Keamanan Akun'}
          </CardTitle>
        </div>
        <CardDescription className="text-ink-subtle text-sm leading-6">
          {forced
            ? 'Password sementara berhasil diverifikasi. Buat password baru sebelum melanjutkan ke aplikasi.'
            : 'Ganti password secara berkala untuk menjaga keamanan akun Anda.'}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {changePasswordMutation.error && (
            <div role="alert" className="px-3 py-2 rounded-md bg-semantic-danger/10 border border-semantic-danger/30 text-semantic-danger text-sm">
              {getErrorMessage(changePasswordMutation.error)}
            </div>
          )}

          {fields.map((field) => {
            const error = form.formState.errors[field];
            return (
              <div key={field} className="space-y-1.5">
                <Label htmlFor={ids[field]} className="text-ink-muted text-sm">{labels[field]}</Label>
                <div className="relative">
                  <Input
                    id={ids[field]}
                    type={visibleFields[field] ? 'text' : 'password'}
                    autoComplete={field === 'current_password' ? 'current-password' : 'new-password'}
                    autoFocus={field === 'current_password'}
                    placeholder={field === 'current_password' ? 'Masukkan password saat ini' : field === 'new_password' ? 'Masukkan password baru' : 'Ulangi password baru'}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${ids[field]}-error` : undefined}
                    className={cn(
                      'bg-surface-2 border-hairline text-ink placeholder:text-ink-tertiary pr-10',
                      'focus:border-primary-focus focus:ring-1 focus:ring-primary-focus/50',
                      error && 'border-semantic-danger focus:ring-semantic-danger/50',
                    )}
                    {...form.register(field)}
                  />
                  <button
                    type="button"
                    onClick={() => setVisibleFields((current) => ({ ...current, [field]: !current[field] }))}
                    aria-label={visibleFields[field] ? `Sembunyikan ${labels[field]}` : `Tampilkan ${labels[field]}`}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-tertiary hover:text-ink-subtle transition-colors after:absolute after:-inset-2"
                  >
                    {visibleFields[field] ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                  </button>
                </div>
                {error && <p id={`${ids[field]}-error`} role="alert" className="text-semantic-danger text-xs">{error.message}</p>}
              </div>
            );
          })}

          <div className="rounded-md border border-hairline bg-surface-2/50 px-3 py-2.5" aria-live="polite">
            <p className="text-ink-muted text-xs font-medium mb-1.5">Aturan password</p>
            <ul className="space-y-1">
              {passwordRules.map((rule) => (
                <li key={rule.label} className={cn('flex items-center gap-2 text-xs', rule.valid ? 'text-semantic-success' : 'text-ink-tertiary')}>
                  <Check size={13} aria-hidden="true" />
                  {rule.label}
                </li>
              ))}
            </ul>
          </div>

          <Button type="submit" disabled={changePasswordMutation.isPending} className="w-full h-11 bg-primary hover:bg-primary-hover text-primary-foreground font-medium">
            {changePasswordMutation.isPending ? <><Loader2 size={16} className="animate-spin mr-2" />Menyimpan...</> : 'Simpan Password Baru'}
          </Button>

          {forced ? (
            <Button type="button" variant="outline" onClick={handleLogout} disabled={changePasswordMutation.isPending} className="w-full h-11 border-hairline text-ink hover:bg-surface-2">
              <LogOut size={16} className="mr-2" />Keluar dan lanjutkan nanti
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={onCancel} disabled={changePasswordMutation.isPending} className="w-full h-11 border-hairline text-ink hover:bg-surface-2">
              Batal
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
